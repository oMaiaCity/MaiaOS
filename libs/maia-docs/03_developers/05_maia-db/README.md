# maia-db: MaiaDB Storage Layer

## Overview

The `@MaiaOS/db` package provides **MaiaDB** – the storage layer for MaiaOS. CoJSON CRDT backend. DataEngine (maia.do) in maia-engines calls MaiaDB for all data operations.

**What it is:**
- ✅ **MaiaDB** - Single class: CRUD, resolve, indexing, seeding
- ✅ **CoValue services** - Services for creating and managing CoValues
- ✅ **Seeding** - `migrations/seeding/` (bootstrap, configs, data, helpers)
- ✅ **Schema integration** - Schema metadata utilities for CoValues

**What it isn't:**
- ❌ **Not the data API** - **maia.do()** (DataEngine) is in `@MaiaOS/engines`
- ❌ **Not the P2P layer** - Node, account, sync are in `@MaiaOS/peer`

---

## The Simple Version

Think of `maia-db` like a specialized storage system:

- **CoJSON backend** = A collaborative storage system where multiple people can edit at the same time
- **CoValue services** = Helpers for creating and managing collaborative data structures
- **Schema integration** = Connects your schemas to the collaborative storage

**Analogy:**
MaiaDB is the storage layer – CoJSON CRDT (collaborative, syncs). DataEngine (maia.do) is the public API; it calls MaiaDB for all operations.

---

## Architecture

### Structure

```
libs/maia-db/src/
├── cojson/                    # CoJSON / MaiaDB implementation
│   ├── core/MaiaDB.js         # MaiaDB – single storage class
│   ├── crud/                  # read, create, update, delete
│   ├── groups/                # Groups, sparks, coID
│   └── ...
├── migrations/seeding/        # Bootstrap, configs, data, helpers
├── schemas/                   # Schema registry, validation
└── utils/                     # registry-name-generator, etc.
```

### API Flow

```
maia.do({ op, schema, key, ... })  →  DataEngine  →  MaiaDB  →  MaiaPeer / storage
```

---

## Documentation

- **[cojson.md](./cojson.md)** - Complete layer hierarchy (cryptographic primitives to CoValues)
- **[storage-layer.md](./storage-layer.md)** - CRUD flow, universal read API, CoCache
- **[schema-indexing.md](./schema-indexing.md)** - Automatic schema-based indexing
- **[seeding.md](./seeding.md)** - Bootstrap and seed system
- **[groups.md](./groups.md)** - Groups and sparks

---

## Related Documentation

- [maia-engines Package](../04_maia-engines/README.md) - DataEngine (maia.do)
- [maia-schemata Package](../03_maia-schemata/README.md) - Schema validation and transformation

---

## Source Files

**Package:** `libs/maia-db/`

**Key Files:**
- `src/cojson/` - CoJSON backend implementation
- `src/cojson/core/MaiaDB.js` - MaiaDB
- `src/schemas/` - Schema system integration

**Dependencies:**
- `cojson` - CRDT library
- `@MaiaOS/schemata` - Schema validation
