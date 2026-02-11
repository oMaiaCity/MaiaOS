# Database Operations API

MaiaOS uses a **flexible, composable database operations API** through a single unified entry point: `maia.db({op: ...})`.

## Core Concept

All database operations flow through one simple API:

```javascript
await maia.db({ op: "operationName", ...params })
```

Where:
- `maia` = MaiaOS instance (from `MaiaOS.boot()`)
- `db()` = Unified database operation router
- `{ op, ...params }` = Operation configuration (pure JSON)

**Why this design?**
- ✅ **Simple** - One API for everything
- ✅ **Composable** - Easy to extend with new operations
- ✅ **JSON-native** - Perfect for declarative configs
- ✅ **Type-safe** - Runtime validation against schemas
- ✅ **Flexible** - Swappable backends (IndexedDB, CoJSON, etc.)

## Available Operations

### `read` - Load Data (Always Reactive)

Load data, configs, or schemas from the database. **Always returns a reactive store** that you can subscribe to.

**Load a specific config:**
```javascript
const store = await maia.db({
  op: "read",
  schema: "co_zActor123",  // Schema co-id (co_z...)
  key: "co_zAgent456"      // Config co-id (co_z...)
});

// Store has current value immediately
console.log('Current config:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((data) => {
  console.log('Config updated:', data);
});
```

**Read a collection:**
```javascript
const store = await maia.db({
  op: "read",
  schema: "co_zTodos123"  // Schema co-id (co_z...)
});

// Store has current value immediately
console.log('Current todos:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((todos) => {
  console.log('Todos updated:', todos);
});
```

**Read with filter:**
```javascript
const store = await maia.db({
  op: "read",
  schema: "co_zTodos123",  // Schema co-id (co_z...)
  filter: { done: false }
});

// Store has filtered results immediately
console.log('Incomplete todos:', store.value);

// Subscribe to updates (filter is automatically applied)
const unsubscribe = store.subscribe((todos) => {
  console.log('Incomplete todos updated:', todos);
});
```

**Important Notes:** 
- **All schemas must be co-ids** (`co_z...`) at runtime - human-readable IDs (`@schema/...`) are transformed to co-ids during seeding
- **Always returns a reactive store** - use `store.value` for current value and `store.subscribe()` for updates
- **No callbacks** - the store pattern replaces callback-based subscriptions

**Parameters:**
- `schema` (required) - Schema co-id (`co_z...`) - MUST be a co-id, not `@schema/...`
- `key` (optional) - Specific key (co-id) for single item lookups
- `filter` (optional) - Filter criteria object (e.g., `{done: false}`)

**Returns:**
- `ReactiveStore` - Always returns a reactive store with:
  - `store.value` - Current data value (available immediately)
  - `store.subscribe(callback)` - Subscribe to updates, returns unsubscribe function

### `create` - Create New Records

Create a new record with schema validation.

```javascript
const newTodo = await maia.db({
  op: "create",
  schema: "co_z...",  // Co-id (transformed from @schema/todos during seeding)
  data: {
    text: "Buy groceries",
    done: false
  }
});

console.log("Created:", newTodo.id); // Auto-generated ID (co-id)
```

**Parameters:**
- `schema` (required) - Co-id (`co_z...`) for data collections. Schema references (`@schema/todos`) are transformed to co-ids during seeding
- `data` (required) - Data object to create

**Returns:**
- Created record with auto-generated `id` and all fields

**Validation:**
- Automatically validates against the schema definition
- Throws error if validation fails (schema or permission)

**Error handling:** When using `maia.db()`, write operations throw on failure. Wrap in try/catch to handle validation or permission errors.

### `update` - Update Existing Records

Update an existing record with partial validation. Supports MaiaScript expressions in data.

```javascript
const updated = await maia.db({
  op: "update",
  id: "co_z...",  // Co-id of record to update
  data: {
    text: "Buy groceries and cook dinner",
    done: { "$not": "$existing.done" }  // Toggle using expression
  }
});
```

**Parameters:**
- `id` (required) - Co-id of record to update
- `data` (required) - Partial data object (only fields to update)
- `schema` (optional) - **Not required** - Schema is extracted from CoValue headerMeta automatically

**Returns:**
- Updated record

**Validation:**
- Validates only the fields you're updating (partial validation)
- Doesn't require all schema fields
- Supports MaiaScript expressions (e.g., `{"$not": "$existing.done"}` for toggling)
- Throws error if validation fails

**Toggle Example:**
Toggle is not a separate operation. Use `update` with an expression:

```javascript
const updated = await maia.db({
  op: "update",
  id: "co_z...",
  data: {
    done: { "$not": "$existing.done" }  // Toggles boolean field
  }
});
```

### `delete` - Delete Records

Delete a record from the database.

```javascript
const deleted = await maia.db({
  op: "delete",
  id: "co_z..."  // Co-id of record to delete
});

console.log("Deleted:", deleted); // true
```

**Parameters:**
- `id` (required) - Co-id of record to delete
- `schema` (optional) - **Not required** - Schema is extracted from CoValue headerMeta automatically

**Returns:**
- `true` if deleted successfully

### `seed` - Seed Database (Dev Only)

Reseed the database with initial data. **Idempotent** - can be called multiple times safely.

**Behavior:**
- **First seed**: Creates all schemata, configs, and data from scratch
- **Reseed**: Preserves schemata (updates if definitions changed), deletes and recreates all configs and data
- **Idempotent**: Safe to call multiple times - schemata co-ids remain stable across reseeds

```javascript
await maia.db({
  op: "seed",
  configs: {
    "vibe/vibe": { /* vibe config */ },
    "vibe/vibe.actor": { /* actor config */ }
  },
  schemas: {
    "@schema/todos": { /* schema definition */ }
  },
  data: {
    "@schema/todos": [
      { text: "First todo", done: false },
      { text: "Second todo", done: true }
    ]
  }
});
```

**Parameters:**
- `configs` (optional) - Config objects keyed by path
- `schemas` (optional) - Schema definitions keyed by schema ID
- `data` (optional) - Data arrays keyed by schema ID

**Returns:**
- `true` when seeding completes

**Idempotent Seeding:**
- **Schemata**: Checked against `account.os.schematas` registry - if exists, updated in-place (preserves co-id); if not, created new
- **Configs & Data**: Always deleted and recreated (ensures clean state)
- **Schema Index Colists**: Automatically managed - deleted co-values are removed from indexes, new co-values are added to indexes

**Note:** Use only in development! Reseeding preserves schemata but recreates all configs and data.

### `schema` - Load Schema Definitions

Load schema definitions by co-id, schema name, or from CoValue headerMeta.

```javascript
const schemaStore = await maia.db({
  op: "schema",
  coId: "co_zActor123"  // Co-id of schema or CoValue
});

// Or resolve from human-readable ID (during seeding only)
const schemaStore = await maia.db({
  op: "schema",
  humanReadableKey: "@schema/actor"
});
```

**Parameters:**
- `coId` (optional) - Co-id of schema or CoValue
- `humanReadableKey` (optional) - Human-readable schema ID (only during seeding)

**Returns:**
- `ReactiveStore` containing schema definition

### `resolve` - Resolve Human-Readable Keys to Co-IDs

Resolve human-readable keys (like `@schema/todos`) to co-ids. **Only for use during seeding.**

```javascript
const coId = await maia.db({
  op: "resolve",
  humanReadableKey: "@schema/todos"
});

console.log("Resolved:", coId); // "co_zTodos123..."
```

**Parameters:**
- `humanReadableKey` (required) - Human-readable key to resolve

**Returns:**
- Co-id string (`co_z...`)

**Note:** At runtime, all IDs should already be co-ids. This operation is primarily for seeding/transformation.

### `append` - Append to CoList

Append items to a CoList (ordered array).

```javascript
const result = await maia.db({
  op: "append",
  id: "co_zList123",  // Co-id of CoList
  items: ["item1", "item2"]
});
```

**Parameters:**
- `id` (required) - Co-id of CoList
- `items` (required) - Array of items to append

**Returns:**
- Updated CoList

### `push` - Append to CoStream

Append items to a CoStream (append-only stream). This is an alias for `append` with `cotype: "costream"`.

```javascript
const result = await maia.db({
  op: "push",
  id: "co_zStream123",  // Co-id of CoStream
  items: ["message1", "message2"]
});
```

**Parameters:**
- `id` (required) - Co-id of CoStream
- `items` (required) - Array of items to append

**Returns:**
- Updated CoStream

### `processInbox` - Process Actor Inbox

Process messages in an actor's inbox with session-based watermarks.

```javascript
const processed = await maia.db({
  op: "processInbox",
  actorId: "co_zActor123",
  sessionId: "session-abc"
});
```

**Parameters:**
- `actorId` (required) - Co-id of actor
- `sessionId` (required) - Session identifier for watermark tracking

**Returns:**
- Number of messages processed

**Note:** This is typically handled automatically by ActorEngine. Manual use is rare.

### `createSpark` - Create New Spark (Group Reference)

Create a new Spark - a CoMap that references a group for collaborative spaces. Automatically creates a child group owned by your @maia spark's group and registers the spark in `account.sparks`.

```javascript
const spark = await maia.db({
  op: "createSpark",
  name: "My Project"
});

console.log("Created spark:", spark.id);
console.log("Guardian:", spark.guardian); // Co-id of the spark's guardian group
```

**Parameters:**
- `name` (required) - Spark name (string)
