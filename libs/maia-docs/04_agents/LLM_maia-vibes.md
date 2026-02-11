# MaiaOS Documentation for maia-vibes

**Auto-generated:** 2026-02-11T19:56:06.985Z
**Purpose:** Complete context for LLM agents working with MaiaOS

---

# README

*Source: developers/README.md*

# maia-vibes: Vibe Package System

## Overview

The `@MaiaOS/vibes` package contains pre-built vibe configurations (`.maia` files) for MaiaOS applications. Think of it as a library of ready-to-use app templates that you can load and run immediately.

**What it is:**
- ✅ **Vibe registry** - Pre-loaded vibe configurations as ES modules
- ✅ **Vibe loaders** - Convenience functions to boot and load vibes
- ✅ **Example apps** - Reference implementations (Todos, MyData, MaiaAgent)

**What it isn't:**
- ❌ **Not the kernel** - Boot process is in `@MaiaOS/kernel`
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
├── todos/                      # Todos vibe
│   ├── manifest.vibe.maia     # Vibe manifest
│   ├── loader.js              # Vibe loader function
│   ├── registry.js            # Vibe registry (pre-loaded configs)
│   ├── index.html             # Example launcher HTML
│   ├── agent/                 # Agent service actor
│   │   ├── agent.actor.maia
│   │   ├── agent.context.maia
│   │   ├── agent.state.maia
│   │   ├── agent.view.maia
│   │   ├── agent.inbox.maia
│   │   └── brand.style.maia
│   ├── list/                  # List UI actor
│   └── logs/                  # Logs UI actor
├── my-data/                    # MyData vibe
│   └── ... (similar structure)
└── maia-agent/                # MaiaAgent vibe
    └── ... (similar structure)
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
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A complete todo list application",
  "actor": "@todos/actor/agent"
}
```

**Fields:**
- `$schema` - Schema reference (`@schema/vibe`)
- `$id` - Unique vibe identifier (`@vibe/todos`)
- `name` - Display name for marketplace
- `description` - Brief description
- `actor` - Reference to agent service actor (entry point)

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

### Getting All Vibe Registries

```javascript
import { getAllVibeRegistries } from '@MaiaOS/vibes';

const registries = await getAllVibeRegistries();
// Returns: [{ vibe: {...}, actors: {...}, ... }, ...]
```

### Using Registry Directly

```javascript
import { TodosVibeRegistry } from '@MaiaOS/vibes/todos/registry';

// Boot MaiaOS with registry
const os = await MaiaOS.boot({
  registry: TodosVibeRegistry
});

// Load vibe
const { vibe, actor } = await os.loadVibeFromAccount('todos', container);
```

---

## Integration Points

### With maia-kernel

The `maia-kernel` package uses vibes for:
- Loading apps from account.vibes
- Seeding vibe configs during boot (if needed)
- Creating root actors from vibe manifests

**See:** `libs/maia-kernel/src/kernel.js`

### With maia-script

The `maia-script` package uses vibes for:
- Loading actor configs from database
- Creating actors from vibe registries
- Executing vibe state machines

**See:** `libs/maia-script/src/engines/actor.engine.js`

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
└── [actors]/               # Actor directories
    ├── [actor].actor.maia
    ├── [actor].context.maia
    ├── [actor].state.maia
    ├── [actor].view.maia
    ├── [actor].inbox.maia
    └── brand.style.maia    # Shared brand style
```

### Agent-First Pattern

**Every vibe MUST have an "agent" service actor** as its entry point.

**Structure:**
```
Vibe → Agent (Service Actor) → Composite Actor → UI Actors
```

**Why:**
- Clear separation of concerns (service logic vs. UI)
- Scalable architecture (add UI actors as needed)
- Message-based communication (loose coupling)
- Consistent structure across all vibes

**See:** [Creator Docs: Vibes](../../02_creators/01-vibes.md) for details

---

## Available Vibes

### Todos Vibe

A complete todo list application with drag-and-drop kanban view.

**Features:**
- Todo CRUD operations
- Drag-and-drop organization
- Multiple views (list, kanban)
- State machine-based state management

**Load:**
```javascript
import { loadTodosVibe } from '@MaiaOS/vibes/todos/loader';
```

### MyData Vibe

A data management application for viewing and editing structured data.

**Features:**
- Table view for data
- Detail view for editing
- Schema-based validation

**Load:**
```javascript
import { loadMyDataVibe } from '@MaiaOS/vibes/my-data/loader';
```

### MaiaAgent Vibe

An AI agent interface for LLM interactions.

**Features:**
- Chat interface
- LLM integration (RedPill API)
- Conversation history

**Load:**
```javascript
import { loadMaiaAgentVibe } from '@MaiaOS/vibes/maia-agent/loader';
```

---

## Creating a New Vibe

### Step 1: Create Directory Structure

```
my-vibe/
├── manifest.vibe.maia
├── loader.js
├── registry.js
├── index.html
└── agent/
    ├── agent.actor.maia
    ├── agent.context.maia
    ├── agent.state.maia
    ├── agent.view.maia
    ├── agent.inbox.maia
    └── brand.style.maia
```

### Step 2: Create Vibe Manifest

**`manifest.vibe.maia`:**
```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/my-vibe",
  "name": "My Vibe",
  "description": "A description of my vibe",
  "actor": "@my-vibe/actor/agent"
}
```

### Step 3: Create Registry

**`registry.js`:**
```javascript
import vibe from './manifest.vibe.maia';
import agentActor from './agent/agent.actor.maia';
import agentView from './agent/agent.view.maia';
// ... more imports

export const MyVibeRegistry = {
  vibe: vibe,
  actors: {
    '@my-vibe/actor/agent': agentActor,
  },
  views: {
    '@my-vibe/view/agent': agentView,
  },
  // ... contexts, states, inboxes, styles
};
```

### Step 4: Create Loader

**`loader.js`:**
```javascript
import { MaiaOS, signInWithPasskey } from '@MaiaOS/kernel';
import { MyVibeRegistry } from './registry.js';

export async function loadMyVibe(container) {
  // Check for existing session
  let os;
  if (window.maia && window.maia.id && window.maia.id.node) {
    os = window.maia;
  } else {
    const { node, account } = await signInWithPasskey({ salt: "maia.city" });
    os = await MaiaOS.boot({
      node,
      account,
      modules: ['db', 'core'],
      registry: MyVibeRegistry
    });
  }
  
  const { vibe, actor } = await os.loadVibeFromAccount('my-vibe', container);
  return { os, vibe, actor };
}

export { MaiaOS, MyVibeRegistry };
```

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

**Solution:** Make sure registry is exported from package:
```javascript
// src/index.js
export { MyVibeRegistry } from './my-vibe/registry.js';
```

---

## Related Documentation

- [Creator Docs: Vibes](../../02_creators/01-vibes.md) - How to use vibes as a creator
- [maia-kernel Package](../02_maia-kernel/README.md) - Boot process and vibe loading
- [maia-script Package](../04_maia-script/README.md) - Actor execution engines

---

## Source Files

- Main entry: `libs/maia-vibes/src/index.js`
- Todos vibe: `libs/maia-vibes/src/todos/`
- MyData vibe: `libs/maia-vibes/src/my-data/`
- MaiaAgent vibe: `libs/maia-vibes/src/maia-agent/`

---

