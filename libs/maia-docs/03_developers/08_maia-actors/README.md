# maia-actors: Actor Registry and Definitions

## Overview

The `@MaiaOS/actors` package provides a centralized registry for all MaiaScript actor functions. Think of it as a catalog where all executable actors are stored, organized, and ready to use.

**What it is:**
- ✅ **Actor registry** - Central catalog of all available actor functions
- ✅ **Actor definitions** - JSON schema definitions for each actor
- ✅ **Actor implementations** - JavaScript functions that execute actors

**What it isn't:**
- ❌ **Not the execution engine** - Actor execution is in `maia-engines` (ProcessEngine, ActorEngine)
- ❌ **Not actor registration** - Actors are referenced by modules in `maia-engines` registry
- ❌ **Not business logic** - Actors are generic, reusable operations

**Inbox-based invocation:** Actors receive events via their inbox CoStream. Use `sendEvent` action in state machines to deliver events to any actor. Actors with `function` defined run their code when the state machine triggers `{"function": true}`.

---

## Package Structure

```
libs/maia-actors/src/
├── index.js                    # Main exports (ACTORS, getActor, getAllActorDefinitions, getSeedConfig)
├── seed-config.js              # Service actor seeding (actors, states; inboxes derived from actors)
├── os/                         # OS-level actors
│   ├── ai/                     # AI chat (actor.maia, function.js)
│   └── db/                     # DB operations (actor.maia, function.js)
├── services/                   # Service actors
│   ├── names/                  # computeMessageNames
│   ├── paper/                  # updatePaperContent
│   ├── profile-image/
│   ├── todos/
│   └── update-wasm-code/
├── views/                      # Layout actors (headless intent pattern)
│   ├── tabs/, sparks/, grid/, layout-chat/, layout-paper/, input/
│   └── ...
```

---

## Key Components

### 1. Actor Registry

Central registry that maps namespace paths to actor definitions and functions.

```javascript
export const ACTORS = {
  'maia/services/ai': { definition: aiDef, function: aiFn },
  'maia/services/db': { definition: dbDef, function: dbFn },
  'maia/services/names': { definition: namesDef, function: namesFn },
  // ...
};

export function getActor(namespacePath) {
  return ACTORS[namespacePath] || null;
}

export function getAllActorDefinitions() {
  const definitions = {};
  for (const [path, actor] of Object.entries(ACTORS)) {
    definitions[path] = actor.definition;
  }
  return definitions;
}
```

### 2. Actor Definition (.actor.maia)

JSON schema that describes what an actor does and what parameters it needs.

### 3. Actor Function (.function.js)

JavaScript function that executes the actor logic.

```javascript
export default {
  async execute(actor, payload) {
    // Actor logic here
    return result;
  }
};
```

---

## Usage

### Getting an Actor

```javascript
import { getActor } from '@MaiaOS/actors';

const actor = getActor('maia/services/db');
// Returns: { definition: {...}, function: execute(...) }

// Single-part lookup: getActor('db') resolves to 'maia/services/db'
```

### Getting All Actor Definitions

```javascript
import { getAllActorDefinitions } from '@MaiaOS/actors';

const definitions = getAllActorDefinitions();
// Returns: { 'maia/services/db': {...}, 'maia/services/names': {...}, ... }
// Used for seeding actor definitions into database
```

---

## Available Actors

### Services (including core AI / DB)

- **`maia/services/db`** - Unified API for query, create, update, delete, spark operations
- **`maia/services/ai`** - Unified AI chat using OpenAI-compatible API (RedPill)
- **`maia/services/names`** - Computes message names from context
- **`maia/services/paper`** - Updates paper content
- **`maia/services/profile-image`** - Profile image handling
- **`maia/services/todos`** - Todos service (definition only)
- **`maia/services/update-wasm-code`** - WASM code updates

---

## Creating a New Actor

### Step 1: Create Actor Definition

**`src/my-namespace/myActor.actor.maia`**

### Step 2: Create Actor Function

**`src/my-namespace/myActor.function.js`**

### Step 3: Register in Index

**`src/index.js`:**
```javascript
import myActorDef from './services/my-actor/actor.maia';
import myActorFn from './services/my-actor/function.js';

export const ACTORS = {
  // ... existing
  'maia/actor/services/myActor': { definition: myActorDef, function: myActorFn },
};
```

### Step 4: Add to Module

Actors are referenced by modules in `libs/maia-runtime/src/modules/registry.js`. The db and ai modules reference `@maia/actor/services/db` and `@maia/actor/services/ai`. To add a new tool, extend the registry's BUILTIN_MODULES or add a custom module that references your actor path.

---

## Related Documentation

- [maia-engines: ProcessEngine](../04_maia-engines/engines/) - How actors are executed
- [maia-engines: Modules](../04_maia-engines/modules.md) - How modules reference actors
