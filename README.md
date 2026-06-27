# speech_project

A conversational voice AI app — browser-based, low-latency, Sesame-inspired.

## Architecture

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       │ ① REST: POST /token  → JWT          (api/)
       │ ② WebRTC: join room with JWT
       ▼
┌──────────────────────┐
│   REST API           │   FastAPI — JWT mint, future business logic
│   (api/)             │
└──────────────────────┘
       ▲
       │  Browser also opens a WebRTC connection ↓
       │
┌──────▼─────────────────────────────────────────┐
│   LiveKit Cloud  (SFU — routes audio peers)    │
└──────────────────────┬─────────────────────────┘
                       │ WebRTC
                       ▼
        ┌─────────────────────────────┐
        │   Pipecat Agent (agent/)    │
        │   one process per call      │
        │                             │
        │   mic → VAD → STT → LLM →   │
        │       TTS → speaker         │
        └─────────────────────────────┘
              │       │       │
        Deepgram   Groq   Cartesia
```

## Folder layout

```
speech_project/
├── agent/              Pipecat voice agent (Python worker)
│   ├── .env.example
│   ├── requirements.txt
│   └── bot.py          (added in Chunk 5)
├── api/                REST API (FastAPI)
│   ├── .env.example
│   ├── requirements.txt
│   └── main.py         (added in Chunk 3)
├── web/                Browser client (HTML + LiveKit JS)
│   └── index.html      (added in Chunk 10)
├── CHANGELOG.md        Decisions log
├── README.md           You are here
└── .gitignore
```

## Services used

| Role | Service | Free tier |
|---|---|---|
| STT (speech → text) | Deepgram Nova-3 | $200 credit |
| LLM (text → reply) | Groq (Llama 3.3 70B) | Generous free |
| TTS (text → speech) | Cartesia Sonic | Free tier |
| WebRTC transport | LiveKit Cloud | 5k min/mo free |

## Quick start

Will be filled in as chunks land. Current state: scaffold only.

```bash
# (placeholder — instructions added per chunk)
```

## Local dev setup

Each service runs independently. Recommended: two terminals.

```bash
# Terminal 1 — REST API
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # then paste your LiveKit creds
uvicorn main:app --reload   # http://localhost:8000

# Terminal 2 — Pipecat agent
cd agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # then paste all 4 services' creds
python bot.py
```

(The web client is just static HTML — open `web/index.html` or serve it with any static server.)

## Progress

See [CHANGELOG.md](./CHANGELOG.md).
