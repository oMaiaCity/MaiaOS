# maia-actors: Actor Registry and Definitions

## Overview

The `@MaiaOS/actors` package provides a centralized registry for all MaiaScript actor functions. Think of it as a catalog where all executable actors are stored, organized, and ready to use.

**What it is:**
- ✅ **Actor registry** - Central catalog of all available actor functions
- ✅ **Actor definitions** - JSON schema definitions for each actor
- ✅ **Actor implementations** - JavaScript functions that execute actors

**What it isn't:**
- ❌ **Not the execution engine** - Actor execution is in `maia-engines` (ToolEngine, StateEngine)
- ❌ **Not actor registration** - Actors are registered by modules in `maia-engines`
- ❌ **Not business logic** - Actors are generic, reusable operations

**Inbox-based invocation:** Actors receive events via their inbox CoStream. Use `sendEvent` action in state machines to deliver events to any actor. Actors with `function` defined run their code when the state machine triggers `{"function": true}`.

---

## Package Structure

```
libs/maia-actors/src/
├── index.js                    # Main exports (ACTORS, getActor, getSeedConfig)
├── seed-config.js              # Service actor seeding (actors, states; inboxes derived from actors)
├── views/                      # Layout actors (headless intent pattern)
│   ├── headerWithViewSwitcher/  # Todos, Creator
│   ├── formWithSplit/          # Sparks
│   ├── grid/                   # Humans
│   └── modalChat/              # Chat
├── aiChat/
│   ├── aiChat.actor.maia       # Actor definition ($schema: °Maia/schema/actor)
│   ├── aiChat.state.maia       # State machine (idle→processing on CHAT)
│   └── aiChat.function.js      # LLM execution
├── db/, sparks/, updatePaperContent/, computeMessageNames/
│   ├── *.actor.maia
│   ├── *.state.maia
│   └── *.function.js
└── shared/
    └── api-helpers.js
```

---

## Key Components

### 1. Actor Registry

Central registry that maps namespace paths to actor definitions and functions.

```javascript
export const ACTORS = {
  'core/publishMessage': { definition: publishMessageDef, function: publishMessageFn },
  'ai/chat': { definition: aiDef, function: aiFn },
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

const actor = getActor('core/updatePaperContent');
// Returns: { definition: {...}, function: execute(...) }
```

### Getting All Actor Definitions

```javascript
import { getAllActorDefinitions } from '@MaiaOS/actors';

const definitions = getAllActorDefinitions();
// Returns: { 'core/updatePaperContent': {...}, ... }
// Used for seeding actor definitions into database
```

---

## Available Actors

### Core

- **`@core/computeMessageNames`** - Computes message names from context
- **`@core/updatePaperContent`** - Updates CoText content for paper area
### AI

- **`@ai/chat`** - Unified AI chat using OpenAI-compatible API (RedPill)
- **`@ai/sendMessage`** - Full pipeline: user message → LLM → assistant message

### Database

- **`@db/db`** - Unified API for query, create, update, delete

### Sparks

- **`@db`** - Spark operations (createSpark, readSpark, addSparkMember, etc.) via `°Maia/actor/os/db` with type `SPARK_OP`

### UI

- **`@ui/switchView`** - Updates actor context with view mode

---

## Creating a New Actor

### Step 1: Create Actor Definition

**`src/my-namespace/myActor.actor.maia`**

### Step 2: Create Actor Function

**`src/my-namespace/myActor.function.js`**

### Step 3: Register in Index

**`src/index.js`:**
```javascript
import myActorDef from './my-namespace/myActor.actor.maia';
import myActorFn from './my-namespace/myActor.function.js';

export const ACTORS = {
  // ... existing
  'my-namespace/myActor': { definition: myActorDef, function: myActorFn },
};
```

### Step 4: Register in Module

**`libs/maia-engines/src/modules/my-namespace.module.js`:**
```javascript
import { getActor } from '@MaiaOS/actors';

export async function register(registry) {
  const registered = await registry._registerActorsFromRegistry(
    'my-namespace',
    ['myActor'],
    '@my-namespace',
    { silent: true },
  );
  // ...
}
```

---

## Related Documentation

- [maia-engines: ComputeEngine](../04_maia-engines/engines/) - How actors are executed
- [maia-engines: Modules](../04_maia-engines/modules.md) - How actors are registered
