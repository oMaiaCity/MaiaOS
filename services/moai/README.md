# Moai (service: UI + full stack)

**`services/moai`** is the **fullstack product** in this monorepo:

1. **Frontend** — `index.html` (chat, voice, camera) served by the `maia-ai` server.
2. **Runner** — `bun run dev` in this package starts the **entire** `libs/maia-ai` process (`uv run python -m maia_ai.server`) so one command brings up model load + API + your UI.

**`libs/maia-ai`** is the **reusable** Python package (inference, TTS, WebSocket). Moai is the place you open in the browser and the script you run to dev the whole experience.

## Python environment (lives here, not in `libs/maia-ai`)

The `uv` virtualenv is **`services/moai/.venv/`** (via `UV_PROJECT_ENVIRONMENT`). **`libs/maia-ai`** keeps only `pyproject.toml` and source — no venv in the package folder.

**First time** (or after changing `libs/maia-ai` dependencies):

```bash
bun run maia:sync
```

(From `services/moai`: `bun run sync:ai` — same script.)

## From the MaiaOS repo root

```bash
bun run dev:moai
```

(Equivalent: `cd services/moai && bun run dev`.)

Open the URL the server prints (default `http://127.0.0.1:8000`).

**Configuration** — the **repo root** `.env` (e.g. `HF_TOKEN`, `HOST`, `PORT`). Optional: `MOAI_STATIC_DIR` (override UI path), `MOAI_CACHE_DIR` (override data directory).

**Model + cache on disk** — by default, Hugging Face Hub snapshots and LiteRT engine files go under **`services/moai/.cache/`** (e.g. `huggingface/`, `litert-lm/`), *not* under `libs/maia-ai`, so the Python package stays source-only. Override with `MOAI_CACHE_DIR` or set `HF_HOME` yourself in `.env` (if set, the server does not change it).

## Relationship

| Piece | Role |
| ----- | ---- |
| `libs/maia-ai` | Standalone package: on-device LLM + TTS + FastAPI (reusable) |
| `services/moai` | This folder: static UI + dev script that runs `maia-ai` under the hood |
