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

### Maia identity and refs

- **Logical refs** use the **`°`** prefix (e.g. `°maia/...`). Instance configs carry **`$label`** (full logical ref string) and **`$nanoid`** (deterministic from the canonical `maia/...` path). There is **no Maia `$id`** on instances—**`$label`** is the single logical id.
- **Factory refs** in authoring use **`°maia/factory/<name>.factory.maia`** — derived as `maiaFactoryLabel` / `maiaIdentity` in [`libs/maia-universe/src/helpers/identity-from-maia-path.js`](libs/maia-universe/src/helpers/identity-from-maia-path.js) (no manual map). **`$factory`** in `.maia` files uses that shape.
- **JSON Schema** `"$id": "https://..."` in defs is unrelated to Maia identity.
- **Registry codegen:** after changing universe `.maia` inventory, run **`bun scripts/generate-maia-universe-registry.mjs`** (updates `libs/maia-universe/src/generated/registry.js`, `SEED_DATA`, `MAIA_SPARK_REGISTRY`).
- **Future sparks:** additional top-level prefixes may follow the same pattern (e.g. `°<spark>/factory/...`); the current universe uses **`°maia/...`** only.

### Running the dev environment

All commands are documented in root `package.json`. Key commands:

- **`bun dev`** — starts both app (4200) and sync (4201) with orchestrated startup (sync must be healthy before app starts)
- **`bun run dev:desktop`** — full stack (`bun dev`) then Tauri macOS window (requires Rust 1.88+, Xcode toolchain for Swift passkey plugin). **`tauri dev` is not fully code-signed like the bundle**; native passkeys (`ASAuthorizationController`) need a **built** `.app` (see below).
- **`bun run build:desktop`** — production SPA build + Tauri `.app` bundle (signed per `src-tauri/tauri.conf.json`). **Use this build to test passkeys**, then open `services/app/src-tauri/target/release/bundle/macos/Maia City.app` (or run from Finder). Start `bun dev` (or sync only) in another terminal if the UI should talk to local sync.
- **`bun run build:desktop:debug`** — same as `build:desktop` but `tauri build --debug` (faster Rust compile); signed bundle under `target/debug/bundle/macos/`.
- **`bun run check:ci`** — lint + format check (Biome + `.maia` format)
- **`bun test`** — runs `test` in every workspace that defines it (`bun run --workspaces --if-present test`; currently `@MaiaOS/db`)
- **`bun run format`** — auto-fix formatting

### Logging: dev:app vs dev:sync

Both [`scripts/dev-app.js`](scripts/dev-app.js) and [`scripts/dev-sync.js`](scripts/dev-sync.js) load root [`.env`](.env) via `bun --env-file=.env`, but **`LOG_MODE` applies only to the app SPA** (browser), not to the sync server process.

| Process | What controls verbosity |
|---|---|
| **`bun dev:app`** / **`bun dev`** (app) | **`LOG_MODE`** → [`applyLogModeFromEnv`](libs/maia-logs/src/log-mode.js) in the browser after [`/__maia_env`](services/app/dev-server.js) (see [`services/app/main.js`](services/app/main.js)). On localhost, flags are **in-memory** before boot — **not** localStorage. Empty **`LOG_MODE`** → no PERF/TRACE/DEBUG. No browser overrides (old `maia:perf:*` / `maia:debug:trace` keys are ignored). |
| **`bun dev:sync`** | Sync does **not** read **`LOG_MODE`**. It uses [`createOpsLogger`](libs/maia-logs/src/ops.js) (`[sync]`, `[register]`, `[ValidationHook]`, …) and prints to the **terminal** as needed. Use the sync terminal and grep those tags when debugging POST `/register` and validation hooks. |

**dev:app — set in root `.env`** (or one-off: `LOG_MODE='…' bun dev:app` / `bun dev`):

- Maia DB / capability / DB view: **`debug.app.maia-db`** or **`debug.all`**
- Perf for the same areas: **`perf.app.maia-db`** or **`perf.all`**
- Combined example: **`debug.app.maia-db,perf.app.maia-db`**
- Very noisy: **`trace.all`** (only when needed)

General tokens (comma-separated): **`perf.all`**, **`perf.game.init`**, **`trace.all`**, **`debug.all`**, **`debug.engines.loadBinary`**, **`debug.app.cobinary`**. Colon form **`engines:pipeline`** is supported for granular PERF (see [`libs/maia-logs/src/log-mode.js`](libs/maia-logs/src/log-mode.js)).

**dev:sync:** No `LOG_MODE` knob today. Optional follow-up: env-gated extra lines (e.g. `MAIA_SYNC_REGISTER_DEBUG=1`) wired to stable [`OPS_PREFIX`](libs/maia-logs/src/ops.js) tags if you need more than existing ops logs.

### Tauri + passkeys (macOS)

- WebAuthn in the embedded WebView is limited; native passkeys use `libs/maia-tauri-plugin-passkey` and `@MaiaOS/self` `prf-tauri.js` when `isTauri()` is true (`@tauri-apps/api/core`).
- **AASA**: `services/app/well-known/apple-app-site-association` is copied into `dist/.well-known/` on build and served in production (e.g. `https://next.maia.city/.well-known/...`). It lists `TEAM_ID.city.maia.next` for each Apple team that signs the app. The desktop app’s native passkey RP ID is **`next.maia.city`** (`Entitlements.plist` `webcredentials:next.maia.city`; `@MaiaOS/self` `prf-tauri.js`). **Team ID** must match **Membership → Team ID** in Apple Developer (or `codesign -dv --verbose=4 "Maia City.app"` → `TeamIdentifier` — do not use the short id in parentheses from Keychain if it differs). Bundle id must match `src-tauri/tauri.conf.json` `identifier` (`city.maia.next` — do not use a suffix `.app`; it conflicts with the macOS `.app` bundle extension). In **Apple Developer → Identifiers**, that App ID must have **Associated Domains** enabled and include **`webcredentials:next.maia.city`** (regenerate the macOS provisioning profile after changing domains).
- **Gatekeeper (why Finder says it cannot open):** `Apple Development`–signed `.app` bundles are **not** notarized; `spctl -a -vv` reports `rejected` for double-click from Finder. **First launch:** right-click **Maia City.app** → **Open** → confirm, or **System Settings → Privacy & Security → Open Anyway** after a blocked attempt. Copied/DMG installs: `xattr -cr "/path/to/Maia City.app"` to clear quarantine if needed. **Shipping to others:** sign with **Developer ID Application** and **notarize** (Tauri env: `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` or API key trio).

### First-time setup caveats

1. **Generate credentials before first run**: `bun agent:generate` creates `/workspace/.env` with agent + test account credentials.
2. **Seeding**: `PEER_SYNC_MODE` — `seed` (genesis seed only; does not clear storage), or unset/`none` (normal: no genesis seed). **Fly / empty DB:** set `PEER_SYNC_MODE=seed` for the deploy that should run genesis, then `fly secrets unset PEER_SYNC_MODE --app <sync-app>` — leaving `seed` set reruns genesis every boot (no automatic wipe). Set `PEER_SYNC_STORAGE=pglite` (local) or `postgres` + `PEER_SYNC_DB_URL` (deploy). `SEED_VIBES` defaults to `all` (includes quickjs). **Full reset:** wipe Postgres, PGlite, and/or Tigris manually, then deploy/restart with `PEER_SYNC_MODE=seed` if you need a fresh genesis. Registry changes ship with new deploys; regenerate `libs/maia-universe` registry locally with `bun universe:registry` before commit.
3. **Test mode sign-in**: With `VITE_AVEN_TEST_MODE=true` in `.env`, the sign-in page shows a "SIGN IN / REGISTER WITH TEST AVEN" button that bypasses WebAuthn passkeys.
4. **Guardian timeout on first run**: The sync server logs `Failed to add guardian: Timeout waiting for CoValue...` on first seed. This is expected — the test account isn't an existing peer yet. It does not block functionality.
5. **RED_PILL_API_KEY**: Without this key, the LLM chat proxy (`/api/v0/llm/chat`) returns 500. The rest of the app works fine without it.
6. **InvalidSignature in console**: After regenerating credentials (`bun agent:generate`), wiping storage and reseeding, or schema migrations, the browser may have cached data signed by old sessions. Clear site data (DevTools → Application → Storage → Clear site data) for the app origin to remove the noise. The app continues to work; invalid transactions are skipped.
