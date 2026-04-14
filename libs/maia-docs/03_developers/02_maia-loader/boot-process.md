# Boot Process and Execution Layer

The `MaiaOS.boot()` function initializes the entire MaiaOS operating system with all engines and modules.

---

## Overview

**What it is:** Starts all the engines that run your actors and execute MaiaScript.

**When to use:** After authentication, boot the OS to run your app. Pass `node` and `account` from `signInWithPasskey`, or a pre-initialized `peer`, or use agent mode.

---

## Usage

```javascript
import { MaiaOS, signInWithPasskey } from '@MaiaOS/runtime';

// Authenticate first
const { loadingPromise } = await signInWithPasskey({ salt: "maia.city" });
const { node, account } = await loadingPromise;

// Boot the operating system
const os = await MaiaOS.boot({
  node,
  account,
  modules: ['db', 'core', 'ai']
});

// Now you can:
// - os.createActor() - Create actors
// - os.loadVibe() - Load vibes from account or by co-id
// - os.deliverEvent() - Deliver events to actors
// - os.do() - Execute data operations
```

---

## Boot Process Deep Dive

When you call `MaiaOS.boot()`, here's what happens:

```
1. Resolve Peer
   └─> If config.peer: use provided MaiaDB
   └─> If config.node + config.account: create MaiaDB with node+account
   └─> If config.mode === 'agent': loadOrCreateAgentAccount (env vars)

2. Initialize Database
   └─> Creates DataEngine with MaiaDB
   └─> Sets up schema resolver (setFactoryResolver)

3. Initialize Engines
   └─> ModuleRegistry (module loader)
   └─> MaiaScriptEvaluator (DSL evaluator)
   └─> ProcessEngine (state machine interpreter)
   └─> StyleEngine (style compiler)
   └─> ViewEngine (view renderer)
   └─> ActorEngine (actor lifecycle)
   └─> DataEngine (maia.do – data operations)

4. Wire Dependencies
   └─> Pass engines to each other
   └─> Set up circular references
   └─> Store engines in registry

5. Load Modules
   └─> Loads specified modules (db, core, ai)
   └─> Each module registers its tools
   └─> Tools become available for use

6. Start Runtime
   └─> Runtime (inbox watching for browser agents)
   └─> Returns OS instance
```

---

## Engine Initialization Order

Engines are initialized in a specific order due to dependencies:

```
1. ModuleRegistry (no dependencies)
2. MaiaScriptEvaluator (needs ModuleRegistry)
3. ProcessEngine (needs Evaluator)
4. StyleEngine (no dependencies)
5. ViewEngine (needs Evaluator, ModuleRegistry)
6. ActorEngine (needs StyleEngine, ViewEngine, ModuleRegistry, ProcessEngine)
```

---

## Module System

Modules are dynamically loaded during boot. Each module:
1. Registers tools with the module registry
2. Provides module-specific functionality
3. Can access engines via ModuleRegistry

**Available Modules:**
- `db` - Database operations (`@db` tool)
- `core` - Core UI utilities (`@core/*` tools)
- `ai` - AI tools (`@maia/actor/services/ai`)

---

## What You Get

After booting, you receive a MaiaOS instance with:

### `os.createActor(actorPath, container)`

Creates an actor from a `.maia` file or co-id.

### `os.loadVibe(vibeKeyOrCoId, container, spark?)`

Loads a vibe from account or by co-id. Delegates to `loadVibeFromAccount`.

### `os.loadVibeFromAccount(vibeKeyOrCoId, container, spark?)`

Loads a vibe from account.vibes or by co-id.

### `os.loadVibeFromDatabase(vibeId, container, vibeKey?)`

Loads a vibe from the database by co-id. `vibeId` must be a co-id (`co_z...`).

### `os.getActor(actorId)`

Gets an actor by ID.

### `os.deliverEvent(senderId, targetId, type, payload)`

Delivers an event to a target actor (inbox-only, persisted via CoJSON).

### `os.do(payload)`

Executes a database operation (internal use + `@db` tool). Use `factory` (not `schema`) in payload.

### `os.getEngines()`

Gets all engines for debugging.

**Returns:** `Object` - Engine instances:
- `actorEngine` - ActorEngine
- `viewEngine` - ViewEngine
- `styleEngine` - StyleEngine
- `processEngine` - ProcessEngine
- `dataEngine` - DataEngine
- `evaluator` - MaiaScriptEvaluator
- `moduleRegistry` - ModuleRegistry

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [auth-layer.md](./auth-layer.md) - Identity & Authentication layer
- [api-reference.md](./api-reference.md) - Complete API reference
- [patterns.md](./patterns.md) - Common patterns
