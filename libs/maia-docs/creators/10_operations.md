# Operations-Based Architecture

> ⚠️ **ADVANCED TOPIC - Jazz/CoJSON Integration**
>
> This document describes the advanced operations architecture for Jazz/CoJSON integration.
> For basic database operations with the `@db` tool, see [State Machines](./05-state.md) and [Tools](./06-tools.md).

## Overview

MaiaOS uses a **unified operations-based API** where all database interactions (read, write, schema management) are expressed as JSON-configurable operations through a single entry point: `o.db({ op })`.

This architecture provides:
- **JSON-native**: All operations are pure JSON configurations
- **LLM-analyzable**: Each operation has a formal JSON Schema DSL
- **Composable**: Operations can be nested (batch operations)
- **Type-safe**: Runtime validation against operation schemas
- **Uniform**: Single API for all database interactions

> Note: Basic MaiaOS applications use the simpler `@db` tool (create, update, delete, toggle, query). This document covers the more advanced operations engine for Jazz/CoJSON integration.

## Core Concept

Instead of multiple method APIs (`db.create()`, `db.read()`, etc.), everything flows through:

```javascript
await o.db({ op: "operationName", ...params })
```

Where:
- `o` = MaiaOS context object
- `db()` = Operations engine dispatcher
- `{ op, ...params }` = JSON operation configuration

## Available Operations

### Schema Operations

#### `registerSchema`
Register a new JSON Schema in the registry.

```javascript
const result = await o.db({
  op: "registerSchema",
  name: "Post",
  definition: {
    type: "co-map",
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      author: { 
        type: "co-id",
        $ref: "https://maia.city/co_zAuthorSchemaId"
      }
    },
    required: ["title", "content"]
  }
});
// Returns: { schemaId: "co_z...", name: "Post" }
```

#### `loadSchema`
Load a schema definition by ID.

```javascript
const schema = await o.db({
  op: "loadSchema",
  schemaId: "co_z..."
});
// Returns: { $schema, $id, type, properties, ... }
```

#### `listSchemas`
List all registered schemas.

```javascript
const result = await o.db({
  op: "listSchemas"
});
// Returns: { schemas: [{ id, name, definition }, ...] }
```

### Data Operations

#### `create`
Create a new CoValue with schema validation.

```javascript
const result = await o.db({
  op: "create",
  schema: "co_zPostSchemaId",
  data: {
    title: "Hello World",
    content: "My first post",
    author: "co_zAuthorId",
    likes: 0
  }
});
// Returns: { id: "co_z...", coValue: {...} }
```

The created CoValue automatically gets a `$schema` property pointing to the schema ID.

#### `read`
Read a CoValue with optional deep resolution.

**Basic read:**
```javascript
const post = await o.db({
  op: "read",
  target: { id: "co_zPostId" }
});
```

**Deep resolution:**
```javascript
const post = await o.db({
  op: "read",
  target: { id: "co_zPostId" },
  resolve: {
    author: {}, // Resolve author reference
    comments: { // Resolve nested list
      each: {   // Resolve each comment
        author: {} // Resolve each comment's author
      }
    }
  }
});
```

**Resolution options:**
- `{}`: Resolve one level
- `each: {}`: Resolve each item in a CoList
- `onError: "null"`: Return null on resolution failure (default: throw)
- Depth limit: 10 levels (configurable via MAX_DEPTH)

#### `update`
Update a CoValue (CoMap or CoList).

**CoMap update:**
```javascript
await o.db({
  op: "update",
  target: { id: "co_zPostId" },
  changes: {
    title: "Updated Title",
    likes: { op: "increment", by: 1 }
  }
});
```

**Nested operations:**
- `{ op: "set", value: X }`: Set value
- `{ op: "increment", by: N }`: Increment number
- `{ op: "decrement", by: N }`: Decrement number
- `{ op: "delete" }`: Delete property

**CoList update:**
```javascript
await o.db({
  op: "update",
  target: { id: "co_zListId" },
  changes: {
    items: [
      { op: "push", value: "co_zNewItemId" },
      { op: "splice", index: 2, deleteCount: 1 },
      { op: "set", index: 0, value: "co_zUpdatedId" }
    ]
  }
});
```

**List operations:**
- `push`: Append to end
- `unshift`: Prepend to start
- `set`: Update at index
- `splice`: Insert/delete items
- `pop`: Remove last item
- `shift`: Remove first item
- `remove`: Remove by predicate or index
- `retain`: Keep only matching items

#### `delete`
Delete a CoValue (soft or hard).

**Soft delete (clear content):**
```javascript
await o.db({
  op: "delete",
  target: { id: "co_zPostId" }
});
```

**Hard delete (unmount from memory):**
```javascript
await o.db({
  op: "delete",
  target: { id: "co_zPostId" },
  hard: true
});
```

### Inspection Operations

#### `allLoaded`
List all currently loaded CoValues in memory (debug tool).

```javascript
const result = await o.db({
  op: "allLoaded",
  filter: { type: "comap" } // Optional filter
});
// Returns: {
//   coValues: [{ id, type, schema, properties, size, loadedAt }, ...],
//   totalCount: 12,
//   totalSize: "4.1 KB",
//   byType: { comap: 11, colist: 1 },
//   bySchema: { Post: 2, Author: 1 }
// }
```

### Composite Operations

#### `batch`
Execute multiple operations in sequence or parallel.

**Sequential batch:**
```javascript
await o.db({
  op: "batch",
  mode: "sequential",
  operations: [
    { op: "create", schema: authorSchemaId, data: {...} },
    { op: "create", schema: postSchemaId, data: {...} },
    { op: "update", target: {...}, changes: {...} }
  ]
});
```

**Parallel batch:**
```javascript
await o.db({
  op: "batch",
  mode: "parallel",
  operations: [
    { op: "read", target: { id: "co_z1" } },
    { op: "read", target: { id: "co_z2" } },
    { op: "read", target: { id: "co_z3" } }
  ]
});
```

**Error handling:**
```javascript
await o.db({
  op: "batch",
  mode: "sequential",
  continueOnError: true, // Don't stop on errors
  operations: [...]
});
```

## Operation DSL Schemas

Each operation type has a formal JSON Schema definition that validates the operation configuration. These DSL schemas are located at:

```
libs/maia-schemata/src/operations/
  - register-schema.operation.json
  - load-schema.operation.json
  - list-schemas.operation.json
  - read.operation.json
  - create.operation.json
  - update-map.operation.json
  - update-list.operation.json
  - delete.operation.json
  - all-loaded.operation.json
  - batch.operation.json
```

> Note: Operations schemas are not currently implemented. The `@db` tool uses simpler operation validation.

All schemas use the `$id` format: `https://maia.city/operations/{name}`

### Example DSL Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://maia.city/operations/read",
  "title": "Read Operation Schema",
  "type": "object",
  "properties": {
    "op": { "const": "read" },
    "target": {
      "type": "object",
      "properties": {
        "id": { "type": "string", "pattern": "^co_z[a-zA-Z0-9]+$" }
      },
      "required": ["id"]
    },
    "resolve": { "type": "object" }
  },
  "required": ["op", "target"],
  "additionalProperties": false
}
```

## Operations Engine Architecture

```
o.db({ op })
    ↓
OperationsEngine
    ↓
OperationsValidator (validates against DSL schema)
    ↓
Operation Handler (executes operation)
    ↓
Kernel (SchemaStore, Node, SubscriptionCache)
    ↓
cojson (raw CRDTs)
```

### Components

**OperationsEngine** (`operations-engine.engine.js`)
- Central dispatcher for all operations
- Registers operation handlers
- Exposes itself to kernel for nested operations

**OperationsValidator** (`operations-validator.js`)
- Loads all DSL schemas at initialization
- Validates operations before execution
- Provides detailed error messages

**Operation Handlers** (`handlers/`)
- `schema-handler.js`: registerSchema, loadSchema, listSchemas
- `read-handler.js`: read + deep resolution
- `create-handler.js`: create with validation
- `update-map-handler.js`: CoMap updates
- `update-list-handler.js`: CoList updates
- `delete-handler.js`: soft/hard delete
- `inspector-handler.js`: allLoaded
- `batch-handler.js`: composite operations
- `resolver.js`: Deep resolution engine

## Read-Only Wrappers

The `maia-cojson` kernel provides read-only wrapper classes around raw cojson CRDTs:

```javascript
import { CoMap, CoList, CoStream } from "@maiaos/maia-cojson";

// Wrappers provide convenient read access:
const post = CoMap.fromRaw(rawCoMap);
console.log(post.title);  // Read property
console.log(post.keys()); // Get all keys

// But ALL mutations go through operations:
await o.db({
  op: "update",
  target: { id: post.$id },
  changes: { title: "New Title" }
});
```

**Key points:**
- Wrappers are **read-only** proxies
- They provide `$id`, `$type`, `$schema` metadata
- All mutations MUST use `o.db({ op: "update" })`
- Automatic subscription management via `SubscriptionCache`

## Best Practices

### 1. Always Use Operations

```javascript
// ❌ Direct mutation (not possible)
post.title = "New Title";

// ✅ Update operation
await o.db({
  op: "update",
  target: { id: post.$id },
  changes: { title: "New Title" }
});
```

### 2. Leverage Deep Resolution

```javascript
// ❌ Multiple read operations
const post = await o.db({ op: "read", target: { id: postId } });
const author = await o.db({ op: "read", target: { id: post.author } });

// ✅ Single read with deep resolution
const post = await o.db({
  op: "read",
  target: { id: postId },
  resolve: { author: {} }
});
```

### 3. Use Batch for Multiple Operations

```javascript
// ❌ Sequential awaits
const r1 = await o.db({ op: "read", target: { id: "co_z1" } });
const r2 = await o.db({ op: "read", target: { id: "co_z2" } });

// ✅ Parallel batch
const results = await o.db({
  op: "batch",
  mode: "parallel",
  operations: [
    { op: "read", target: { id: "co_z1" } },
    { op: "read", target: { id: "co_z2" } }
  ]
});
```

### 4. Store $schema Reference

When creating CoMaps, the `$schema` property is automatically added:

```javascript
// The create handler automatically sets:
rawCoMap.set("$schema", schemaId);
rawCoMap.set("title", data.title);
rawCoMap.set("content", data.content);
```

This enables:
- Runtime validation
- Schema introspection
- Inspector schema resolution

## Migration from Method-Based API

**Old API** (deprecated):
```javascript
const post = await db.create({ schema: schemaId, data });
const loaded = await db.read({ id: postId });
await db.update({ id: postId, changes: { title: "New" } });
await db.delete({ id: postId });
```

**New API** (operations-based):
```javascript
const post = await o.db({ op: "create", schema: schemaId, data });
const loaded = await o.db({ op: "read", target: { id: postId } });
await o.db({ op: "update", target: { id: postId }, changes: { title: "New" } });
await o.db({ op: "delete", target: { id: postId } });
```

## Testing

All operation handlers have comprehensive test coverage:

```bash
cd libs/maia-script
bun test
```

Tests include:
- DSL schema validation
- CRUD operations against real CRDTs
- Deep resolution with circular reference detection
- Batch operations (sequential/parallel)
- Error handling and edge cases
- Zero mocks policy (all tests use real cojson)

## Example: Blog Application

See the complete example at `libs/maia-vibes/src/todos/`:

```javascript
// Initialize MaiaOS
const o = await createMaiaOS({ ... });

// Register schemas
await o.db({
  op: "registerSchema",
  name: "Post",
  definition: { ... }
});

// Create post
const post = await o.db({
  op: "create",
  schema: postSchemaId,
  data: { title: "Hello", content: "World", likes: 0 }
});

// Like post (increment operation)
await o.db({
  op: "update",
  target: { id: post.id },
  changes: { likes: { op: "increment", by: 1 } }
});

// Read with author resolution
const fullPost = await o.db({
  op: "read",
  target: { id: post.id },
  resolve: { author: {} }
});
```

## Future Enhancements

Potential future operations:
- `subscribe`: Explicit subscription management
- `unsubscribe`: Remove subscriptions
- `migrate`: Schema migration operations
- `export`: Export CoValues to JSON
- `import`: Import JSON into CoValues
- `query`: Advanced filtering/querying
- `transaction`: Multi-operation atomicity

## References

- Operations Engine: `libs/maia-script/src/o/engines/operations-engine/`
- Schemas: `libs/maia-schemata/src/`
- Example Vibe: `libs/maia-vibes/src/todos/`
- Tests: `libs/maia-script/src/o/engines/operations-engine/handlers/*.test.js`
