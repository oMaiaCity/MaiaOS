# maia-vibes: Vibe Package System

## Overview

The `@MaiaOS/vibes` package contains pre-built vibe configurations (`.maia` files) for MaiaOS applications. Think of it as a library of ready-to-use app templates that you can load and run immediately.

**What it is:**
- ✅ **Vibe registry** - Pre-loaded vibe configurations as ES modules
- ✅ **Vibe loaders** - Convenience functions to boot and load vibes
- ✅ **Example apps** - Reference implementations (Todos, MyData, MaiaAgent)

**What it isn't:**
- ❌ **Not the loader** - Boot process is in `@MaiaOS/loader`
- ❌ **Not the vibe system** - Vibe concept is documented in creator docs
- ❌ **Not a build tool** - Vibes are just JSON configs, no compilation needed

---

## The Simple Version

Think of `maia-vibes` like a library of app templates:

- **Vibe Registry** = The catalog (lists all available vibes)
- **Vibe Loader** = The installer (loads and boots a vibe)
- **Vibe Configs** = The templates (pre-built `.maia` files)

**Analogy:**
Imagine you're building a house:
- Vibes are like pre-designed house plans (blueprints)
- The registry is like a catalog showing all available plans
- The loader is like a contractor who reads the plan and builds the house

---

## Package Structure

```
libs/maia-vibes/src/
├── index.js                    # Main exports (loaders, registries)
├── loader.js                   # createVibeLoader factory
├── seeding.js                  # buildSeedConfig, getAllVibeRegistries, filterVibesForSeeding
├── todos/                      # Todos vibe
│   ├── manifest.vibe.maia     # Vibe manifest
│   ├── loader.js              # loadTodosVibe
│   ├── registry.js            # TodosVibeRegistry
│   ├── index.html             # Example launcher
│   └── intent/                # Intent actor (entry point)
│       ├── intent.actor.maia
│       ├── intent.context.maia
│       ├── intent.process.maia
│       └── intent.view.maia
├── sparks/                     # Sparks vibe
├── chat/                       # Chat vibe
├── paper/                      # Paper vibe
├── profile/                    # Profile vibe
├── logs/                       # Logs vibe
├── humans/                     # Humans (Registries) vibe
└── quickjs/                   # QuickJS vibe
```

---

## Key Components

### 1. Vibe Registry

Pre-loads all `.maia` configs as ES module imports. No runtime file loading needed.

**What it does:**
- Imports all vibe configs at build time
- Exports structured registry object
- Provides vibe manifest and all actor/view/context/state configs

**Example:**
```javascript
// todos/registry.js
import vibe from './manifest.vibe.maia';
import agentActor from './agent/agent.actor.maia';
import agentView from './agent/agent.view.maia';
// ... more imports

export const TodosVibeRegistry = {
  vibe: vibe,
  actors: {
    '@todos/actor/agent': agentActor,
    // ... more actors
  },
  views: {
    '@todos/view/agent': agentView,
    // ... more views
  },
  // ... contexts, states, inboxes, styles
};
```

**See:** `libs/maia-vibes/src/todos/registry.js`

### 2. Vibe Loader

Convenience function that boots MaiaOS and loads a vibe.

**What it does:**
- Authenticates user (or reuses existing session)
- Boots MaiaOS with CoJSON backend
- Loads vibe from account.vibes.{vibeKey}
- Returns vibe metadata and root actor

**Example:**
```javascript
import { loadTodosVibe } from '@MaiaOS/vibes/todos/loader';

const container = document.getElementById('app');
const { os, vibe, actor } = await loadTodosVibe(container);

console.log('Vibe loaded:', vibe.name);
console.log('Actor ready:', actor.id);
```

**See:** `libs/maia-vibes/src/todos/loader.js`

### 3. Vibe Manifest

The vibe manifest (`manifest.vibe.maia`) defines the app metadata and entry point.

**Structure:**
```json
{
  "$factory": "°Maia/factory/vibe",
  "$id": "°Maia/vibe/todos",
  "name": "Todos",
  "description": "Complete todo list with state machines and AI tools",
  "actor": "°Maia/todos/actor/intent"
}
```

**Fields:**
- `$factory` - Factory reference (`°Maia/factory/vibe`)
- `$id` - Unique vibe identifier (`°Maia/vibe/todos`)
- `name` - Display name
- `description` - Brief description
- `actor` - Reference to entry-point actor (e.g. `°Maia/todos/actor/intent`)

---

## How It Works

### The Loading Flow

```
1. Import Loader
   └─> import { loadTodosVibe } from '@MaiaOS/vibes/todos/loader'

2. Call Loader
   └─> loadTodosVibe(container)
   └─> Checks for existing MaiaOS session
   └─> If none, authenticates and boots MaiaOS
   └─> Loads vibe from account.vibes.todos

3. Vibe Loaded
   └─> Returns { os, vibe, actor }
   └─> Actor is ready to use
```

### The Registry Flow

```
1. Build Time
   └─> All .maia files imported as ES modules
   └─> Registry object created with all configs

2. Runtime
   └─> Registry passed to MaiaOS.boot()
   └─> Kernel seeds configs to database (if needed)
   └─> Configs available via database operations

3. Loading
   └─> Kernel loads vibe from account.vibes.{key}
   └─> Creates root actor from vibe.actor reference
```

---

## Common Patterns

### Loading a Vibe

```javascript
import { loadTodosVibe } from '@MaiaOS/vibes/todos/loader';

const container = document.getElementById('app');
const { os, vibe, actor } = await loadTodosVibe(container);
```

### Available Loaders

- `loadTodosVibe` - Todos vibe (`@MaiaOS/vibes/todos/loader`)
- `loadSparksVibe` - Sparks vibe

### Getting All Vibe Registries

```javascript
import { getAllVibeRegistries } from '@MaiaOS/vibes';

const registries = await getAllVibeRegistries();
// Returns: [{ vibe: {...}, actors: {...}, ... }, ...]
```

### Using Registry Directly

```javascript
import { TodosVibeRegistry } from '@MaiaOS/vibes/todos/registry';

// Boot MaiaOS with registry (seeds vibe configs)
const os = await MaiaOS.boot({
  node,
  account,
  modules: ['db', 'core'],
  registry: TodosVibeRegistry  // Optional: seeds vibe configs during boot
});

// Load vibe by key
const { vibe, actor } = await os.loadVibeFromAccount('todos', container);
```

---

## Integration Points

### With maia-loader

The `maia-loader` package uses vibes for:
- Loading apps from account.vibes
- Seeding vibe configs during boot (if needed)
- Creating root actors from vibe manifests

**See:** `libs/maia-loader/src/loader.js`

### With maia-engines

The `maia-engines` package uses vibes for:
- Loading actor configs from database
- Creating actors from vibe registries
- Executing vibe state machines

**See:** `libs/maia-engines/src/engines/actor.engine.js`

---

## Key Concepts

### Vibe Structure

Every vibe follows this structure:

```
vibe-name/
├── manifest.vibe.maia      # Vibe manifest (required)
├── loader.js               # Vibe loader (optional, convenience)
├── registry.js             # Vibe registry (required for seeding)
├── index.html              # Example launcher (optional)
└── intent/                 # Entry-point actor (convention: intent/)
    ├── intent.actor.maia
    ├── intent.context.maia
    ├── intent.process.maia
    └── intent.view.maia
```

**Note:** Actor naming uses `intent` as the entry-point convention. Inbox is derived by convention from actor `$id`.

**See:** [Creator Docs: Vibes](../../02_creators/01-vibes.md) for details

---

## Available Vibes

### Todos Vibe

A complete todo list application.

**Features:**
- Todo CRUD operations
- State machine-based state management
- AI tools integration

**Load:**
```javascript
import { loadTodosVibe } from '@MaiaOS/vibes/todos/loader';
```

### Sparks Vibe

Sparks management and layout.

**Load:**
```javascript
import { loadSparksVibe } from '@MaiaOS/vibes';
```

### Other Vibes

- **chat** - Chat interface
- **paper** - Paper/document editing
- **profile** - Profile management
- **logs** - Logs / diagnostics interface
- **humans** - Humans (Registries) view
- **quickjs** - QuickJS Add tool

Registries for these are exported from `getAllVibeRegistries()`. Loaders can be created via `createVibeLoader(vibeKey, Registry, modules)`.

---

## Creating a New Vibe

### Step 1: Create Directory Structure

```
my-vibe/
├── manifest.vibe.maia
├── loader.js
├── registry.js
├── index.html
└── intent/
    ├── intent.actor.maia
    ├── intent.context.maia
    ├── intent.process.maia
    └── intent.view.maia
```

### Step 2: Create Vibe Manifest

**`manifest.vibe.maia`:**
```json
{
  "$factory": "°Maia/factory/vibe",
  "$id": "°Maia/vibe/my-vibe",
  "name": "My Vibe",
  "description": "A description of my vibe",
  "actor": "°Maia/my-vibe/actor/intent"
}
```

### Step 3: Create Registry

**`registry.js`:**
```javascript
import vibe from './manifest.vibe.maia';
import intentActor from './intent/intent.actor.maia';
import intentView from './intent/intent.view.maia';
// ... more imports

export const MyVibeRegistry = {
  vibe: vibe,
  actors: {
    '°Maia/my-vibe/actor/intent': intentActor,
  },
  views: {
    '°Maia/my-vibe/view/intent': intentView,
  },
  // ... contexts, processes, styles
};
```

### Step 4: Create Loader

**`loader.js`:**
```javascript
import { createVibeLoader } from '../loader.js';
import { MyVibeRegistry } from './registry.js';

export const loadMyVibe = createVibeLoader('my-vibe', MyVibeRegistry, ['db', 'core']);
export { MaiaOS } from '../loader.js';
export { MyVibeRegistry } from './registry.js';
```

**Note:** `createVibeLoader` handles auth (signInWithPasskey), boot, and loadVibeFromAccount. Pass `registry` to `MaiaOS.boot()` when creating a new session so vibe configs are seeded.

### Step 5: Export from Package

**`src/index.js`:**
```javascript
export { loadMyVibe, MyVibeRegistry } from './my-vibe/loader.js';
```

---

## Troubleshooting

### Problem: "Vibe not found in account.vibes"

**Solution:** Make sure the vibe is seeded to the account:
```javascript
// During boot, registry is automatically seeded
const os = await MaiaOS.boot({
  registry: MyVibeRegistry
});
```

### Problem: "Failed to load actor"

**Solution:** Check that the actor reference in vibe manifest exists:
```json
{
  "actor": "@my-vibe/actor/agent"  // Must match actor $id in registry
}
```

### Problem: "Registry not found"

**Solution:** Make sure registry is exported from package. Package exports `./todos/loader` and `./todos/registry`; add similar for custom vibes.

---

## Related Documentation

- [Creator Docs: Vibes](../../02_creators/01-vibes.md) - How to use vibes as a creator
- [maia-loader Package](../02_maia-loader/README.md) - Boot process and vibe loading
- [maia-engines Package](../04_maia-engines/README.md) - Actor execution engines

---

## Source Files

- Main entry: `libs/maia-vibes/src/index.js`
- Loader factory: `libs/maia-vibes/src/loader.js`
- Todos vibe: `libs/maia-vibes/src/todos/`
- Sparks vibe: `libs/maia-vibes/src/sparks/`
- Package exports: `./todos/loader`, `./todos/registry`, `./seeding`
