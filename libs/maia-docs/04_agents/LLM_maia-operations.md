# MaiaOS Documentation for maia-operations

**Auto-generated:** 2026-02-11T12:55:31.478Z
**Purpose:** Complete context for LLM agents working with MaiaOS

---

# README

*Source: developers/README.md*

# maia-operations: Shared Database Operations Layer

## Overview

The `@MaiaOS/operations` package provides a **shared operations layer** that works with any database backend. Think of it as a universal translator - it defines a common language (the `DBAdapter` interface) that all backends must speak, and provides unified operations that work regardless of which backend you're using.

**What it is:**
- ✅ **Shared operations** - Read, create, update, delete, seed operations that work with any backend
- ✅ **DBAdapter interface** - Defines what all backends must implement
- ✅ **DBEngine** - Unified operation router that works with any backend adapter
- ✅ **ReactiveStore** - Shared reactive data store pattern (like Svelte stores)

**What it isn't:**
- ❌ **Not a backend** - It doesn't store data itself, it works with backends
- ❌ **Not maia-script specific** - Can be used by any package that needs database operations
- ❌ **Not the database** - The actual storage is handled by backends (IndexedDB, CoJSON, etc.)

---

## The Simple Version

Think of `maia-operations` like a universal remote control:

- **DBAdapter** = The universal language all TVs must understand
- **Operations** = The buttons on the remote (read, create, update, delete)
- **DBEngine** = The remote control itself (routes button presses to the right operation)
- **ReactiveStore** = The display screen (shows current value and updates automatically)

**Analogy:**
Imagine you have different brands of TVs (IndexedDB, CoJSON, etc.). Each TV speaks a different language, but they all understand the same remote control commands. The `maia-operations` package is like that universal remote - it defines the common language (`DBAdapter`) and provides the buttons (`operations`) that work with any TV.

---

## Architecture

### Package Structure

```
libs/maia-operations/src/
├── index.js                    # Main exports
├── engine.js                   # Unified DBEngine
├── db-adapter.js               # DBAdapter interface
├── reactive-store.js           # ReactiveStore implementation
└── operations/                 # Operation classes
    ├── index.js                # Operations exports
    ├── read.js                 # ReadOperation (supports keys array)
    ├── create.js               # CreateOperation
    ├── update.js               # UpdateOperation (data + configs)
    ├── delete.js               # DeleteOperation
    └── seed.js                 # SeedOperation (backend-specific)
```

### How It Works

```
┌─────────────────────────────────────────┐
│         Your Application                │
│  (maia-script, maia-db, etc.)          │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│         DBEngine                        │
│  (from @MaiaOS/operations)             │
│  - Routes operations                    │
│  - Validates schemas                    │
│  - Manages operation handlers           │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│         Operations                      │
│  (ReadOperation, CreateOperation, etc.) │
│  - Execute specific operations          │
│  - Validate against schemas            │
│  - Call backend adapter methods         │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│         DBAdapter Interface              │
│  (read, create, update, delete, etc.)   │
│  - Defines what backends must implement │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        ↓                   ↓
┌───────────────┐   ┌───────────────┐
│ IndexedDB     │   │ CoJSON        │
│ Backend       │   │ Backend        │
│ (implements   │   │ (implements   │
│  DBAdapter)   │   │  DBAdapter)   │
└───────────────┘   └───────────────┘
```

---

## Key Concepts

### DBAdapter Interface

All backends must implement the `DBAdapter` interface. This ensures that operations work the same way regardless of which backend you're using.

**Required Methods:**
- `read(schema, key, keys, filter)` - Read data (returns ReactiveStore)
- `create(schema, data)` - Create new records
- `update(schema, id, data)` - Update existing records
- `delete(schema, id)` - Delete records
- `getRawRecord(id)` - Get raw stored data (for validation)
- `resolveHumanReadableKey(key)` - Resolve human-readable IDs to co-ids

**Optional Methods:**
- `seed(configs, schemas, data)` - Seed database (backend-specific)

### Operations

Operations are modular handlers that execute specific database operations:

- **ReadOperation** - Loads data (always returns ReactiveStore)
- **CreateOperation** - Creates new records (validates against schema)
- **UpdateOperation** - Updates existing records (unified for data + configs)
- **DeleteOperation** - Deletes records
- **SeedOperation** - Seeds database (backend-specific, IndexedDB only)
- **SchemaOperation** - Loads schema definitions by co-id, schema name, or from CoValue headerMeta
- **ResolveOperation** - Resolves human-readable keys to co-ids

### DBEngine

The `DBEngine` routes operations to the appropriate handler. It:
- Accepts a `DBAdapter` instance in the constructor
- Routes `execute()` calls to the right operation handler
- Provides helper methods like `getSchemaCoId()` and `resolveCoId()` (which use operations API internally)
- Optionally accepts an evaluator for MaiaScript expression evaluation

**Important:** All database access should go through `dbEngine.execute({op: ...})`. Helper methods like `getSchemaCoId()` use the operations API internally, ensuring consistent patterns throughout the codebase.

### ReactiveStore

A simple reactive data store pattern (like Svelte stores):
- Holds a current value
- Notifies subscribers when the value changes
- Used by all read operations to provide reactive data access

---

## Usage

### Basic Usage

```javascript
import { DBEngine, DBAdapter } from '@MaiaOS/operations';
import { IndexedDBBackend } from '@MaiaOS/script';

// Create backend (must implement DBAdapter)
const backend = new IndexedDBBackend();
await backend.init();

// Create DBEngine with backend
const dbEngine = new DBEngine(backend);

// Execute operations
const store = await dbEngine.execute({
  op: 'read',
  schema: 'co_zTodos123',
  filter: { completed: false }
});

// Store is reactive
console.log('Current todos:', store.value);
store.subscribe((todos) => {
  console.log('Todos updated:', todos);
});
```

### With MaiaScript Evaluator (maia-script)

```javascript
import { DBEngine } from '@MaiaOS/operations';
import { MaiaScriptEvaluator } from '@MaiaOS/script';

const backend = new IndexedDBBackend();
await backend.init();

// Create evaluator for MaiaScript expressions
const evaluator = new MaiaScriptEvaluator();

// Pass evaluator to DBEngine
const dbEngine = new DBEngine(backend, { evaluator });

// Now update operations can evaluate MaiaScript expressions
await dbEngine.execute({
  op: 'update',
  schema: 'co_zTodos123',
  id: 'co_zTodo456',
  data: {
    done: { $not: '$existing.done' }  // Toggle using MaiaScript
  }
});
```

### Creating a Custom Backend

To create a custom backend, implement the `DBAdapter` interface:

```javascript
import { DBAdapter } from '@MaiaOS/operations';
import { ReactiveStore } from '@MaiaOS/operations/reactive-store';

class MyCustomBackend extends DBAdapter {
  async read(schema, key, keys, filter) {
    // Implement read logic
    // Must return ReactiveStore (or array of stores for batch reads)
    const data = await this._fetchData(schema, key, keys, filter);
    const store = new ReactiveStore(data);
    // Set up reactive updates...
    return store;
  }

  async create(schema, data) {
    // Implement create logic
    // Must return created record with co-id
  }

  async update(schema, id, data) {
    // Implement update logic
    // Must return updated record
  }

  async delete(schema, id) {
    // Implement delete logic
    // Must return true if deleted successfully
  }

  async getRawRecord(id) {
    // Implement getRawRecord logic
    // Must return raw stored data (with $schema metadata)
  }

  async resolveHumanReadableKey(key) {
    // Implement resolveHumanReadableKey logic
    // Must return co-id or null
  }
}
```

---

## Operations Reference

### ReadOperation

**Purpose:** Load data from database (always returns reactive store)

**Parameters:**
- `schema` (string, required) - Schema co-id (co_z...)
- `key` (string, optional) - Specific key (co-id) for single item
- `keys` (string[], optional) - Array of co-ids for batch reads
- `filter` (object, optional) - Filter criteria for collection queries

**Returns:** `ReactiveStore` (or array of stores for batch reads)

**Example:**
```javascript
// Single item
const store = await dbEngine.execute({
  op: 'read',
  schema: 'co_zTodos123',
  key: 'co_zTodo456'
});

// Collection
const store = await dbEngine.execute({
  op: 'read',
  schema: 'co_zTodos123'
});

// Batch read
const stores = await dbEngine.execute({
  op: 'read',
  schema: 'co_zTodos123',
  keys: ['co_zTodo1', 'co_zTodo2', 'co_zTodo3']
});
```

### CreateOperation

**Purpose:** Create new records

**Parameters:**
- `schema` (string, required) - Schema co-id (co_z...)
- `data` (object, required) - Data to create

**Returns:** Created record with generated co-id

**Example:**
```javascript
const newTodo = await dbEngine.execute({
  op: 'create',
  schema: 'co_zTodos123',
  data: { text: 'Buy milk', completed: false }
});
```

### UpdateOperation

**Purpose:** Update existing records (unified for data collections and configs)

**Parameters:**
- `schema` (string, required) - Schema co-id (co_z...)
- `id` (string, required) - Record co-id to update
- `data` (object, required) - Data to update

**Returns:** Updated record

**Features:**
- Validates merged result (existing + update data) against schema
- Supports MaiaScript expressions if evaluator is provided
- Handles both data collections and configs uniformly

**Example:**
```javascript
const updated = await dbEngine.execute({
  op: 'update',
  schema: 'co_zTodos123',
  id: 'co_zTodo456',
  data: { completed: true }
});
```

### DeleteOperation

**Purpose:** Delete records

**Parameters:**
- `schema` (string, required) - Schema co-id (co_z...)
- `id` (string, required) - Record co-id to delete

**Returns:** `true` if deleted successfully

**Example:**
```javascript
await dbEngine.execute({
  op: 'delete',
  schema: 'co_zTodos123',
  id: 'co_zTodo456'
});
```

### SeedOperation

**Purpose:** Seed database with initial data (backend-specific, IndexedDB only)

**Parameters:**
- `configs` (object, required) - Config registry
- `schemas` (object, required) - Schema definitions
- `data` (object, optional) - Initial application data

**Returns:** `void`

**Example:**
```javascript
await dbEngine.execute({
  op: 'seed',
  configs: { /* ... */ },
  schemas: { /* ... */ },
  data: { /* ... */ }
});
```

### SchemaOperation

**Purpose:** Load schema definitions by co-id or from CoValue headerMeta. Uses universal schema resolver (single source of truth).

**Parameters:**
- `coId` (string, optional) - Schema co-id (co_z...) - direct load via universal resolver
- `fromCoValue` (string, optional) - CoValue co-id - extracts headerMeta.$schema internally via universal resolver

**Note:** Exactly one of `coId` or `fromCoValue` must be provided.

**Returns:** `ReactiveStore` with schema definition (or null if not found). The store updates reactively when the schema changes.

**Example:**
```javascript
// Load schema by co-id (returns ReactiveStore)
const schemaStore = await dbEngine.execute({
  op: 'schema',
  coId: 'co_zSchema123'
});
const schema = schemaStore.value; // Get current value
schemaStore.subscribe((updatedSchema) => {
  // React to schema updates
});

// Load schema from CoValue's headerMeta (PREFERRED - single source of truth)
const schemaStore = await dbEngine.execute({
  op: 'schema',
  fromCoValue: 'co_zValue456'
});
const schema = schemaStore.value;

// To resolve registry strings (@schema/...), use resolve operation first:
const schemaCoId = await dbEngine.execute({
  op: 'resolve',
  humanReadableKey: '@schema/actor'
});
const schemaStore = await dbEngine.execute({
  op: 'schema',
  coId: schemaCoId
});
```

**Universal Schema Resolver:**

SchemaOperation uses the universal schema resolver internally, which:
- Resolves schemas by co-id (`co_z...`)
- Resolves schemas by registry string (`@schema/...`) - via resolve operation
- Extracts schema co-id from CoValue headerMeta (`fromCoValue` pattern)
- Provides single source of truth for all schema resolution across MaiaOS
```

### ResolveOperation

**Purpose:** Resolve human-readable keys to co-ids

**Parameters:**
- `humanReadableKey` (string, required) - Human-readable ID (e.g., '@schema/actor', '@vibe/todos')

**Returns:** Co-id (co_z...) or null if not found

**Example:**
```javascript
const coId = await dbEngine.execute({
  op: 'resolve',
  humanReadableKey: '@schema/actor'
});
```

**Note:** This operation is typically used internally by helper methods like `getSchemaCoId()` and `resolveCoId()`. Engines should use those helper methods rather than calling resolve directly.

---

## Unified Operations API Pattern

**Principle:** All database access should go through the unified operations API (`dbEngine.execute({op: ...})`). This ensures consistency, maintainability, and backend abstraction.

### Architecture Flow

```
Engines/Utils → dbEngine.execute({op: ...}) → Operations → Backend Methods
```

**Allowed:**
- ✅ Engines call `dbEngine.execute({op: 'read', ...})`
- ✅ Engines use helper methods like `getSchemaCoId()` (which use operations API internally)
- ✅ Operations call `this.backend.*` methods (operations ARE the abstraction layer)

**Not Allowed:**
- ❌ Engines calling `dbEngine.backend.*` directly
- ❌ Engines calling `backend.*` methods directly
- ❌ Utilities calling backend methods directly

### How Engines Should Access Database

**✅ Correct Pattern:**
```javascript
// Direct operation call
const store = await dbEngine.execute({
  op: 'read',
  schema: 'co_zTodos123',
  key: 'co_zTodo456'
});

// Using helper methods (which use operations API internally)
const schemaCoId = await dbEngine.getSchemaCoId('actor');
const coId = await dbEngine.resolveCoId('@vibe/todos');

// Using utilities that use operations API
import { subscribeConfig } from '@MaiaOS/script/utils';
const { config } = await subscribeConfig(dbEngine, schemaCoId, coId, 'actor');
```

**❌ Incorrect Pattern:**
```javascript
// DON'T call backend directly from engines
const data = await dbEngine.backend.read(...);  // ❌
const coId = await dbEngine.backend.resolveHumanReadableKey(...);  // ❌
```

### Why This Matters

1. **Consistency**: All database access follows the same pattern
2. **Maintainability**: Single API to maintain, easier to debug
3. **Backend Abstraction**: Engines don't need to know backend implementation details
4. **Future-proof**: Easy to add new operations or swap backends

## Integration with Other Packages

### maia-script

`maia-script` extends the shared `DBEngine` with MaiaScript evaluator support:

```javascript
// In maia-script
import { DBEngine as SharedDBEngine } from '@MaiaOS/operations';
import { MaiaScriptEvaluator } from './MaiaScriptEvaluator.js';

export class DBEngine extends SharedDBEngine {
  constructor(backend) {
    const evaluator = new MaiaScriptEvaluator();
    super(backend, { evaluator });
  }
}
```

**All engines in maia-script use the operations API:**
- `ActorEngine` - Uses `dbEngine.execute({op: 'read'})` for configs
- `StyleEngine` - Uses `subscribeConfig()` → `dbEngine.execute({op: 'read'})`
- `ViewEngine` - Uses `subscribeConfig()` → `dbEngine.execute({op: 'read'})`
- `StateEngine` - Uses `subscribeConfig()` → `dbEngine.execute({op: 'read'})`
- `SubscriptionEngine` - Uses `dbEngine.execute({op: 'read'})` for data subscriptions

### maia-db

`maia-db` implements `DBAdapter` for the CoJSON backend, allowing it to use the same operations layer as IndexedDB. All database access goes through the unified operations API.

---

## Related Documentation

- [maia-script Package](../04_maia-script/README.md) - Uses operations layer
- [maia-db Package](../05_maia-db/cojson.md) - Will implement DBAdapter for CoJSON
- [maia-schemata Package](../03_maia-schemata/README.md) - Schema validation used by operations

---

## Source Files

**Package:** `libs/maia-operations/`

**Key Files:**
- `src/index.js` - Main exports
- `src/engine.js` - Unified DBEngine
- `src/db-adapter.js` - DBAdapter interface
- `src/reactive-store.js` - ReactiveStore implementation
- `src/operations/` - All operation classes

**Dependencies:**
- `@MaiaOS/schemata` - Schema validation

---

