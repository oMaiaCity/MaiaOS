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

### OperationResult (Write Operations)

Write operations (create, update, delete, append, push, seed) return a standardized `OperationResult`:

**Success:**
```javascript
{ ok: true, data: { id: 'co_z...', ... }, op: 'create' }
```

**Error (schema, permission, or structural):**
```javascript
{
  ok: false,
  errors: [
    { type: 'schema', message: '...', path: '/field' },
    { type: 'permission', message: 'Not authorized to write...' }
  ],
  op: 'create'
}
```

**Error types:** `schema`, `permission`, `structural`

**Caller behavior:**
- **maia.db()** (kernel): Throws on `ok: false`, returns `result.data` on success (tools/state machines get unwrapped data)
- **dbEngine.execute()** (direct): Returns raw OperationResult; callers must check `result.ok` and handle `result.errors`

**Helpers:** `isSuccessResult(result)`, `createErrorResult(errors, meta)`, `createErrorEntry(type, message, path)` from `@MaiaOS/operations`

---

## Usage

### Basic Usage

```javascript
import { DBEngine, DBAdapter } from '@MaiaOS/operations';
import { MaiaDB } from '@MaiaOS/db';

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
import { Evaluator as MaiaScriptEvaluator } from '@MaiaOS/engines';

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
