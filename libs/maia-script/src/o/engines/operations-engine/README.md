# Operations Engine

Operations-based database API for MaiaOS. All database interactions happen through JSON-configurable operations.

## Architecture

```
o.db({ op: "read", ... })
  ↓
OperationsEngine.execute(operation)
  ↓
OperationsValidator.validate(operation) [against DSL schema]
  ↓
Dispatch to operation handler
  ↓
Handler uses maia-cojson kernel (wrappers, SchemaStore, etc.)
  ↓
Return result
```

## Package Separation

- **maia-cojson** (Kernel): CoValue wrappers, SchemaStore, validation, caching
- **maia-script** (System): Operations engine, handlers, DSL schemas

## API Usage

```javascript
import { createMaiaOS } from "@maia/script";
import { LocalNode, WasmCrypto } from "cojson";

// Initialize MaiaOS
const crypto = await WasmCrypto.create();
const result = await LocalNode.withNewlyCreatedAccount({
  creationProps: { name: "User" },
  peers: [],
  crypto,
});

const { node, accountID } = result;
const group = node.createGroup();

const o = await createMaiaOS({ node, accountID, group });

// All operations through o.db({ op })
```

## Operations

### Schema Operations

```javascript
// Register schema
const { schemaId } = await o.db({
  op: "registerSchema",
  name: "Post",
  definition: {
    type: "co-map",
    properties: {
      title: { type: "string" },
      likes: { type: "number" },
    },
    required: ["title"],
  },
});

// Load schema
const { definition } = await o.db({
  op: "loadSchema",
  target: { id: schemaId },
});

// List all schemas
const { schemas, count } = await o.db({
  op: "listSchemas",
});
```

### CRUD Operations

```javascript
// Create
const { id, coValue } = await o.db({
  op: "create",
  schema: schemaId,
  data: {
    title: "Hello World",
    likes: 0,
  },
});

// Read
const post = await o.db({
  op: "read",
  target: { id },
});

// Read with deep resolution
const post = await o.db({
  op: "read",
  target: { id: postId },
  resolve: {
    author: {
      fields: {
        name: true,
        profile: {
          fields: {
            avatar: true,
          },
        },
      },
    },
    comments: {
      each: {
        fields: {
          text: true,
          author: {
            fields: { name: true },
          },
        },
        onError: "skip",
      },
    },
  },
});

// Update (CoMap)
await o.db({
  op: "update",
  target: { id },
  changes: {
    title: "Updated Title",
    likes: { op: "increment", by: 1 },
    views: { op: "set", value: 100 },
    deprecated: { op: "delete" },
  },
});

// Update (CoList)
await o.db({
  op: "update",
  target: { id: listId },
  changes: {
    items: { op: "push", value: postId },
  },
});

await o.db({
  op: "update",
  target: { id: listId },
  changes: {
    items: {
      op: "splice",
      index: 1,
      deleteCount: 1,
      items: [post1Id, post2Id],
    },
  },
});

// Delete (soft)
await o.db({
  op: "delete",
  target: { id },
});

// Delete (hard - GDPR)
await o.db({
  op: "delete",
  target: { id },
  hard: true,
});
```

### Inspector Operations

```javascript
// List all loaded CoValues
const result = await o.db({
  op: "allLoaded",
});

// Filter by type
const result = await o.db({
  op: "allLoaded",
  filter: { type: "comap" },
});

// Result structure:
// {
//   coValues: [{ id, type, schema, size, properties, loadedAt }, ...],
//   totalCount: 42,
//   totalSize: "2.4 MB",
//   byType: { "comap": 30, "colist": 12 },
//   bySchema: { "Post": 20, "Author": 10, "Comment": 12 }
// }
```

### Composite Operations

```javascript
// Sequential batch
await o.db({
  op: "batch",
  mode: "sequential",
  operations: [
    { op: "read", target: { id: post1Id } },
    { op: "update", target: { id: post1Id }, changes: { views: { op: "increment", by: 1 } } },
  ],
});

// Parallel batch (faster for independent operations)
await o.db({
  op: "batch",
  mode: "parallel",
  operations: [
    { op: "read", target: { id: post1Id } },
    { op: "read", target: { id: post2Id } },
    { op: "read", target: { id: post3Id } },
  ],
});

// Nested composition (Composite pattern - unlimited depth!)
await o.db({
  op: "batch",
  operations: [
    { op: "read", target: { id: post1Id } },
    {
      op: "batch",
      mode: "parallel",
      operations: [
        { op: "read", target: { id: author1Id } },
        { op: "read", target: { id: author2Id } },
      ],
    },
    { op: "update", target: { id: post1Id }, changes: { likes: { op: "increment", by: 1 } } },
  ],
});

// Error handling
await o.db({
  op: "batch",
  continueOnError: true,
  operations: [
    { op: "read", target: { id: validId } },
    { op: "read", target: { id: invalidId } }, // Fails but continues
    { op: "read", target: { id: validId2 } },
  ],
});
```

## DSL Schemas

Each operation type has its own DSL schema for validation:

- `register-schema.operation.json` - Schema registration
- `load-schema.operation.json` - Schema loading
- `list-schemas.operation.json` - Schema listing
- `read.operation.json` - Read operations with resolution
- `create.operation.json` - CoValue creation
- `update-map.operation.json` - CoMap updates
- `update-list.operation.json` - CoList updates
- `delete.operation.json` - Delete operations
- `all-loaded.operation.json` - Inspector operations
- `batch.operation.json` - Composite operations

All schemas use `https://maia.city/operations/{name}` as `$id`.

## Testing

151 tests, all passing with real CRDTs (ZERO MOCKS!)

```bash
cd libs/maia-script
bun test src/o/engines/operations-engine/
```

## Migration from Old API

### Before (MaiaDB class)
```javascript
const db = new MaiaDB({ node, accountID, group });
const schemaId = await db.registerSchema("Post", {...});
const post = await db.create({ schemaId, data: {...} });
await db.update({ id: post.$id, data: { likes: 42 } });
await db.delete({ id: post.$id });
```

### After (Operations API)
```javascript
const o = await createMaiaOS({ node, accountID, group });

const { schemaId } = await o.db({
  op: "registerSchema",
  name: "Post",
  definition: {...},
});

const { coValue } = await o.db({
  op: "create",
  schema: schemaId,
  data: {...},
});

await o.db({
  op: "update",
  target: { id: coValue.$id },
  changes: { likes: { op: "increment", by: 1 } },
});

await o.db({
  op: "delete",
  target: { id: coValue.$id },
});
```

## Example App

See `libs/maia-script/src/vibes/blog/` for a complete example demonstrating:

- Schema registration with $ref dependencies
- CoValue creation and validation
- Update operations (increment, set, delete)
- Deep resolution with nested references
- Inspector view (3 tabs: Blog, Schemas, Inspector)
- All interactions through o.db({ op }) API
