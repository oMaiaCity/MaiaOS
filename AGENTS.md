# AGENTS.md

## Git: PRs into `next` (required)

Pull requests that merge a feature branch (for example `samuel/next`) into **`next`** must be **rebased on the latest `origin/next`** before review and merge. **Do not** rely on an outdated base or a plain merge of `next` into your branch if policy expects a linear, up-to-date history on top of `next`.

**Workflow:**

1. `git fetch origin`
2. `git checkout <your-branch>`  (e.g. `samuel/next`)
3. `git rebase origin/next` — resolve conflicts, then `git rebase --continue` until done
4. If the branch was already on the remote: `git push --force-with-lease origin <your-branch>`

**Check:** your branch’s commits should sit **on top of** the current `next` tip (`git log origin/next..HEAD` should show only your work).

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

- **`bun dev`** — starts app (4200) and sync (4201) in **parallel** after registry + helpers; the client retries if sync is still warming up
- **`bun run dev:desktop`** — full stack (`bun dev`) then Tauri macOS window (requires Rust 1.88+, Xcode toolchain for Swift passkey plugin). **`tauri dev` is not fully code-signed like the bundle**; native passkeys (`ASAuthorizationController`) need a **built** `.app` (see below).
- **`bun run build:desktop`** — production SPA build + Tauri `.app` bundle (signed per `src-tauri/tauri.conf.json`). **Use this build to test passkeys**, then open `services/app/src-tauri/target/release/bundle/macos/Maia City.app` (or run from Finder). Start `bun dev` (or sync only) in another terminal if the UI should talk to local sync.
- **`bun run build:desktop:debug`** — same as `build:desktop` but `tauri build --debug` (faster Rust compile); signed bundle under `target/debug/bundle/macos/`.
- **`bun run check:ci`** — lint + format check (Biome + `.maia` format)
- **`bun test`** — runs `test` in every workspace that defines it (`bun run --workspaces --if-present test`; currently `@MaiaOS/db`)
- **`bun run format`** — auto-fix formatting

### Logging policy

All application and tooling output goes through **`@MaiaOS/logs`** (`createLogger`, `createOpsLogger`, or channel helpers). **Do not call `console.*` in shipping code** — Biome `suspicious/noConsole` is enforced in CI. The only file allowed to call `console` directly is [`libs/maia-logs/src/transports/console.js`](libs/maia-logs/src/transports/console.js).

### Logging: `LOG_MODE` (browser, sync, and root `bun dev`)

Root [`.env`](.env) **`LOG_MODE`** is applied in three places:

1. **Browser SPA** — [`applyMaiaLoggingFromEnv`](libs/maia-logs/src/maia-logging-env.js) after [`/__maia_env`](services/app/dev-server.js) (see [`services/app/main.js`](services/app/main.js)). On localhost, flags are **in-memory** before boot — **not** localStorage.
2. **Sync server** — [`bootstrapNodeLogging()`](libs/maia-logs/src/logger.js) at startup of [`services/sync/src/index.js`](services/sync/src/index.js) calls [`applyLogModeFromEnv(process.env.LOG_MODE)`](libs/maia-logs/src/log-mode.js) so informational [`createOpsLogger`](libs/maia-logs/src/ops.js) **`.log()`** lines respect **`ops.*`** tokens. **`.warn` / `.error`** always emit.
3. **Root [`bun dev`](scripts/dev.js)** — loads [`boot-banner`](scripts/boot-banner.js) / `bootstrapNodeLogging` first. **Empty `LOG_MODE`**: orchestrator does **not** forward child OPS lines (quiet console); **`dev.verbose`**: full piped child streams. The green **Ready** cluster prints after sync emits **`[sync] Ready`**. Errors and warnings from children are not suppressed.

[`scripts/dev-app.js`](scripts/dev-app.js) and [`scripts/dev-sync.js`](scripts/dev-sync.js) call **`bootstrapNodeLogging()`** so the same **`LOG_MODE`** applies when those processes run.

| Token class | Examples |
|---|---|
| PERF / DEBUG / TRACE | **`perf.all`**, **`debug.app.maia-db`**, **`trace.all`** (see [`libs/maia-logs/src/log-mode.js`](libs/maia-logs/src/log-mode.js)) |
| OPS informational `.log` only | **`ops.all`**, **`ops.sync`**, **`ops.storage`** (match `createOpsLogger` subsystems case-insensitively) |
| Root orchestrator | **`dev.verbose`** — full child streams in **`bun dev`** |

**Exact `LOG_MODE` strings to “see logs again”** (add to root `.env` or prefix a one-off command):

| What you want | Value |
|---|---|
| Full Vite + sync terminal spam from **`bun dev`** (like two terminals) | `LOG_MODE=dev.verbose` (child processes still emit OPS; orchestrator forwards everything) |
| **Quiet everything** (no OPS info, no dev verbose) | `LOG_MODE=off` |
| **Default** (empty `LOG_MODE` in `.env`) — **sync / CLI** run directly: informational OPS **`.log()`** is **on** in development (`[sync] Listening…`, etc.). **Root `bun dev` orchestrator**: does **not** pipe those OPS lines to the console (use **`dev.verbose`** or **`ops.*`** to see them). **Browser SPA**: empty still means no PERF/DEBUG unless you set tokens. |
| **`[sync]`** OPS lines through **`bun dev`** without full verbose | `LOG_MODE=ops.sync` or `ops.all` |
| Browser PERF/DEBUG | e.g. `LOG_MODE=debug.app.maia-db` |

**Set in root `.env`** (or one-off: `LOG_MODE='…' bun dev:app`):

- Maia DB / capability / DB view: **`debug.app.maia-db`** or **`debug.all`**
- Perf for the same areas: **`perf.app.maia-db`** or **`perf.all`**
- Sync OPS info lines: **`ops.sync`** or **`ops.all`**
- **`bun dev`** full Vite/sync logs: **`dev.verbose`** (combine: **`ops.sync,dev.verbose`**)

General tokens (comma-separated): **`perf.all`**, **`perf.game.init`**, **`trace.all`**, **`debug.all`**, **`debug.engines.loadBinary`**, **`debug.app.cobinary`**. Colon form **`engines:pipeline`** is supported for granular PERF.

### Tauri + passkeys (macOS)

- WebAuthn in the embedded WebView is limited; native passkeys use `libs/maia-tauri-plugin-passkey` and `@MaiaOS/self` `prf-tauri.js` when `isTauri()` is true (`@tauri-apps/api/core`).
- **AASA**: `services/app/well-known/apple-app-site-association` is copied into `dist/.well-known/` on build and served in production (e.g. `https://next.maia.city/.well-known/...`). It lists `TEAM_ID.city.maia.next` for each Apple team that signs the app. The desktop app’s native passkey RP ID is **`next.maia.city`** (`Entitlements.plist` `webcredentials:next.maia.city`; `@MaiaOS/self` `prf-tauri.js`). **Team ID** must match **Membership → Team ID** in Apple Developer (or `codesign -dv --verbose=4 "Maia City.app"` → `TeamIdentifier` — do not use the short id in parentheses from Keychain if it differs). Bundle id must match `src-tauri/tauri.conf.json` `identifier` (`city.maia.next` — do not use a suffix `.app`; it conflicts with the macOS `.app` bundle extension). In **Apple Developer → Identifiers**, that App ID must have **Associated Domains** enabled and include **`webcredentials:next.maia.city`** (regenerate the macOS provisioning profile after changing domains).
- **Gatekeeper (why Finder says it cannot open):** `Apple Development`–signed `.app` bundles are **not** notarized; `spctl -a -vv` reports `rejected` for double-click from Finder. **First launch:** right-click **Maia City.app** → **Open** → confirm, or **System Settings → Privacy & Security → Open Anyway** after a blocked attempt. Copied/DMG installs: `xattr -cr "/path/to/Maia City.app"` to clear quarantine if needed. **Shipping to others:** sign with **Developer ID Application** and **notarize** (Tauri env: `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` or API key trio).

### First-time setup caveats

1. **Generate credentials before first run**: `bun agent:generate` creates `/workspace/.env` with agent + test account credentials.
2. **Seeding**: `PEER_SYNC_SEED=true` is the **only** env gate for **genesis** (scaffold missing → fail fast until set). When scaffold exists, genesis step skips; unset after one-shot deploy. **Fly / empty DB:** set `PEER_SYNC_SEED=true` for the deploy that should run genesis, then `fly secrets unset PEER_SYNC_SEED --app <sync-app>` — leaving it `true` reruns genesis every boot. **Never** auto-clears Postgres, Neon, or Tigris. **Local dev** (not production, `PEER_SYNC_STORAGE=pglite`, no `BUCKET_NAME`): sync can clear the local PGlite dir + `./binary-bucket`, regenerate Aven Tester lines in `.env`, then seed — restart the app dev server to pick up new `VITE_AVEN_TEST_*`. Set `PEER_SYNC_STORAGE=pglite` (local) or `postgres` + `PEER_SYNC_DB_URL` (deploy). `SEED_VIBES` defaults to `all` (includes quickjs). Server startup / bootstrap sequences: `@MaiaOS/flows`. **Full reset (remote):** wipe Postgres, PGlite, and/or Tigris manually when needed. Registry changes ship with new deploys; regenerate `libs/maia-universe` registry locally with `bun universe:registry` before commit.
3. **Secret key dev sign-in**: With `VITE_AVEN_TEST_MODE=true` in `.env`, the sign-in page shows a **Secret key (dev)** button — same browser app and human operator flow as passkey sign-in, but uses pre-provisioned credentials from `.env` instead of WebAuthn. (Legacy env prefix `VITE_AVEN_*`; taxonomy: [`libs/maia-docs/03_developers/account-authentication-types.md`](libs/maia-docs/03_developers/account-authentication-types.md).)
4. **Guardian timeout on first run**: The sync server logs `Failed to add guardian: Timeout waiting for CoValue...` on first seed. This is expected — the test account isn't an existing peer yet. It does not block functionality.
5. **RED_PILL_API_KEY**: Without this key, the LLM chat proxy (`/api/v0/llm/chat`) returns 500. The rest of the app works fine without it.
6. **InvalidSignature in console**: After regenerating credentials (`bun agent:generate`), wiping storage and reseeding, or schema migrations, the browser may have cached data signed by old sessions. Clear site data (DevTools → Application → Storage → Clear site data) for the app origin to remove the noise. The app continues to work; invalid transactions are skipped.
