import asyncio
import os
from datetime import datetime, timezone
from typing import Optional

from aiohttp import web
from dotenv import load_dotenv
from livekit import api as livekit_api
from loguru import logger

from pipecat.frames.frames import (
    Frame,
    InterimTranscriptionFrame,
    LLMFullResponseEndFrame,
    LLMTextFrame,
    TranscriptionFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.groq.llm import GroqLLMService
from pipecat.transports.livekit.transport import (
    LiveKitOutputTransportMessageFrame,
    LiveKitParams,
    LiveKitTransport,
)

load_dotenv()

import db

LIVEKIT_URL = os.environ["LIVEKIT_URL"]
LIVEKIT_API_KEY = os.environ["LIVEKIT_API_KEY"]
LIVEKIT_API_SECRET = os.environ["LIVEKIT_API_SECRET"]
DEEPGRAM_API_KEY = os.environ["DEEPGRAM_API_KEY"]
GROQ_API_KEY = os.environ["GROQ_API_KEY"]
CARTESIA_API_KEY = os.environ["CARTESIA_API_KEY"]
CARTESIA_VOICE_ID = os.environ["CARTESIA_VOICE_ID"]

DISPATCH_SECRET = os.environ["DISPATCH_SECRET"]
PORT = int(os.environ.get("PORT", "8080"))

AGENT_IDENTITY = "agent-bot"

# If the user never shows up after a dispatch, leave the room so we don't
# burn LiveKit participant-minutes on a no-show.
NO_SHOW_TIMEOUT_S = 90

SYSTEM_PROMPT = (
    "You are a friendly voice companion. "
    "Keep replies short and natural — one or two sentences, like spoken conversation."
)


def mint_agent_token(room_name: str) -> str:
    return (
        livekit_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(AGENT_IDENTITY)
        .with_name(AGENT_IDENTITY)
        .with_grants(
            livekit_api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )


class SessionState:
    """Holds the DB session for one dispatched call."""

    def __init__(self):
        self.id: Optional[str] = None
        self.user_id: Optional[str] = None
        self.started_at: Optional[datetime] = None

    def is_active(self) -> bool:
        return self.id is not None


class TranscriptLogger(FrameProcessor):
    """Logs each turn, fires off async DB writes (one row per user/assistant
    line), and publishes live-caption events over the LiveKit data channel
    (the browser's caption strip subscribes to these in-room)."""

    def __init__(self, session: SessionState):
        super().__init__()
        self._assistant_buffer: list[str] = []
        self._session = session

    def _persist(self, role: str, text: str) -> None:
        if not self._session.is_active():
            return
        sid = self._session.id
        # Fire-and-forget so the audio pipeline never waits on Supabase.
        asyncio.create_task(asyncio.to_thread(db.append_transcript, sid, role, text))

    async def _caption(self, role: str, text: str, final: bool) -> None:
        # Downstream DataFrame — transport.output() JSON-encodes the dict and
        # publishes it on the room's reliable data channel.
        await self.push_frame(
            LiveKitOutputTransportMessageFrame(
                message={"type": "transcript", "role": role, "text": text, "final": final}
            )
        )

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame):
            logger.info(f"USER  > {frame.text!r}")
            self._persist("user", frame.text)
            await self._caption("user", frame.text, final=True)
        elif isinstance(frame, InterimTranscriptionFrame):
            logger.debug(f"user.. > {frame.text!r}")
            await self._caption("user", frame.text, final=False)
        elif isinstance(frame, LLMTextFrame):
            self._assistant_buffer.append(frame.text)
        elif isinstance(frame, LLMFullResponseEndFrame):
            reply = "".join(self._assistant_buffer).strip()
            if reply:
                logger.info(f"AGENT > {reply!r}")
                self._persist("assistant", reply)
                await self._caption("assistant", reply, final=True)
            self._assistant_buffer = []

        await self.push_frame(frame, direction)


async def run_session(room_name: str):
    """One dispatched call: join the room, run the pipeline, leave when the
    user leaves (or never shows up). Only this task touches LiveKit — the
    process itself stays up as the dispatch server."""
    token = mint_agent_token(room_name)

    transport = LiveKitTransport(
        url=LIVEKIT_URL,
        token=token,
        room_name=room_name,
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
        ),
    )

    stt = DeepgramSTTService(api_key=DEEPGRAM_API_KEY)
    llm = GroqLLMService(api_key=GROQ_API_KEY)
    tts = CartesiaTTSService(api_key=CARTESIA_API_KEY, voice_id=CARTESIA_VOICE_ID)

    context = LLMContext(messages=[{"role": "system", "content": SYSTEM_PROMPT}])
    context_aggregator = LLMContextAggregatorPair(context)

    session = SessionState()

    # Pipeline: mic → STT → log user → context → LLM → log assistant → TTS → speaker
    # Two TranscriptLogger taps: one before context_aggregator.user() (which
    # consumes TranscriptionFrame and stops it propagating), one after the LLM.
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            TranscriptLogger(session),
            context_aggregator.user(),
            llm,
            TranscriptLogger(session),
            tts,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )

    task = PipelineTask(pipeline)

    @transport.event_handler("on_connected")
    async def on_connected(transport):
        logger.info(f"agent connected to room '{room_name}'")

    @transport.event_handler("on_participant_connected")
    async def on_participant_connected(transport, participant_id):
        logger.info(f"participant joined: {participant_id}")
        if participant_id == AGENT_IDENTITY or session.is_active():
            return
        # Participant id == Clerk user_id (set when /token minted the LiveKit JWT).
        user_id = participant_id
        try:
            await asyncio.to_thread(db.ensure_user, user_id)
            session.id = await asyncio.to_thread(db.create_session, user_id, room_name)
            session.user_id = user_id
            session.started_at = datetime.now(timezone.utc)
            logger.info(f"session started: {session.id} for user {user_id}")
        except Exception as e:
            logger.error(f"failed to create session row: {e}")

    @transport.event_handler("on_participant_disconnected")
    async def on_participant_disconnected(transport, participant_id):
        logger.info(f"participant left: {participant_id}")
        if participant_id == AGENT_IDENTITY:
            return
        if session.is_active():
            duration = int(
                (datetime.now(timezone.utc) - session.started_at).total_seconds()
            )
            sid, uid = session.id, session.user_id
            try:
                await asyncio.to_thread(db.end_session, sid, uid, duration)
                logger.info(f"session ended: {sid} ({duration}s, user {uid})")
            except Exception as e:
                logger.error(f"failed to close session row: {e}")
            finally:
                session.id = None
                session.user_id = None
                session.started_at = None
        # Per-call room: the call is over — tear the pipeline down and leave.
        await task.cancel(reason="user left")

    async def no_show_watchdog():
        await asyncio.sleep(NO_SHOW_TIMEOUT_S)
        if not session.is_active():
            logger.info(f"no user joined '{room_name}' in {NO_SHOW_TIMEOUT_S}s; leaving")
            await task.cancel(reason="no-show")

    watchdog = asyncio.create_task(no_show_watchdog())

    runner = PipelineRunner(handle_sigint=False)
    try:
        logger.info(f"joining LiveKit room '{room_name}' at {LIVEKIT_URL}")
        await runner.add_workers(task)
        await runner.run()
    finally:
        watchdog.cancel()
        logger.info(f"session task for room '{room_name}' finished")


# ── Dispatch server ─────────────────────────────────────────────────────────
# The API POSTs here (Railway private networking) after minting a user token
# for a fresh per-call room. The agent joins LiveKit only when dispatched, so
# zero participant-minutes accrue while idle. One task per room = concurrent
# conversations are now supported.

active_rooms: dict[str, asyncio.Task] = {}


async def handle_dispatch(request: web.Request) -> web.Response:
    if request.headers.get("X-Dispatch-Secret") != DISPATCH_SECRET:
        return web.json_response({"error": "unauthorized"}, status=401)

    body = await request.json()
    room_name = body.get("room")
    if not room_name:
        return web.json_response({"error": "missing room"}, status=400)

    existing = active_rooms.get(room_name)
    if existing and not existing.done():
        return web.json_response({"status": "already_active", "room": room_name})

    task = asyncio.create_task(run_session(room_name))
    active_rooms[room_name] = task

    def _cleanup(t: asyncio.Task, room: str = room_name):
        active_rooms.pop(room, None)
        if t.cancelled():
            return
        if exc := t.exception():
            logger.error(f"session task for '{room}' crashed: {exc}")

    task.add_done_callback(_cleanup)
    logger.info(f"dispatched agent to room '{room_name}'")
    return web.json_response({"status": "dispatched", "room": room_name})


async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok", "active_rooms": len(active_rooms)})


def main():
    app = web.Application()
    app.router.add_post("/dispatch", handle_dispatch)
    app.router.add_get("/health", handle_health)
    logger.info(f"agent dispatch server listening on :{PORT}")
    # No host → aiohttp binds ALL interfaces, IPv4 and IPv6. Railway's public
    # edge connects over IPv4 while private networking (railway.internal) is
    # IPv6-only, so we need both stacks listening.
    web.run_app(app, port=PORT)


if __name__ == "__main__":
    main()
