# MaiaDB - Collaborative Database with Automatic Subscription Management

**Complete Implementation** ✅ - Pure cojson with automatic CoValue loading!

A collaborative database layer built on Jazz/cojson with automatic subscription management, lazy-loading, and caching.

## Why MaiaDB?

- **Automatic Loading**: CoValues load automatically from IndexedDB on access
- **Subscription Management**: Built-in caching, deduplication, and cleanup
- **Lazy Loading**: Only loads CoValues when needed (memory efficient)
- **Zero Manual Subscriptions**: Just link CoValues, system handles the rest
- **Schema Support**: Optional JSON Schema metadata for type safety
- **Pure cojson**: Built on raw Jazz/cojson (not jazz-tools abstractions)
- **Passkey Authentication**: Strict security with WebAuthn PRF
- **Self-Sovereign**: Your data, your keys, your control

## Architecture

```
User Code (createCoMap, seedExampleCoValues, etc.)
        ↓
  Unified Cache Layer (CoCache - subscriptions, stores, resolutions, resolved data)
        ↓
  MaiaDB Services (oMap, oList, oStream, oSeeding, etc.)
        ↓
  Real CRDT Types (RawCoMap, RawCoList, RawCoStream)
        ↓
    cojson (from jazz-tools)
```

### Unified Cache Layer

MaiaDB includes a unified caching system that handles all CoValue operations:

- **CoCache**: Unified cache for subscriptions, stores, resolutions, and resolved+mapped data
- **Automatic Cleanup**: Unused entries cleaned up automatically after 5s to prevent memory leaks
- **Node-aware**: Cache automatically clears when node changes (e.g., after re-login)
- **Performance Optimized**: Caches resolved+mapped data to avoid duplicate processing

**Key Insight**: Jazz requires active subscriptions to load CoValues from IndexedDB. Simply linking CoValues (e.g., `account.examples`) isn't enough - you need subscriptions. MaiaDB handles this automatically!

## Implementation Status

### ✅ Phase 1: Foundation (100 tests)
- **Cache + Loading States** (13 tests)
- **7 Core Wrappers** (41 tests): CoMap, CoList, CoStream, CoBinary, Account, Group, CoPlainText
- **JSON Schema Validation** (46 tests): SchemaValidator, preprocessSchema, ValidationError

### ✅ Milestones 4-5: Reactive CRUD (27 tests)
- **Reference Resolver** (7 tests): Auto-resolve co-ids, circular detection
- **Subscription Cache** (9 tests): Deduplication, 5-second cleanup, reactivity
- **MaiaCRUD API** (11 tests): JSON-based create/read/update/delete

### ✅ Schema-as-CoMaps Architecture (18 tests)
- **SchemaStore** (12 tests): Registry, MetaSchema, inference, linking
- **CRUD Integration** (6 tests): schemaId-based creation, listing, backwards compat

**Total: 145 tests passing!** 🎉

**All tests use REAL CRDTs** (Zero Mocks Policy enforced)

## Quick Start

```bash
# Install dependencies
bun install

# Run dev server
bun dev  # Opens http://localhost:5174

# Run tests
bun test
```

## Quick Start Example

```javascript
import { MaiaCRUD } from '@maiaos/maia-cojson';
import { LocalNode } from 'cojson';
import { WasmCrypto } from 'cojson/crypto/WasmCrypto';

// Initialize cojson
const crypto = await WasmCrypto.create();
const { node, accountID } = await LocalNode.withNewlyCreatedAccount({
  creationProps: { name: "Demo User" },
  peers: [],
  crypto,
});
const group = node.createGroup();

// Create Schema CoMap (system meta) and Data CoMap (user data)
const schema = group.createMap();
const data = group.createMap();

// Create MaiaDB API with Schema and Data
const db = new MaiaDB({ node, accountID, group, schema, data });

// Bootstrap MetaSchema (self-referencing)
await db.initialize();

// Register schemas in dependency order (explicit, no auto-inference!)
const authorSchemaId = await db.registerSchema("Author", {
  type: "co-map",
  properties: {
    name: { type: "string" }
  }
});

const postSchemaId = await db.registerSchema("Post", {
  type: "co-map",
  properties: {
    title: { type: "string" },
    content: { type: "string" },
    author: { 
      "$ref": `https://maia.city/${authorSchemaId}`  // Native JSON Schema $ref!
    },
    likes: { type: "number" },
  },
  required: ["title", "content"],
});

// CREATE post using schema ID
const { entity, entityId } = await db.create({
  schemaId: postSchemaId,
  data: {
    title: "Hello World",
    content: "This is collaborative!",
    author: accountID,
    likes: 0,
  },
});

console.log(entityId); // Real CRDT ID: co_z...

// UPDATE directly through wrapper (proxy updates CRDT)
entity.likes = 42;
entity.title = "Updated Title";

// READ (100% reactive, auto-subscribed)
const loaded = await db.read({
  id: entityId,
});

console.log(loaded.title); // "Updated Title"

// List all schemas (with complete JSON Schema specs)
const schemas = await db.schemaStore.listSchemas();
console.log(schemas[0].definition);
// {
//   "$schema": "https://maia.city/co_zMetaId",
//   "$id": "https://maia.city/co_zPostId",
//   "type": "co-map",
//   "properties": {...}
// }

// loaded.likes is now 42 (automatic reactive update!)

// DELETE post
await db.delete({ id: entity.$id });
```

## Schema-as-CoMaps Architecture

### Clean Hierarchy

```
Group
  ├─ Schema CoMap (system meta)
  │   ├─ Genesis: co-id → MetaSchema
  │   └─ Registry: co-id → CoList of all schemas
  └─ Data CoMap (user data)
      └─ [Your application data]
```

Schemas are stored as collaborative CoMaps in `Schema.Registry` (a CoList), enabling schema evolution, discovery, and proper co-id reference handling.

### MetaSchema (Self-Referencing)

Self-referencing meta-schema that validates all other schemas:

```javascript
// Bootstrap MetaSchema
await db.initialize();

// MetaSchema structure (complete JSON Schema spec!):
{
  "$schema": "co_zMetaSchemaId",  // Raw co-id in CoMap property
  "name": "MetaSchema",
  "definition": {
    "$schema": "https://maia.city/co_zMetaSchemaId",  // URI format!
    "$id": "https://maia.city/co_zMetaSchemaId",      // URI format!
    "type": "co-map",
    "properties": { 
      "$schema": { "type": "co-id" },
      "name": { "type": "string" },
      "definition": { "type": "object" },
      // ... JSON Schema 2020 + x-co-* extensions
    }
  }
}
```

### Registering Schemas

```javascript
// Register a schema (stored as CoMap)
const postSchemaId = await o.registerSchema("PostSchema", {
  type: "co-map",
  properties: {
    title: { type: "string" },
    author: { type: "co-id" } // Auto-creates authorSchema
  },
  required: ["title"]
});

// Schema is now in Schema.Registry (CoList)
```

### Explicit Dependencies Required

All co-id properties MUST have explicit `x-co-schema`. No auto-inference!

```javascript
// ❌ This will throw an error:
await db.registerSchema("Bad", {
  properties: {
    author: { type: "co-id" } // Missing x-co-schema!
  }
});
// Error: co-id property "author" must have x-co-schema reference

// ✅ Correct approach:
// 1. Register Author first
const authorSchemaId = await db.registerSchema("Author", {...});

// 2. Reference it explicitly
await db.registerSchema("Post", {
  properties: {
    author: { 
      type: "co-id",
      "x-co-schema": authorSchemaId  // Explicit!
    }
  }
});
```

**Why explicit?** Clearer dependencies, easier debugging, no magic.

### Complete Schema Example

```javascript
// Register in dependency order
const authorSchemaId = await db.registerSchema("Author", {
  type: "co-map",
  properties: {
    name: { type: "string" },
    email: { type: "string" }
  }
});

const postSchemaId = await db.registerSchema("Post", {
  type: "co-map",
  properties: {
    title: { type: "string" },
    author: { 
      "$ref": `https://maia.city/${authorSchemaId}`  // Native JSON Schema $ref!
    }
  },
  required: ["title", "author"]
});

// The stored definition has complete JSON Schema spec:
// {
//   "$schema": "https://maia.city/co_zMetaId",
//   "$id": "https://maia.city/co_zPostId",
//   "type": "co-map",
//   "properties": {
//     "title": { "type": "string" },
//     "author": {
//       "$ref": "https://maia.city/co_zAuthorId"  // Standard JSON Schema!
//     }
//   },
//   "required": ["title", "author"]
// }
```

### Schema Discovery

List all registered schemas:

```javascript
const schemas = await o.schemaStore.listSchemas();
// Returns: [
//   { name: "MetaSchema", id: "co_z...", definition: {...} },
//   { name: "PostSchema", id: "co_z...", definition: {...} },
//   { name: "authorSchema", id: "co_z...", definition: {...} }
// ]
```

### Creating Entities

Use schema co-ids (type inferred from schema):

```javascript
const { entity, entityId } = await db.create({
  schemaId: postSchemaId, // Just the co-id - type inferred from definition
  data: { 
    title: "My Post",
    author: authorEntity  // Can pass CoValue wrapper (extracts $id automatically)
  }
});
```

**Note:** No `type` parameter needed - inferred from schema definition.

## JSON Schema Co-Types

MaiaCojson extends JSON Schema with CRDT types:

| Co-Type | JSON Schema | Description |
|---------|-------------|-------------|
| `co-map` | `object` | Collaborative key-value map |
| `co-list` | `array` | Collaborative ordered list |
| `co-stream` | `array` | Append-only stream |
| `co-binary` | `string` | Binary data stream |
| `co-account` | `object` | User identity |
| `co-group` | `object` | Permission group |
| `co-plaintext` | `string` | Collaborative text |
| `co-id` | `string` | Reference to another CoValue (pattern: `^co_z[a-zA-Z0-9]+$`) |

## Schema Preprocessing

MaiaCojson automatically converts `co-*` types to Ajv-compatible formats:

```javascript
// Input schema
{
  type: "co-map",
  properties: {
    author: { type: "co-id" }
  }
}

// Preprocessed for Ajv
{
  type: "object",
  "x-co-type": "co-map",  // Original type preserved
  properties: {
    author: { 
      type: "string",
      pattern: "^co_z[a-zA-Z0-9]+$",
      "x-co-type": "co-id"
    }
  }
}
```

## Project Structure

```
maia-cojson/
├── src/
│   ├── lib/              # Core utilities
│   │   ├── cache.js      # Instance cache (WeakMap)
│   │   └── loading-states.js  # Loading state enum
│   │
│   ├── wrappers/         # CRDT wrappers
│   │   ├── CoMap.js      # Key-value maps
│   │   ├── CoList.js     # Ordered lists
│   │   ├── CoStream.js   # Append-only streams
│   │   ├── CoBinary.js   # Binary streams
│   │   ├── Account.js    # User identity
│   │   ├── Group.js      # Permissions
│   │   └── CoPlainText.js # Collaborative text
│   │
│   ├── validation/       # JSON Schema validation
│   │   ├── schema-validator.js      # Main validator
│   │   ├── schema-preprocessor.js   # Co-type converter
│   │   └── errors.js                # Error formatting
│   │
│   ├── app/              # Example application
│   │   ├── main.js       # Blog demo
│   │   └── style.css     # Styling
│   │
│   └── index.js          # Main exports
│
├── package.json          # Dependencies
├── vite.config.js        # Dev server config
└── README.md             # This file
```

## Sync Peer Setup

`@MaiaOS/db` provides client-side peer setup functions for connecting to the self-hosted sync service:

### `setupSyncPeers(options)`

Configure `LocalNode` to connect to the sync service via WebSocket.

**Parameters:**
- `options.node` (LocalNode, required) - The LocalNode instance to configure
- `options.syncDomain` (string, optional) - Sync service domain (defaults to relative `/sync` in browser, or `PUBLIC_API_DOMAIN` env var)

**Returns:** `Promise<void>`

**Example:**
```javascript
import { setupSyncPeers } from '@MaiaOS/db';

// After creating/loading account
const { node, account } = await signUpWithPasskey();

// Configure sync peers (connects to sync service automatically)
await setupSyncPeers({
  node,
  syncDomain: 'wss://sync.maia.city' // Optional, defaults to relative path
});
```

### `subscribeSyncState(listener)`

Subscribe to sync status changes (connection state, syncing status, errors).

**Parameters:**
- `listener` (Function) - Callback: `(state) => void`
  - `state.connected` (boolean) - WebSocket connected?
  - `state.syncing` (boolean) - Actively syncing?
  - `state.error` (string | null) - Error message if any
  - `state.status` (string | null) - Status: 'authenticating' | 'loading-account' | 'syncing' | 'connected' | 'error'

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
import { subscribeSyncState } from '@MaiaOS/db';

const unsubscribe = subscribeSyncState((state) => {
  console.log("Sync:", state.connected ? "Online" : "Offline");
  if (state.error) {
    console.error("Sync error:", state.error);
  }
});

// Later: unsubscribe when done
unsubscribe();
```

**Note:** These functions are also available via `@MaiaOS/kernel` bundle for convenience.

## Dependencies

- **cojson**: ^0.19.21 - Provides REAL `RawCoMap`, `RawCoList`, `LocalNode`, etc.
- **ajv**: ^8.12.0 - JSON Schema validator
- **cojson-transport-ws**: ^0.20.7 - WebSocket transport for sync peers

## Future Enhancements (Phase 2)

- ☐ Higher-order types (CoFeed, CoVector, ImageDefinition)
- ☐ Deep query DSL (`$each`, `$onError`)
- ☐ Framework integrations (Svelte stores, React hooks)
- ☐ Depth control for reference resolution

## License

Part of MaiaOS project
