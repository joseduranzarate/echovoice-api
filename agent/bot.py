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
    LLMRunFrame,
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
from pipecat.services.deepgram.stt import DeepgramSTTService, DeepgramSTTSettings
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

# Turn-taking patience. Learners pause mid-sentence to think of the next
# word; Deepgram's default endpointing (~10ms of silence) makes Echo jump
# in on those pauses. Tunable via env without code changes.
STT_ENDPOINTING_MS = int(os.environ.get("STT_ENDPOINTING_MS", "800"))
STT_UTTERANCE_END_MS = int(os.environ.get("STT_UTTERANCE_END_MS", "1500"))

SYSTEM_PROMPT = (
    "You are Echo, a friendly voice companion helping someone practice "
    "spoken English. Keep replies short and natural — one or two sentences, "
    "like spoken conversation. Be patient and encouraging."
)


LEVEL_PACING = {
    "Beginner": (
        " The learner is a beginner: use simple vocabulary, short sentences, "
        "speak a little slower in phrasing, and never use idioms without "
        "explaining them."
    ),
    "Intermediate": (
        " The learner is intermediate: everyday vocabulary is fine, gently "
        "stretch them with occasional new phrases."
    ),
    "Advanced": (
        " The learner is advanced: speak naturally, use idioms and nuance, "
        "and challenge them with follow-up questions."
    ),
}


# Exam-mode scenarios (Home's EXAM chips send these markers).
EXAM_PROMPTS = {
    "exam:ielts-speaking": (
        " You are now an IELTS Speaking examiner running a realistic mock "
        "test, while staying warm and encouraging. Structure: PART 1 — "
        "introduce yourself briefly, then ask simple questions about "
        "familiar topics (home, work, hobbies), one at a time. After 3-4 "
        "exchanges, move to PART 2 — give the learner a cue-card style "
        "topic (e.g. 'Describe a place you love visiting — where it is, "
        "when you go, why it matters'), tell them to speak for as long as "
        "they can, and listen without interrupting. Then PART 3 — ask 2-3 "
        "deeper discussion questions related to their Part 2 topic. Keep "
        "your own turns short like a real examiner. At the end, give brief "
        "encouraging feedback on fluency and vocabulary — do NOT give a "
        "band score."
    ),
    "exam:toefl-speaking": (
        " You are now a TOEFL Speaking practice coach running realistic "
        "tasks, warm but structured. Give one task at a time: TASK 1 — an "
        "independent question (e.g. 'Some people prefer studying alone, "
        "others in groups. Which do you prefer and why?'), ask them to "
        "answer in about 45 seconds. TASK 2 — describe a short campus "
        "situation and ask their opinion on it. Listen fully, then give "
        "one specific, encouraging tip after each task (organization, "
        "detail, or linking words). Two tasks per session, then invite "
        "free discussion. Do NOT give a numeric score."
    ),
}


def build_system_prompt(
    scenario: str | None,
    level: str | None = None,
    resume: dict | None = None,
) -> str:
    prompt = SYSTEM_PROMPT
    pacing = LEVEL_PACING.get((level or "").strip().capitalize())
    if pacing:
        prompt += pacing
    if resume:
        titled = f' (titled "{resume["title"]}")' if resume.get("title") else ""
        return prompt + (
            f" The learner is returning to CONTINUE a previous conversation"
            f"{titled}. The earlier turns of that conversation are already in "
            "this context. Welcome them back warmly in one short sentence, "
            "briefly recall what you were talking about, and pick up naturally "
            "where it left off — do not re-introduce yourself or start over."
        )
    if not scenario:
        return prompt + " Open with a warm, brief greeting and an easy question."
    if exam := EXAM_PROMPTS.get(scenario.strip().lower()):
        return prompt + exam
    return prompt + (
        f' The learner chose to practice this scenario: "{scenario}". '
        "Open the conversation in that setting, playing the natural other role "
        "(e.g. barista, interviewer, check-in agent), and stay in the scenario. "
        "If the learner drifts to another topic, follow their lead — the "
        "scenario is a starting point, not a cage."
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


async def run_session(
    room_name: str,
    scenario: str | None = None,
    level: str | None = None,
    dispatch_user_id: str | None = None,
    resume: dict | None = None,
):
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

    stt = DeepgramSTTService(
        api_key=DEEPGRAM_API_KEY,
        settings=DeepgramSTTSettings(
            endpointing=STT_ENDPOINTING_MS,
            utterance_end_ms=STT_UTTERANCE_END_MS,
        ),
    )
    llm = GroqLLMService(api_key=GROQ_API_KEY)
    tts = CartesiaTTSService(api_key=CARTESIA_API_KEY, voice_id=CARTESIA_VOICE_ID)

    # Resume-with-memory: seed the previous conversation's tail as real
    # chat turns so Echo actually remembers it, not just a recap line.
    messages = [
        {"role": "system", "content": build_system_prompt(scenario, level, resume)}
    ]
    if resume:
        messages += resume["turns"]
    context = LLMContext(messages=messages)
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
        # Session ownership comes from the dispatch payload (the API's
        # verified Clerk user_id) — NOT from participant_id. Pipecat 1.5
        # started passing the LiveKit participant SID (PA_...) here, which
        # silently created phantom user rows and mis-billed usage. The
        # participant event is only the trigger; identity comes from /token.
        user_id = dispatch_user_id or participant_id
        try:
            await asyncio.to_thread(db.ensure_user, user_id)
            session.id = await asyncio.to_thread(db.create_session, user_id, room_name)
            session.user_id = user_id
            session.started_at = datetime.now(timezone.utc)
            logger.info(f"session started: {session.id} for user {user_id}")
        except Exception as e:
            logger.error(f"failed to create session row: {e}")
        # Echo opens the conversation (in-scenario when one was chosen) —
        # kick one LLM turn now that the user is in the room.
        await task.queue_frames([LLMRunFrame()])

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
            # Post-session analysis (title, corrections, word count) —
            # independent task so it survives the pipeline teardown below.
            asyncio.create_task(analyze_session(sid))
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


# ── Post-session analysis ───────────────────────────────────────────────────
# One Groq call after each session: a short title + gentle corrections for
# the learner's turns. Best-effort — a failure just leaves the session
# without a title, exactly like before this feature existed.

import json

import aiohttp

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("GROQ_ANALYSIS_MODEL", "llama-3.3-70b-versatile")

ANALYSIS_PROMPT = """You are reviewing an English practice conversation between a learner (user) and a voice tutor (assistant).

Given the numbered learner turns, return JSON with:
- "title": a short natural title for the conversation, 3-6 words, no quotes
- "corrections": array of at most 5 items, ONLY for turns with a real grammar or word-choice mistake, each {"n": <turn number>, "from": "<the mistaken fragment, quoted verbatim>", "to": "<the corrected fragment>"}

Do not invent corrections for correct sentences. Respond with JSON only."""


async def analyze_session(session_id: str) -> None:
    try:
        rows = await asyncio.to_thread(db.get_transcript_rows, session_id)
        user_rows = [r for r in rows if r["role"] == "user"]
        if not user_rows:
            return

        word_count = sum(len(r["text"].split()) for r in user_rows)
        preview = f"“{user_rows[0]['text'][:80]}”"

        numbered = "\n".join(f"{i + 1}. {r['text']}" for i, r in enumerate(user_rows))
        payload = {
            "model": GROQ_MODEL,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": ANALYSIS_PROMPT},
                {"role": "user", "content": numbered},
            ],
            "temperature": 0.2,
        }

        async with aiohttp.ClientSession() as http:
            async with http.post(
                GROQ_CHAT_URL,
                json=payload,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

        result = json.loads(data["choices"][0]["message"]["content"])
        title = (result.get("title") or "").strip()[:80] or None
        corrections = result.get("corrections") or []

        applied = 0
        for c in corrections:
            try:
                idx = int(c["n"]) - 1
                if 0 <= idx < len(user_rows) and c.get("from") and c.get("to"):
                    await asyncio.to_thread(
                        db.set_correction,
                        user_rows[idx]["id"],
                        {"from": str(c["from"])[:200], "to": str(c["to"])[:200]},
                    )
                    applied += 1
            except (KeyError, ValueError, TypeError):
                continue

        await asyncio.to_thread(
            db.save_analysis, session_id, title, preview, word_count, applied
        )
        logger.info(
            f"analysis done for {session_id}: title={title!r}, "
            f"{applied} corrections, {word_count} words"
        )
    except Exception as e:
        logger.error(f"analysis failed for session {session_id}: {e}")


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

    scenario = (body.get("scenario") or "").strip()[:200] or None
    level = (body.get("level") or "").strip()[:40] or None
    dispatch_user_id = (body.get("user_id") or "").strip() or None

    # Resume payload from the API: {"title": ..., "turns": [{role, text}]}.
    # Re-sanitize here — the dispatch endpoint trusts the shared secret, not
    # the payload shape.
    resume = None
    if isinstance(body.get("resume"), dict):
        raw = body["resume"]
        turns = [
            {"role": t["role"], "text": str(t["text"])[:400]}
            for t in (raw.get("turns") or [])[:12]
            if isinstance(t, dict)
            and t.get("role") in ("user", "assistant")
            and t.get("text")
        ]
        if turns:
            title = str(raw.get("title") or "").strip()[:120] or None
            resume = {"title": title, "turns": turns}

    task = asyncio.create_task(
        run_session(room_name, scenario, level, dispatch_user_id, resume)
    )
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
