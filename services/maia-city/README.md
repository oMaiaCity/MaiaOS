# Maia City Service

The main UI service for MaiaOS, featuring:
- **Database Inspector** at `/` (root) - Explore Jazz CoValues with authentication
- **Todos Vibe Example** at `/vibes/todos.html` - Full-stack JSON DSL compositor demo

## Structure

```
services/maia-city/
├── index.html          # Main app (database inspector)
├── main.js             # Main app logic
├── vibes/
│   ├── todos.html      # Todos vibe entry point
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

- `@MaiaOS/core` - Core functionality (Jazz, auth)
- `@MaiaOS/db` - Database utilities
- `@MaiaOS/script` - MaiaScript engine (Actor system, DSL)

## Development

```bash
# From root
bun dev

# Or directly
cd services/maia-city
bun run dev
```

Server runs on **http://localhost:4200**

## Routes

- **/** - Database inspector (requires passkey auth)
- **/vibes/todos.html** - Todos example (no auth required)

## Architecture

### Clean Import Pattern

The todos example demonstrates clean import/export pattern:

**maia-script exports:**
```javascript
// libs/maia-script/src/index.js
export { MaiaOS } from "./o/kernel.js";
export { ActorEngine, ViewEngine, StyleEngine, ... } from "./o/engines/...";
```

**maia-city imports:**
```javascript
// services/maia-city/vibes/todos.html
import { MaiaOS } from '@MaiaOS/script';
const os = await MaiaOS.boot({ ... });
```

**Vite resolves** `@MaiaOS/script` to `../../libs/maia-script/src/index.js` via `vite.config.js`.

### Tools Path

Tools are loaded from the maia-script package. The ToolEngine resolves paths relative to the HTML file location, so we use `/vibes/todos` as the base and it will find tools in the maia-script package via Vite's module resolution.

## Port

- **4200** (hardcoded in vite.config.js)
