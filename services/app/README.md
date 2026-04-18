# App Service

The main UI service for MaiaOS, featuring:
- **Database Inspector** at `/` (root) - Explore Jazz CoValues with authentication
- **Dynamic Vibe Rendering** - Load and render vibes dynamically (e.g., Todos Vibe via navigation)

## Structure

```
services/app/
├── index.html          # Main app (database inspector)
├── main.js             # Main app logic
├── db-view.js          # Database viewer and dynamic vibe renderer
├── voice.js            # Voice page (real-time speech-to-text)
└── # Vibes live in libs/maia-vibes/ (todos, chat, sparks, etc.)
└── css/                # Global styles

```

## Dependencies

- `@MaiaOS/runtime` (via maia-distros) - engines + MaiaOS kernel, auth
- `@MaiaOS/maia-distros` - Pre-built bundles (maia-client.mjs, avens.mjs)

## Development

```bash
# From root
bun dev

# Or directly
cd services/app
bun run dev
```

Server runs on **http://localhost:4200**

**Note**: In dev mode, app uses source files directly (not bundles) for Bun HMR. Client connects directly to sync (4201) for sync/API — no proxy.

## Routes

- **/** - Landing (or redirect to signin/me)
- **/signin**, **/signup** - Authentication
- **/me**, **/dashboard** - Database inspector (requires passkey auth)
  - Includes dynamic vibe rendering - navigate to "Todos" in the sidebar to load vibes dynamically

## Architecture

### Dynamic Vibe Rendering

Vibes are loaded dynamically within the main maia app. When a user navigates to a vibe (e.g., "Todos" in the sidebar), the app:

1. Calls `loadVibe('todos')` which sets `currentVibe = 'todos'`
2. Renders a container div in the main view area
3. Calls `maia.loadVibeFromAccount('todos', container)` to load the vibe from `account.sparks[°maia].os.vibes`
4. The vibe renders inline within the database inspector interface

**Example:**
```javascript
// In services/maia/main.js
async function loadVibe(vibeKey) {
  currentVibe = vibeKey;
  await renderAppInternal(); // Renders vibe container
  // db-view.js handles actual vibe loading via maia.loadVibeFromAccount()
}
```

### Clean Import Pattern

**@MaiaOS/runtime** exports `MaiaOS`, engines, db helpers, and auth — see [`libs/maia-runtime/src/index.js`](../../libs/maia-runtime/src/index.js).

**maia imports:**
```javascript
// services/app/main.js
import { MaiaOS } from '@MaiaOS/runtime';
const os = await MaiaOS.boot({ node, account });
```

**Bun resolves imports** via `jsconfig.build.json`:
- **Dev mode**: Source files served directly for HMR
- **Production builds**: maia-distros bundles (maia-client.mjs, avens.mjs)

Production builds run `distros:build` then `bun build.js`.

## Port

- **4200** (app static server). **Sync** at **4201** (WebSocket + API) — client connects directly via CORS.

## Tauri desktop (macOS)

Native shell in `src-tauri/` loads the same SPA from `http://localhost:4200` in dev or from `dist/` when built.

- **Rust**: `rustup toolchain install 1.88.0` (see `src-tauri/rust-toolchain.toml`)
- **Dev**: from repo root, `bun run dev:desktop` (starts `bun dev` then `tauri dev`), or run `bun dev` in one terminal and `cd services/app && bun run tauri:dev` in another after the app is up on 4200
- **Build**: `bun run build:desktop` (runs `bun run build` in `services/app` then `tauri build`)

Passkeys on desktop use `libs/maia-tauri-plugin-passkey` (native `ASAuthorizationController` + PRF). AASA uses Team ID `2P6VCHVJWB`; sign the app for production.
