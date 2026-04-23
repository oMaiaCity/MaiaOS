# maia-ai (reusable package)

**Standalone Python package** in the monorepo: **LiteRT-LM (Gemma)** + **Kokoro TTS** + **FastAPI** WebSocket server.

- **Reusable** — another app or service can depend on this project (`uv`, `pyproject.toml`) and run `python -m maia_ai.server`, or import `maia_ai` code in a larger Python app.
- **UI is not here** — static HTML is served from paths under `MOAI_STATIC_DIR` or, by default, `services/moai/index.html` in the repo. The [Moai](../services/moai/) service owns the browser UI and the convenient `bun run dev:moai` flow.

## Run (in monorepo)

Prefer the Moai venv in **`services/moai/.venv`** (not a venv under this folder):

```bash
# from MaiaOS root
bun run maia:sync
bun run dev:moai
```

## Run (library only, with local `.venv` here)

```bash
cd libs/maia-ai
uv sync
uv run python -m maia_ai.server
```

Set env (e.g. the **repo root** `.env` in MaiaOS): `HF_TOKEN`, `HF_REPO` / `HF_FILENAME`, `HOST`, `PORT`, `MOAI_STATIC_DIR` if the UI is elsewhere. **Cache:** in the monorepo, weights go to `services/moai/.cache/` by default (`MOAI_CACHE_DIR` to move it). If you run this package **outside** the repo (no `services/moai/index.html`), the default is `~/.cache/maia-ai`. Setting `HF_HOME` in the environment takes precedence for Hub downloads.

## Layout

- `src/maia_ai/` — `server`, `tts`
- `benchmarks/` — WebSocket stress tests
- `artifacts/` — design / research notes
