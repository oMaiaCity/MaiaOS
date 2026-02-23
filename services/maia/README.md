# Maia Service

The main UI service for MaiaOS, featuring:
- **Database Inspector** at `/` (root) - Explore Jazz CoValues with authentication
- **Dynamic Agent Rendering** - Load and render agents dynamically (e.g., Todos Agent via navigation)

## Structure

```
services/maia/
├── index.html          # Main app (database inspector)
├── main.js             # Main app logic
├── db-view.js          # Database viewer and dynamic agent renderer
├── voice.js            # Voice page (real-time speech-to-text)
└── # Agents live in libs/maia-agents/ (todos, chat, sparks, etc.)
└── css/                # Global styles

```

## Dependencies

- `@MaiaOS/loader` (via maia-distros) - MaiaOS kernel, auth
- `@MaiaOS/maia-distros` - Pre-built bundles (maia-client.mjs, agents.mjs)
- `@MaiaOS/maia-voice` - On-device speech-to-text for the /voice route

## Development

```bash
# From root
bun dev

# Or directly
cd services/maia
bun run dev
```

Server runs on **http://localhost:4200**

**Note**: In dev mode, maia uses source files directly (not bundles) for Bun HMR. Client connects directly to moai (4201) for sync/API — no proxy.

## Routes

- **/** - Landing (or redirect to signin/me)
- **/signin**, **/signup** - Authentication
- **/me**, **/dashboard** - Database inspector (requires passkey auth)
  - Includes dynamic agent rendering - navigate to "Todos" in the sidebar to load agents dynamically
- **/voice** - Real-time speech-to-text (requires passkey auth)
  - On-device transcription via MoonshineJS; Start/Stop buttons, live transcript display

## Architecture

### Dynamic Agent Rendering

Agents are loaded dynamically within the main maia app. When a user navigates to an agent (e.g., "Todos" in the sidebar), the app:

1. Calls `loadAgent('todos')` which sets `currentAgent = 'todos'`
2. Renders a container div in the main view area
3. Calls `maia.loadAgentFromAccount('todos', container)` to load the agent from `account.registries.sparks[°Maia].agents`
4. The agent renders inline within the database inspector interface

**Example:**
```javascript
// In services/maia/main.js
async function loadAgent(agentKey) {
  currentAgent = agentKey;
  await renderAppInternal(); // Renders agent container
  // db-view.js handles actual agent loading via maia.loadAgentFromAccount()
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
// services/maia/main.js
import { MaiaOS } from '@MaiaOS/loader';
const os = await MaiaOS.boot({ node, account });
```

**Bun resolves imports** via `jsconfig.build.json`:
- **Dev mode**: Source files served directly for HMR
- **Production builds**: maia-distros bundles (maia-client.mjs, agents.mjs)

Production builds run `distros:build` then `bun build.js`.

## Port

- **4200** (maia static server). Moai at **4201** (sync/API) — client connects directly via CORS.
