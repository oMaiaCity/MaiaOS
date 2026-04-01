# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Description |
|---|---|---|
| `services/app` | 4200 | Frontend SPA (Bun HTML bundler with HMR); includes the 3D city game (`@MaiaOS/game`) via dashboard **The Game** |
| `services/sync` | 4201 | Unified sync (WebSocket + agent API + LLM proxy, PGlite storage) |

### Running the dev environment

All commands are documented in root `package.json`. Key commands:

- **`bun dev`** — starts both app (4200) and sync (4201) with orchestrated startup (sync must be healthy before app starts)
- **`bun run dev:desktop`** — full stack (`bun dev`) then Tauri macOS window (requires Rust 1.88+, Xcode toolchain for Swift passkey plugin)
- **`bun run build:desktop`** — production SPA build + Tauri `.app` bundle
- **`bun run check:ci`** — lint + format check (Biome + `.maia` format)
- **`bun run format`** — auto-fix formatting

### Tauri + passkeys (macOS)

- WebAuthn in the embedded WebView is limited; native passkeys use `libs/maia-tauri-plugin-passkey` and `@MaiaOS/self` `prf-tauri.js` when `isTauri()` is true (`@tauri-apps/api/core`).
- **AASA**: `services/app/well-known/apple-app-site-association` is copied into `dist/.well-known/` on build and served in production. It lists `2P6VCHVJWB.city.maia.app` (Team ID + bundle id); bundle id must match `src-tauri/tauri.conf.json` `identifier` (`city.maia.app`).

### First-time setup caveats

1. **Generate credentials before first run**: `bun agent:generate` creates `/workspace/.env` with agent + test account credentials.
2. **First run requires seeding**: Add `PEER_SYNC_SEED=true` and `PEER_SYNC_STORAGE=pglite` to `.env` for the first run. After successful seed, set `PEER_SYNC_SEED=false` so subsequent restarts use persisted data. `SEED_VIBES` defaults to `all` (includes quickjs-add); override with e.g. `SEED_VIBES=todos,chat,quickjs-add` to pick specific vibes. **Note:** With PGlite (localhost), `PEER_SYNC_SEED=true` auto-clears DB and blob before reseeding. With Postgres/Tigris, reset manually.
3. **Test mode sign-in**: With `VITE_AVEN_TEST_MODE=true` in `.env`, the sign-in page shows a "SIGN IN / REGISTER WITH TEST AVEN" button that bypasses WebAuthn passkeys.
4. **Guardian timeout on first run**: The sync server logs `Failed to add guardian: Timeout waiting for CoValue...` on first seed. This is expected — the test account isn't an existing peer yet. It does not block functionality.
5. **RED_PILL_API_KEY**: Without this key, the LLM chat proxy (`/api/v0/llm/chat`) returns 500. The rest of the app works fine without it.
6. **InvalidSignature in console**: After regenerating credentials (`bun agent:generate`), reseeding (`PEER_SYNC_SEED=true`), or schema migrations, the browser may have cached data signed by old sessions. Clear site data (DevTools → Application → Storage → Clear site data) for the app origin to remove the noise. The app continues to work; invalid transactions are skipped.
