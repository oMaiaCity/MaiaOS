# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Description |
|---|---|---|
| `services/app` | 4200 | Frontend SPA (Bun HTML bundler with HMR) |
| `services/sync` | 4201 | Unified sync (WebSocket + agent API + LLM proxy, PGlite storage) |

### Running the dev environment

All commands are documented in root `package.json`. Key commands:

- **`bun dev`** — starts both app (4200) and sync (4201) with orchestrated startup (sync must be healthy before app starts)
- **`bun run check:ci`** — lint + format check (Biome + `.maia` format)
- **`bun run format`** — auto-fix formatting

### First-time setup caveats

1. **Generate credentials before first run**: `bun agent:generate` creates `/workspace/.env` with agent + test account credentials.
2. **First run requires seeding**: Add `PEER_SYNC_SEED=true` and `PEER_SYNC_STORAGE=pglite` to `.env` for the first run. After successful seed, set `PEER_SYNC_SEED=false` so subsequent restarts use persisted data.
3. **`@MaiaOS/maia-ai` resolution**: The `maia-ai-view.js` in `services/app` imports directly from `@MaiaOS/maia-ai`, but this package is not declared as a dependency in `services/app/package.json`. After `bun install`, manually symlink it: `cd services/app/node_modules/@MaiaOS && ln -s ../../../../libs/maia-ai maia-ai`. Without this, the app returns a 500 build error.
4. **Test mode sign-in**: With `VITE_AVEN_TEST_MODE=true` in `.env`, the sign-in page shows a "SIGN IN / REGISTER WITH TEST AVEN" button that bypasses WebAuthn passkeys.
5. **Guardian timeout on first run**: The sync server logs `Failed to add guardian: Timeout waiting for CoValue...` on first seed. This is expected — the test account isn't an existing peer yet. It does not block functionality.
6. **RED_PILL_API_KEY**: Without this key, the LLM chat proxy (`/api/v0/llm/chat`) returns 500. The rest of the app works fine without it.
