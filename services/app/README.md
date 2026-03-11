# App Service

The main UI service for MaiaOS, featuring:
- **Database Inspector** at `/` (root) - Explore Jazz CoValues with authentication
- **Dynamic Aven Rendering** - Load and render avens dynamically (e.g., Todos Aven via navigation)

## Structure

```
services/app/
├── index.html          # Main app (database inspector)
├── main.js             # Main app logic
├── db-view.js          # Database viewer and dynamic aven renderer
├── voice.js            # Voice page (real-time speech-to-text)
└── # Avens live in libs/maia-avens/ (todos, chat, sparks, etc.)
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
  - Includes dynamic aven rendering - navigate to "Todos" in the sidebar to load avens dynamically

## Architecture

### Dynamic Aven Rendering

Avens are loaded dynamically within the main maia app. When a user navigates to an aven (e.g., "Todos" in the sidebar), the app:

1. Calls `loadAven('todos')` which sets `currentAven = 'todos'`
2. Renders a container div in the main view area
3. Calls `maia.loadAvenFromAccount('todos', container)` to load the aven from `account.registries.sparks[°Maia].avens`
4. The aven renders inline within the database inspector interface

**Example:**
```javascript
// In services/maia/main.js
async function loadAven(avenKey) {
  currentAven = avenKey;
  await renderAppInternal(); // Renders aven container
  // db-view.js handles actual aven loading via maia.loadAvenFromAccount()
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
