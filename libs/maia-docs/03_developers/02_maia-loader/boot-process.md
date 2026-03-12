# Boot Process and Execution Layer

The `MaiaOS.boot()` function initializes the entire MaiaOS operating system with all engines and modules.

---

## Overview

**What it is:** Starts all the engines that run your actors and execute MaiaScript.

**When to use:** After authentication, boot the OS to run your app.

---

## Usage

```javascript
import { MaiaOS } from '@MaiaOS/loader';

// Boot the operating system
const os = await MaiaOS.boot({
  modules: ['db', 'core', 'dragdrop'],
  registry: { /* configs */ }
});

// Now you can:
// - os.createActor() - Create actors
// - os.loadVibe() - Load app manifests
// - os.deliverEvent() - Deliver events to actors
```

---

## Boot Process Deep Dive

When you call `MaiaOS.boot()`, here's what happens:

```
1. Initialize Database
   └─> Creates IndexedDBBackend
   └─> Creates DataEngine

2. Seed Database (if registry provided)
   └─> Collects schemas from @MaiaOS/schemata
   └─> Validates schemas against meta schema
   └─> Seeds configs, schemas, and tool definitions
   └─> Sets up schema resolver

3. Initialize Engines
   └─> ModuleRegistry (module loader)
   └─> MaiaScriptEvaluator (DSL evaluator)
   └─> ToolEngine (tool executor)
   └─> StateEngine (state machine interpreter)
   └─> StyleEngine (style compiler)
   └─> ViewEngine (view renderer)
   └─> ActorEngine (actor lifecycle)
   └─> SubscriptionEngine (reactive subscriptions)
   └─> DataEngine (maia.do – data operations)

4. Wire Dependencies
   └─> Pass engines to each other
   └─> Set up circular references
   └─> Store engines in registry

5. Load Modules
   └─> Loads specified modules (db, core, dragdrop)
   └─> Each module registers its tools
   └─> Tools become available for use

6. Return OS Instance
   └─> Ready to create actors and run apps!
```

---

## Engine Initialization Order

Engines are initialized in a specific order due to dependencies:

```
1. ModuleRegistry (no dependencies)
2. MaiaScriptEvaluator (needs ModuleRegistry)
3. ToolEngine (needs ModuleRegistry)
4. StateEngine (needs ToolEngine, Evaluator)
5. StyleEngine (no dependencies)
6. ViewEngine (needs Evaluator, ModuleRegistry)
7. ActorEngine (needs StyleEngine, ViewEngine, ModuleRegistry, ToolEngine, StateEngine)
8. SubscriptionEngine (needs DataEngine, ActorEngine)
```

---

## Module System

Modules are dynamically loaded during boot. Each module:
1. Registers tools with `ToolEngine`
2. Provides module-specific functionality
3. Can access engines via `ModuleRegistry`

**Available Modules:**
- `db` - Database operations (`@db` tool)
- `core` - Core UI utilities (`@core/*` tools)
- `dragdrop` - Drag and drop (`@dragdrop/*` tools)
- `interface` - Interface tools (`@interface/*` tools)

---

## Database Seeding

When you provide a `registry` in boot config:
1. Schemas are collected from `@MaiaOS/schemata`
2. Schemas are validated against meta schema
3. Configs, schemas, and tool definitions are seeded
4. Schema resolver is set up for runtime schema loading

---

## What You Get

After booting, you receive a MaiaOS instance with:

### `os.createActor(actorPath, container)`

Creates an actor from a `.maia` file.

**Parameters:**
- `actorPath` (string) - Path to actor file or co-id
- `container` (HTMLElement) - DOM container for actor

**Returns:** `Promise<Object>` - Created actor instance

### `os.loadVibe(vibePath, container)`

Loads a vibe (app manifest) from a file.

**Parameters:**
- `vibePath` (string) - Path to `.vibe.maia` file
- `container` (HTMLElement) - DOM container for root actor

**Returns:** `Promise<{vibe: Object, actor: Object}>` - Vibe metadata and actor

### `os.loadVibeFromDatabase(vibeId, container)`

Loads a vibe from the database.

**Parameters:**
- `vibeId` (string) - Vibe ID (e.g., `"@vibe/todos"`)
- `container` (HTMLElement) - DOM container for root actor

**Returns:** `Promise<{vibe: Object, actor: Object}>` - Vibe metadata and actor

### `os.getActor(actorId)`

Gets an actor by ID.

**Parameters:**
- `actorId` (string) - Actor ID

**Returns:** `Object|null` - Actor instance or null

### `os.deliverEvent(senderId, targetId, type, payload)`

Delivers an event to a target actor (inbox-only, persisted via CoJSON).

**Parameters:**
- `senderId` (string) - Sender actor co-id
- `targetId` (string) - Target actor co-id (or human-readable; resolved via CoJSON)
- `type` (string) - Message type
- `payload` (Object) - Resolved payload (no expressions)

### `os.db(payload)`

Executes a database operation (internal use + `@db` tool).

**Parameters:**
- `payload` (Object) - Operation payload:
  - `op` (string) - Operation type: `'read'`, `'create'`, `'update'`, `'delete'`, `'seed'`
  - Other fields depend on operation type

**Returns:** `Promise<any>` - Operation result

### `os.getEngines()`

Gets all engines for debugging.

**Returns:** `Object` - Engine instances:
- `actorEngine` - ActorEngine
- `viewEngine` - ViewEngine
- `styleEngine` - StyleEngine
- `stateEngine` - StateEngine
- `toolEngine` - ToolEngine
- `dataEngine` / `maia.do` - DataEngine
- `evaluator` - MaiaScriptEvaluator
- `moduleRegistry` - ModuleRegistry

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [auth-layer.md](./auth-layer.md) - Identity & Authentication layer
- [api-reference.md](./api-reference.md) - Complete API reference
- [patterns.md](./patterns.md) - Common patterns
