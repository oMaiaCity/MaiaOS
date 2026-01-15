# MaiaCojson - JSON-based Reactive CRDT Layer

**Complete Implementation** ✅ - 127 tests passing!

A JSON Schema-native CRDT wrapper with a purely JSON-based reactive CRUD API for collaborative data management.

## Why MaiaCojson?

- **Pure JSON API**: `o.create({})`, `o.read({})`, `o.update({})`, `o.delete({})`
- **100% Reactive**: Auto-subscribed, updates automatically
- **Auto-Resolution**: Nested references resolve automatically
- **Real CRDTs**: Built on `cojson` package (not jazz-tools!)
- **Zero Mocks**: All tests use real collaborative data structures
- **Type Safe**: JSON Schema validation with Ajv

## Architecture

```
User Code (JSON Config)
        ↓
  MaiaCojson Wrappers (CoMap, CoList, etc.)
        ↓
  Real CRDT Types (RawCoMap, RawCoList)
        ↓
    cojson (from jazz-tools)
```

## Implementation Status

### ✅ Phase 1: Foundation (100 tests)
- **Cache + Loading States** (13 tests)
- **7 Core Wrappers** (41 tests): CoMap, CoList, CoStream, CoBinary, Account, Group, CoPlainText
- **JSON Schema Validation** (46 tests): SchemaValidator, preprocessSchema, ValidationError

### ✅ Milestones 4-5: Reactive CRUD (27 tests)
- **Reference Resolver** (7 tests): Auto-resolve co-ids, circular detection
- **Subscription Cache** (9 tests): Deduplication, 5-second cleanup, reactivity
- **MaiaCRUD API** (11 tests): JSON-based create/read/update/delete

**Total: 127 tests passing!** 🎉

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

// Create MaiaCRUD API
const o = new MaiaCRUD({ node, accountID, group });

// Define schema
const POST_SCHEMA = {
  type: "co-map",
  properties: {
    title: { type: "string" },
    content: { type: "string" },
    author: { type: "co-id" },
    likes: { type: "number" },
  },
  required: ["title", "content"],
};

// CREATE post (JSON operation)
const post = await o.create({
  type: "co-map",
  schema: POST_SCHEMA,
  data: {
    title: "Hello World",
    content: "This is collaborative!",
    author: accountID,
    likes: 0,
  },
});

console.log(post.$id); // Real CRDT ID: co_z...

// READ post (100% reactive, auto-subscribed)
const loaded = await o.read({
  id: post.$id,
  schema: POST_SCHEMA,
});

console.log(loaded.title); // "Hello World"

// UPDATE post (JSON operation)
await o.update({
  id: post.$id,
  data: { likes: 42 },
});

// loaded.likes is now 42 (automatic reactive update!)

// DELETE post
await o.delete({ id: post.$id });
```

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

## Dependencies

- **cojson**: ^0.19.21 - Provides REAL `RawCoMap`, `RawCoList`, `LocalNode`, etc.
- **ajv**: ^8.12.0 - JSON Schema validator

## Future Enhancements (Phase 2)

- ☐ Higher-order types (CoFeed, CoVector, ImageDefinition)
- ☐ Deep query DSL (`$each`, `$onError`)
- ☐ Framework integrations (Svelte stores, React hooks)
- ☐ Depth control for reference resolution

## License

Part of MaiaOS project
