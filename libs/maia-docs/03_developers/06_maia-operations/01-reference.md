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
// Config subscriptions handled by backend (maia-db CoCache)
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
