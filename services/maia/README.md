# Maia Service

The main UI service for MaiaOS, featuring:
- **Database Inspector** at `/` (root) - Explore Jazz CoValues with authentication
- **Dynamic Vibe Rendering** - Load and render vibes dynamically (e.g., Todos Vibe via navigation)

## Structure

```
services/maia/
├── index.html          # Main app (database inspector)
├── main.js             # Main app logic
├── db-view.js          # Database viewer and dynamic vibe renderer
├── vibes/
│   └── todos/          # Todos vibe components
│       ├── todos.vibe.maia
│       ├── brand.style.maia
│       ├── todo.style.maia
│       ├── vibe/       # Vibe actor files
│       ├── composite/  # Composite actor files
│       ├── list/       # List actor files
│       ├── list-item/  # List item actor files
│       └── kanban/     # Kanban actor files
└── css/                # Global styles

```

## Dependencies

- `@MaiaOS/kernel` - Kernel functionality (Jazz, auth)
- `@MaiaOS/db` - Database utilities
- `@MaiaOS/script` - MaiaScript engine (Actor system, DSL)

## Development

```bash
# From root
bun dev

# Or directly
cd services/maia
bun run dev
```

Server runs on **http://localhost:4200**

**Note**: In dev mode, maia uses source files directly (not bundles) for proper Vite hot module reload (HMR). This means changes to kernel or vibes source files will automatically trigger HMR without manual bundle rebuilding.

## Routes

- **/** - Database inspector (requires passkey auth)
  - Includes dynamic vibe rendering - navigate to "Todos Vibe" in the sidebar to load vibes dynamically

## Architecture

### Dynamic Vibe Rendering

Vibes are loaded dynamically within the main maia app. When a user navigates to a vibe (e.g., "Todos Vibe" in the sidebar), the app:

1. Calls `loadVibe('todos')` which sets `currentVibe = 'todos'`
2. Renders a container div in the main view area
3. Calls `maia.loadVibeFromAccount('todos', container)` to load the vibe from the account's vibes registry
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

**maia-kernel exports:**
```javascript
// libs/maia-kernel/src/index.js
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
import { MaiaOS } from '@MaiaOS/kernel';
const os = await MaiaOS.boot({ node, account });
```

**Vite resolves imports** via `vite.config.js`:
- **Dev mode**: Points to source files directly (`../../libs/maia-kernel/src/index.js`) for proper HMR
- **Production builds**: Points to bundled files (`../../libs/maia-kernel/dist/maia-kernel.es.js`) for optimized builds

Production builds automatically create bundles before building via the `build` script.

## Port

- **4200** (hardcoded in vite.config.js)
