import asyncio
import os
from datetime import datetime, timezone
from typing import Optional

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
from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport

load_dotenv()

import db

LIVEKIT_URL = os.environ["LIVEKIT_URL"]
LIVEKIT_API_KEY = os.environ["LIVEKIT_API_KEY"]
LIVEKIT_API_SECRET = os.environ["LIVEKIT_API_SECRET"]
DEEPGRAM_API_KEY = os.environ["DEEPGRAM_API_KEY"]
GROQ_API_KEY = os.environ["GROQ_API_KEY"]
CARTESIA_API_KEY = os.environ["CARTESIA_API_KEY"]
CARTESIA_VOICE_ID = os.environ["CARTESIA_VOICE_ID"]

ROOM_NAME = os.environ.get("ROOM_NAME", "speech-room")
AGENT_IDENTITY = "agent-bot"

SYSTEM_PROMPT = (
    "You are a friendly voice companion. "
    "Keep replies short and natural — one or two sentences, like spoken conversation."
)


def mint_agent_token() -> str:
    return (
        livekit_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(AGENT_IDENTITY)
        .with_name(AGENT_IDENTITY)
        .with_grants(
            livekit_api.VideoGrants(
                room_join=True,
                room=ROOM_NAME,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )


class SessionState:
    """Holds the active session for this room — populated on user connect."""

    def __init__(self):
        self.id: Optional[str] = None
        self.user_id: Optional[str] = None
        self.started_at: Optional[datetime] = None

    def is_active(self) -> bool:
        return self.id is not None


class TranscriptLogger(FrameProcessor):
    """Logs each turn and fires off async DB writes (one row per user/assistant line)."""

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

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame):
            logger.info(f"USER  > {frame.text!r}")
            self._persist("user", frame.text)
        elif isinstance(frame, InterimTranscriptionFrame):
            logger.debug(f"user.. > {frame.text!r}")
        elif isinstance(frame, LLMTextFrame):
            self._assistant_buffer.append(frame.text)
        elif isinstance(frame, LLMFullResponseEndFrame):
            reply = "".join(self._assistant_buffer).strip()
            if reply:
                logger.info(f"AGENT > {reply!r}")
                self._persist("assistant", reply)
            self._assistant_buffer = []

        await self.push_frame(frame, direction)


async def main():
    token = mint_agent_token()

    transport = LiveKitTransport(
        url=LIVEKIT_URL,
        token=token,
        room_name=ROOM_NAME,
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

    @transport.event_handler("on_connected")
    async def on_connected(transport):
        logger.info(f"agent connected to room '{ROOM_NAME}'")

    @transport.event_handler("on_participant_connected")
    async def on_participant_connected(transport, participant_id):
        logger.info(f"participant joined: {participant_id}")
        if participant_id == AGENT_IDENTITY or session.is_active():
            return
        # Participant id == Clerk user_id (set when /token minted the LiveKit JWT).
        user_id = participant_id
        try:
            await asyncio.to_thread(db.ensure_user, user_id)
            session.id = await asyncio.to_thread(db.create_session, user_id, ROOM_NAME)
            session.user_id = user_id
            session.started_at = datetime.now(timezone.utc)
            logger.info(f"session started: {session.id} for user {user_id}")
        except Exception as e:
            logger.error(f"failed to create session row: {e}")

    @transport.event_handler("on_participant_disconnected")
    async def on_participant_disconnected(transport, participant_id):
        logger.info(f"participant left: {participant_id}")
        if participant_id == AGENT_IDENTITY or not session.is_active():
            return
        duration = int((datetime.now(timezone.utc) - session.started_at).total_seconds())
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

    # Pipeline: mic → STT → user msg → LLM → log → TTS → speaker → assistant msg
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            context_aggregator.user(),
            llm,
            TranscriptLogger(session),
            tts,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )

    task = PipelineTask(pipeline)
    runner = PipelineRunner()
    await runner.add_workers(task)

    logger.info(f"joining LiveKit room '{ROOM_NAME}' at {LIVEKIT_URL}")
    await runner.run()


if __name__ == "__main__":
    asyncio.run(main())
