# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Description |
|---|---|---|
| `services/app` | 4200 | Frontend SPA (Bun HTML bundler with HMR); includes the 3D city game (`@MaiaOS/game`) via dashboard **The Game** |
| `services/sync` | 4201 | Unified sync (WebSocket + agent API + LLM proxy, PGlite storage) |

### Sync: `PEER_APP_HOST` and multi-origin local dev

- **`PEER_APP_HOST`** is the allowed browser origin for sync (HTTP + WebSocket upgrade). In production (Postgres on Fly), set it to the app origin (for example `https://next.maia.city`).
- **PGlite local dev:** With `PEER_APP_HOST` set (for example `localhost:4200`), sync still allows `http://localhost:4200`, `http://127.0.0.1:4200`, and `http://[::1]:4200` on port **4200** so different loopback URLs are not blocked by CORS.
- **Postgres local dev:** Set **`MAIA_DEV_CORS=1`** for the same multi-origin CORS, or leave **`PEER_APP_HOST` unset** so sync uses `*` (development only).
- **Unset `PEER_APP_HOST`:** CORS is `*` — acceptable for local dev, not for production.
- The app builds sync HTTP and WebSocket URLs from the same module (`@MaiaOS/peer` `getSyncHttpBaseUrl` / `getSyncWebSocketUrl`) so the page host matches fetch and WS.
- **AdGuard** (and similar tools) can block `localhost` traffic; if sync still fails, try disabling filtering for localhost.

### Running the dev environment

All commands are documented in root `package.json`. Key commands:

- **`bun dev`** — starts both app (4200) and sync (4201) with orchestrated startup (sync must be healthy before app starts)
- **`bun run dev:desktop`** — full stack (`bun dev`) then Tauri macOS window (requires Rust 1.88+, Xcode toolchain for Swift passkey plugin). **`tauri dev` is not fully code-signed like the bundle**; native passkeys (`ASAuthorizationController`) need a **built** `.app` (see below).
- **`bun run build:desktop`** — production SPA build + Tauri `.app` bundle (signed per `src-tauri/tauri.conf.json`). **Use this build to test passkeys**, then open `services/app/src-tauri/target/release/bundle/macos/Maia City.app` (or run from Finder). Start `bun dev` (or sync only) in another terminal if the UI should talk to local sync.
- **`bun run build:desktop:debug`** — same as `build:desktop` but `tauri build --debug` (faster Rust compile); signed bundle under `target/debug/bundle/macos/`.
- **`bun run check:ci`** — lint + format check (Biome + `.maia` format)
- **`bun test`** — runs `test` in every workspace that defines it (`bun run --workspaces --if-present test`; currently `@MaiaOS/db`)
- **`bun run format`** — auto-fix formatting
- **Logging mode (dev, `@MaiaOS/logs`):** Set **`LOG_MODE`** in root `.env` (or `LOG_MODE=… bun dev`). On localhost, `/__maia_env` sets **in-memory** PERF/TRACE/DEBUG flags before boot — **not** localStorage. Use dot tokens: **`perf.all`**, **`perf.game.init`**, **`trace.all`**, **`debug.all`**, **`debug.engines.loadBinary`**, **`debug.app.cobinary`**, comma-separated. Colon form **`engines:pipeline`** for granular PERF. Empty **`LOG_MODE`** → no PERF/TRACE/DEBUG. No browser overrides (old `maia:perf:*` / `maia:debug:trace` keys are ignored for gating).

### Tauri + passkeys (macOS)

- WebAuthn in the embedded WebView is limited; native passkeys use `libs/maia-tauri-plugin-passkey` and `@MaiaOS/self` `prf-tauri.js` when `isTauri()` is true (`@tauri-apps/api/core`).
- **AASA**: `services/app/well-known/apple-app-site-association` is copied into `dist/.well-known/` on build and served in production (e.g. `https://next.maia.city/.well-known/...`). It lists `TEAM_ID.city.maia.next` for each Apple team that signs the app. The desktop app’s native passkey RP ID is **`next.maia.city`** (`Entitlements.plist` `webcredentials:next.maia.city`; `@MaiaOS/self` `prf-tauri.js`). **Team ID** must match **Membership → Team ID** in Apple Developer (or `codesign -dv --verbose=4 "Maia City.app"` → `TeamIdentifier` — do not use the short id in parentheses from Keychain if it differs). Bundle id must match `src-tauri/tauri.conf.json` `identifier` (`city.maia.next` — do not use a suffix `.app`; it conflicts with the macOS `.app` bundle extension). In **Apple Developer → Identifiers**, that App ID must have **Associated Domains** enabled and include **`webcredentials:next.maia.city`** (regenerate the macOS provisioning profile after changing domains).
- **Gatekeeper (why Finder says it cannot open):** `Apple Development`–signed `.app` bundles are **not** notarized; `spctl -a -vv` reports `rejected` for double-click from Finder. **First launch:** right-click **Maia City.app** → **Open** → confirm, or **System Settings → Privacy & Security → Open Anyway** after a blocked attempt. Copied/DMG installs: `xattr -cr "/path/to/Maia City.app"` to clear quarantine if needed. **Shipping to others:** sign with **Developer ID Application** and **notarize** (Tauri env: `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` or API key trio).

### First-time setup caveats

1. **Generate credentials before first run**: `bun agent:generate` creates `/workspace/.env` with agent + test account credentials.
2. **First run requires seeding**: Add `PEER_SYNC_SEED=true` and `PEER_SYNC_STORAGE=pglite` to `.env` for the first run. After successful seed, set `PEER_SYNC_SEED=false` so subsequent restarts use persisted data. `SEED_VIBES` defaults to `all` (includes quickjs-add); override with e.g. `SEED_VIBES=todos,chat,quickjs-add` to pick specific vibes. **Note:** With PGlite (localhost), `PEER_SYNC_SEED=true` auto-clears DB and blob before reseeding. With Postgres/Tigris, reset manually. **Non-destructive config updates:** `PEER_SYNC_MIGRATE=true` applies code-defined configs onto existing storage (nano-ID keyed); mutually exclusive with `PEER_SYNC_SEED`. Requires a prior successful seed.
3. **Test mode sign-in**: With `VITE_AVEN_TEST_MODE=true` in `.env`, the sign-in page shows a "SIGN IN / REGISTER WITH TEST AVEN" button that bypasses WebAuthn passkeys.
4. **Guardian timeout on first run**: The sync server logs `Failed to add guardian: Timeout waiting for CoValue...` on first seed. This is expected — the test account isn't an existing peer yet. It does not block functionality.
5. **RED_PILL_API_KEY**: Without this key, the LLM chat proxy (`/api/v0/llm/chat`) returns 500. The rest of the app works fine without it.
6. **InvalidSignature in console**: After regenerating credentials (`bun agent:generate`), reseeding (`PEER_SYNC_SEED=true`), or schema migrations, the browser may have cached data signed by old sessions. Clear site data (DevTools → Application → Storage → Clear site data) for the app origin to remove the noise. The app continues to work; invalid transactions are skipped.
