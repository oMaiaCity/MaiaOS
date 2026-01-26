# MaiaOS Documentation for maia-kernel

**Auto-generated:** 2026-01-26T13:49:56.459Z
**Purpose:** Complete context for LLM agents working with MaiaOS

---

# API REFERENCE

*Source: developers/api-reference.md*

# API Reference

Complete API reference for `@MaiaOS/kernel` package.

---

## `createMaiaOS(options)`

Creates an authenticated MaiaOS instance (identity layer).

**Parameters:**
- `options.node` (required) - LocalNode instance from `signInWithPasskey`
- `options.account` (required) - RawAccount instance from `signInWithPasskey`
- `options.accountID` (optional) - Account ID string
- `options.name` (optional) - Display name

**Returns:** `Promise<Object>` - MaiaOS instance with:
- `id` - Identity object (`{ maiaId, node }`)
- `auth` - Authentication API
- `db` - Database API (future)
- `script` - DSL API (future)
- `inspector()` - Dev tool to inspect account
- `getAllCoValues()` - List all CoValues
- `getCoValueDetail(coId)` - Get CoValue details

**Throws:** If `node` or `account` not provided

**Example:**
```javascript
const { node, account } = await signInWithPasskey({ salt: "maia.city" });
const o = await createMaiaOS({ node, account });

// Inspect your account
const accountData = o.inspector();
console.log("Account data:", accountData);

// List all CoValues
const coValues = o.getAllCoValues();
console.log("CoValues:", coValues);
```

---

## `MaiaOS.boot(config)`

Boots the MaiaOS operating system (execution layer).

**Parameters:**
- `config.modules` (optional, default: `['db', 'core', 'dragdrop', 'interface']`) - Modules to load
- `config.registry` (optional) - Config registry for seeding database
- `config.isDevelopment` (optional) - Development mode flag

**Returns:** `Promise<MaiaOS>` - Booted OS instance

**Example:**
```javascript
const os = await MaiaOS.boot({
  modules: ['db', 'core', 'dragdrop', 'interface'],
  registry: {
    // Your configs here
  }
});
```

---

## `os.createActor(actorPath, container)`

Creates an actor from a `.maia` file.

**Parameters:**
- `actorPath` (string) - Path to actor file or co-id
- `container` (HTMLElement) - DOM container for actor

**Returns:** `Promise<Object>` - Created actor instance

**Example:**
```javascript
const actor = await os.createActor(
  './actors/todo.actor.maia',
  document.getElementById('todo-container')
);
```

---

## `os.loadVibe(vibePath, container)`

Loads a vibe (app manifest) from a file.

**Parameters:**
- `vibePath` (string) - Path to `.vibe.maia` file
- `container` (HTMLElement) - DOM container for root actor

**Returns:** `Promise<{vibe: Object, actor: Object}>` - Vibe metadata and actor

**Example:**
```javascript
const { vibe, actor } = await os.loadVibe(
  './vibes/todos/manifest.vibe.maia',
  document.getElementById('app-container')
);
```

---

## `os.loadVibeFromDatabase(vibeId, container)`

Loads a vibe from the database.

**Parameters:**
- `vibeId` (string) - Vibe ID (e.g., `"@vibe/todos"`)
- `container` (HTMLElement) - DOM container for root actor

**Returns:** `Promise<{vibe: Object, actor: Object}>` - Vibe metadata and actor

**Example:**
```javascript
const { vibe, actor } = await os.loadVibeFromDatabase(
  '@vibe/todos',
  document.getElementById('app-container')
);
```

---

## `os.getActor(actorId)`

Gets an actor by ID.

**Parameters:**
- `actorId` (string) - Actor ID

**Returns:** `Object|null` - Actor instance or null

---

## `os.sendMessage(actorId, message)`

Sends a message to an actor.

**Parameters:**
- `actorId` (string) - Target actor ID
- `message` (Object) - Message object

**Example:**
```javascript
os.sendMessage('actor-123', {
  type: 'click',
  target: 'button-1'
});
```

---

## `os.db(payload)`

Executes a database operation (internal use + `@db` tool).

**Parameters:**
- `payload` (Object) - Operation payload:
  - `op` (string) - Operation type: `'read'`, `'create'`, `'update'`, `'delete'`, `'seed'`
  - Other fields depend on operation type

**Returns:** `Promise<any>` - Operation result (for `read`, returns ReactiveStore)

**Example:**
```javascript
// Read (always returns reactive store)
const store = await os.db({
  op: 'read',
  schema: 'co_zTodos123',  // Schema co-id (co_z...)
  filter: { completed: false }
});

// Store has current value immediately
console.log('Current todos:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((todos) => {
  console.log('Todos updated:', todos);
});

// Create
const newTodo = await os.db({
  op: 'create',
  schema: '@schema/todos',
  data: { text: 'Buy milk', completed: false }
});
```

---

## `os.getEngines()`

Gets all engines for debugging.

**Returns:** `Object` - Engine instances:
- `actorEngine` - ActorEngine
- `viewEngine` - ViewEngine
- `styleEngine` - StyleEngine
- `stateEngine` - StateEngine
- `toolEngine` - ToolEngine
- `dbEngine` - DBEngine
- `evaluator` - MaiaScriptEvaluator
- `moduleRegistry` - ModuleRegistry

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [auth-layer.md](./auth-layer.md) - Identity & Authentication layer
- [boot-process.md](./boot-process.md) - Boot process details
- [patterns.md](./patterns.md) - Common patterns

---

# AUTH LAYER

*Source: developers/auth-layer.md*

# Identity & Authentication Layer

The `createMaiaOS` function provides the identity and authentication layer of MaiaOS.

---

## Overview

**What it is:** Proves who you are and gives you access to your account.

**When to use:** Before booting the OS, you need to authenticate.

---

## Usage

```javascript
import { createMaiaOS } from '@MaiaOS/kernel';
import { signInWithPasskey } from '@MaiaOS/self';

// Step 1: Authenticate (get your ID card)
const { node, account, accountID } = await signInWithPasskey({
  salt: "maia.city"
});

// Step 2: Create MaiaOS instance (prove you're authenticated)
const o = await createMaiaOS({ node, account, accountID });
```

---

## What You Get

After calling `createMaiaOS`, you receive an authenticated MaiaOS instance with:

### `o.id`

Your account identity object containing:
- `maiaId` - Your MaiaID (unique identifier)
- `node` - LocalNode instance for CoJSON operations

### `o.auth`

Authentication management API for:
- Managing authentication state
- Signing in/out
- Account management

### `o.inspector()`

Dev tool to inspect your account data:

```javascript
const accountData = o.inspector();
console.log("Account data:", accountData);
```

### `o.getAllCoValues()`

List all CoValues in your account:

```javascript
const coValues = o.getAllCoValues();
console.log("CoValues:", coValues);
```

### `o.getCoValueDetail(coId)`

Get details about a specific CoValue:

```javascript
const detail = o.getCoValueDetail('co_z...');
console.log("CoValue detail:", detail);
```

---

## API Reference

### `createMaiaOS(options)`

Creates an authenticated MaiaOS instance (identity layer).

**Parameters:**
- `options.node` (required) - LocalNode instance from `signInWithPasskey`
- `options.account` (required) - RawAccount instance from `signInWithPasskey`
- `options.accountID` (optional) - Account ID string
- `options.name` (optional) - Display name

**Returns:** `Promise<Object>` - MaiaOS instance with:
- `id` - Identity object (`{ maiaId, node }`)
- `auth` - Authentication API
- `db` - Database API (future)
- `script` - DSL API (future)
- `inspector()` - Dev tool to inspect account
- `getAllCoValues()` - List all CoValues
- `getCoValueDetail(coId)` - Get CoValue details

**Throws:** If `node` or `account` not provided

**Example:**
```javascript
const { node, account } = await signInWithPasskey({ salt: "maia.city" });
const o = await createMaiaOS({ node, account });

// Inspect your account
const accountData = o.inspector();
console.log("Account data:", accountData);

// List all CoValues
const coValues = o.getAllCoValues();
console.log("CoValues:", coValues);
```

---

## Key Concepts

### Identity vs. Execution

**Identity Layer (`createMaiaOS`):**
- **Purpose:** Prove who you are
- **When:** Before booting
- **What it gives:** Access to your account, CoValues, identity
- **Dependencies:** `@MaiaOS/self` (authentication)

**Execution Layer (`MaiaOS.boot()`):**
- **Purpose:** Run your app
- **When:** After authentication
- **What it gives:** Engines, actors, DSL execution
- **Dependencies:** `@MaiaOS/script`, `@MaiaOS/db`, `@MaiaOS/schemata`

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [boot-process.md](./boot-process.md) - Execution layer
- [api-reference.md](./api-reference.md) - Complete API reference
- [patterns.md](./patterns.md) - Common patterns

---

# BOOT PROCESS

*Source: developers/boot-process.md*

# Boot Process and Execution Layer

The `MaiaOS.boot()` function initializes the entire MaiaOS operating system with all engines and modules.

---

## Overview

**What it is:** Starts all the engines that run your actors and execute MaiaScript.

**When to use:** After authentication, boot the OS to run your app.

---

## Usage

```javascript
import { MaiaOS } from '@MaiaOS/kernel';

// Boot the operating system
const os = await MaiaOS.boot({
  modules: ['db', 'core', 'dragdrop', 'interface'],
  registry: { /* configs */ }
});

// Now you can:
// - os.createActor() - Create actors
// - os.loadVibe() - Load app manifests
// - os.sendMessage() - Send messages between actors
```

---

## Boot Process Deep Dive

When you call `MaiaOS.boot()`, here's what happens:

```
1. Initialize Database
   └─> Creates IndexedDBBackend
   └─> Creates DBEngine

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
   └─> DBEngine (database operations)

4. Wire Dependencies
   └─> Pass engines to each other
   └─> Set up circular references
   └─> Store engines in registry

5. Load Modules
   └─> Loads specified modules (db, core, dragdrop, interface)
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
8. SubscriptionEngine (needs DBEngine, ActorEngine)
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

### `os.sendMessage(actorId, message)`

Sends a message to an actor.

**Parameters:**
- `actorId` (string) - Target actor ID
- `message` (Object) - Message object

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
- `dbEngine` - DBEngine
- `evaluator` - MaiaScriptEvaluator
- `moduleRegistry` - ModuleRegistry

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [auth-layer.md](./auth-layer.md) - Identity & Authentication layer
- [api-reference.md](./api-reference.md) - Complete API reference
- [patterns.md](./patterns.md) - Common patterns

---

# PATTERNS

*Source: developers/patterns.md*

# Common Patterns and Troubleshooting

Common usage patterns and solutions to frequent problems.

---

## Common Patterns

### Pattern 1: Full App Setup

```javascript
import { createMaiaOS, MaiaOS } from '@MaiaOS/kernel';
import { signInWithPasskey } from '@MaiaOS/self';

async function setupApp() {
  // Authenticate
  const { node, account } = await signInWithPasskey({ salt: "maia.city" });
  const o = await createMaiaOS({ node, account });
  
  // Boot OS
  const os = await MaiaOS.boot({
    modules: ['db', 'core', 'dragdrop', 'interface']
  });
  
  // Load app
  const { vibe, actor } = await os.loadVibeFromDatabase(
    '@vibe/todos',
    document.getElementById('app')
  );
  
  return { o, os, vibe, actor };
}
```

---

### Pattern 2: Development Debugging

```javascript
const os = await MaiaOS.boot({ modules: ['db', 'core'] });

// Expose for debugging
window.os = os;
window.engines = os.getEngines();

// Inspect engines
console.log("ActorEngine:", os.getEngines().actorEngine);
console.log("ToolEngine:", os.getEngines().toolEngine);
```

---

### Pattern 3: Custom Module Loading

```javascript
// Load only what you need
const os = await MaiaOS.boot({
  modules: ['db', 'core'] // Skip dragdrop and interface
});
```

---

## Troubleshooting

### Problem: "Node and Account required"

**Solution:** You must call `signInWithPasskey()` first:

```javascript
// ❌ Wrong
const o = await createMaiaOS({});

// ✅ Correct
const { node, account } = await signInWithPasskey({ salt: "maia.city" });
const o = await createMaiaOS({ node, account });
```

---

### Problem: Module not found

**Solution:** Check module name and ensure it exists:

```javascript
// ❌ Wrong
await MaiaOS.boot({ modules: ['nonexistent'] });

// ✅ Correct
await MaiaOS.boot({ modules: ['db', 'core'] });
```

---

### Problem: Schema validation fails during boot

**Solution:** Check your schemas are valid JSON Schema:

```javascript
// Ensure schemas are valid before booting
const validationEngine = new ValidationEngine();
await validationEngine.initialize();
// ... validate schemas
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [auth-layer.md](./auth-layer.md) - Identity & Authentication layer
- [boot-process.md](./boot-process.md) - Boot process details
- [api-reference.md](./api-reference.md) - Complete API reference

---

# README

*Source: developers/README.md*

# maia-kernel: Core System Services

## Overview

The `@MaiaOS/kernel` package provides the foundational services that power MaiaOS. Think of it as the operating system kernel - it doesn't do much on its own, but everything else depends on it.

**What it does:**
- ✅ **Identity & Authentication** - Creates authenticated MaiaOS instances (`createMaiaOS`)
- ✅ **System Boot** - Initializes the entire OS with engines and modules (`MaiaOS.boot()`)
- ✅ **Unified API** - Exposes a single entry point for all MaiaOS functionality

**What it doesn't do:**
- ❌ Execute MaiaScript (that's `@MaiaOS/script`)
- ❌ Store data (that's `@MaiaOS/db`)
- ❌ Validate schemas (that's `@MaiaOS/schemata`)

---

## The Simple Version

Think of `maia-kernel` like the foundation of a house. Before you can build anything, you need:
1. **Identity** - Who are you? (`createMaiaOS` - proves you're authenticated)
2. **System** - What can you do? (`MaiaOS.boot()` - starts all the engines)

**Analogy:**
- `createMaiaOS` = Getting your ID card (proves who you are)
- `MaiaOS.boot()` = Starting your computer (loads all the programs)

---

## Two Layers, One Package

The kernel provides **two distinct layers** that work together:

### Layer 1: Identity & Authentication (`createMaiaOS`)

**What it is:** Proves who you are and gives you access to your account.

**When to use:** Before booting the OS, you need to authenticate.

```javascript
import { createMaiaOS } from '@MaiaOS/kernel';
import { signInWithPasskey } from '@MaiaOS/self';

// Step 1: Authenticate (get your ID card)
const { node, account, accountID } = await signInWithPasskey({
  salt: "maia.city"
});

// Step 2: Create MaiaOS instance (prove you're authenticated)
const o = await createMaiaOS({ node, account, accountID });
```

**What you get:**
- `o.id` - Your account identity (MaiaID)
- `o.auth` - Authentication management API
- `o.inspector()` - Dev tool to inspect your account data
- `o.getAllCoValues()` - List all CoValues in your account
- `o.getCoValueDetail(coId)` - Get details about a specific CoValue

### Layer 2: Actor & DSL Execution (`MaiaOS.boot()`)

**What it is:** Starts all the engines that run your actors and execute MaiaScript.

**When to use:** After authentication, boot the OS to run your app.

```javascript
import { MaiaOS } from '@MaiaOS/kernel';

// Boot the operating system
const os = await MaiaOS.boot({
  modules: ['db', 'core', 'dragdrop', 'interface'],
  registry: { /* configs */ }
});

// Now you can:
// - os.createActor() - Create actors
// - os.loadVibe() - Load app manifests
// - os.sendMessage() - Send messages between actors
```

**What you get:**
- `os.createActor()` - Create and render actors
- `os.loadVibe()` - Load app manifests from files
- `os.loadVibeFromDatabase()` - Load app manifests from database
- `os.getActor()` - Get actor by ID
- `os.sendMessage()` - Send messages to actors
- `os.db()` - Execute database operations
- `os.getEngines()` - Access all engines for debugging

---

## Documentation Structure

This package documentation is organized into focused topics:

- **[auth-layer.md](./auth-layer.md)** - Identity & Authentication layer (`createMaiaOS`)
- **[boot-process.md](./boot-process.md)** - Boot process and execution layer (`MaiaOS.boot()`)
- **[api-reference.md](./api-reference.md)** - Complete API reference
- **[patterns.md](./patterns.md)** - Common patterns and troubleshooting

---

## Quick Start

Here's the complete flow:

```javascript
import { createMaiaOS, MaiaOS } from '@MaiaOS/kernel';
import { signInWithPasskey } from '@MaiaOS/self';

async function startApp() {
  // STEP 1: Authenticate (Identity Layer)
  const { node, account, accountID } = await signInWithPasskey({
    salt: "maia.city"
  });
  
  const o = await createMaiaOS({ node, account, accountID });
  console.log("✅ Authenticated as:", accountID);
  
  // STEP 2: Boot OS (Execution Layer)
  const os = await MaiaOS.boot({
    modules: ['db', 'core', 'dragdrop', 'interface']
  });
  
  // STEP 3: Load your app
  const { vibe, actor } = await os.loadVibeFromDatabase(
    '@vibe/todos',
    document.getElementById('app-container')
  );
  
  console.log("✅ App loaded:", vibe.name);
}
```

---

## Related Documentation

- [maia-script Package](../04_maia-script/README.md) - Execution engines
- [MaiaOS Architecture](../01_maiaos.md) - Overall system architecture
- [Authentication](../09_authentication.md) - Authentication flow
- [CoJSON Integration](../07_cojson.md) - Database layer

---

## Source Files

**Package:** `libs/maia-kernel/`

**Key Files:**
- `src/index.js` - Public API exports
- `src/auth.js` - Identity/authentication layer (`createMaiaOS`)
- `src/kernel.js` - Execution layer (`MaiaOS.boot()`)

**Dependencies:**
- `@MaiaOS/self` - Authentication
- `@MaiaOS/script` - Engines and DSL execution
- `@MaiaOS/db` - Database operations
- `@MaiaOS/schemata` - Schema validation

---

