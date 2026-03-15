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

- `@MaiaOS/loader` (via maia-distros) - MaiaOS kernel, auth
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
3. Calls `maia.loadVibeFromAccount('todos', container)` to load the vibe from `account.registries.sparks[°Maia].vibes`
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

**maia-loader exports:**
```javascript
// libs/maia-loader/src/index.js
export { MaiaOS } from "./kernel.js";
```

**maia-script exports:**
```javascript
// libs/maia-script/src/index.js
export { ActorEngine, ViewEngine, StyleEngine, ... } from "./engines/...";
```

**maia imports:**
```javascript
// services/app/main.js
import { MaiaOS } from '@MaiaOS/loader';
const os = await MaiaOS.boot({ node, account });
```

**Bun resolves imports** via `jsconfig.build.json`:
- **Dev mode**: Source files served directly for HMR
- **Production builds**: maia-distros bundles (maia-client.mjs, avens.mjs)

Production builds run `distros:build` then `bun build.js`.

## Port

- **4200** (maia static server). Moai at **4201** (sync/API) — client connects directly via CORS.
