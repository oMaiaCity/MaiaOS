# maia-db: Database Backends

## Overview

The `@MaiaOS/db` package provides database backends for MaiaOS. Currently, it includes the CoJSON CRDT backend implementation, with plans to implement the `DBAdapter` interface from `@MaiaOS/operations` to unify operations across backends.

**What it is:**
- ✅ **CoJSON backend** - CRDT-based collaborative database backend
- ✅ **CoValue services** - Services for creating and managing CoValues
- ✅ **Schema integration** - Schema metadata utilities for CoValues

**What it isn't:**
- ❌ **Not the operations layer** - Operations are in `@MaiaOS/operations`
- ❌ **Not the IndexedDB backend** - IndexedDB backend is in `@MaiaOS/script`
- ❌ **Not the database engine** - DBEngine is in `@MaiaOS/operations`

---

## The Simple Version

Think of `maia-db` like a specialized storage system:

- **CoJSON backend** = A collaborative storage system where multiple people can edit at the same time
- **CoValue services** = Helpers for creating and managing collaborative data structures
- **Schema integration** = Connects your schemas to the collaborative storage

**Analogy:**
Imagine you have two storage systems:
- **IndexedDB** = A local filing cabinet (fast, local-only)
- **CoJSON** = A shared Google Doc (collaborative, syncs across devices)

Both storage systems will eventually speak the same language (`DBAdapter` interface) so you can use the same operations regardless of which one you choose.

---

## Architecture

### Current Structure

```
libs/maia-db/src/
├── cojson/                    # CoJSON backend implementation
│   ├── backend/               # Backend adapter (future: implements DBAdapter)
│   ├── operations/             # CoJSON-specific operations
│   └── factory.js             # Factory for creating CoJSON instances
├── services/                  # CoValue creation services
│   ├── oGroup.js              # Group creation
│   ├── oID.js                 # ID generation
│   ├── oMap.js                # CoMap creation
│   ├── oList.js               # CoList creation
│   └── ...
├── schemas/                   # Schema system integration
│   ├── registry.js            # Schema registry
│   ├── validation.js          # Schema validation
│   └── ...
└── migrations/                # Database migrations
```

### Future Integration

The CoJSON backend will implement the `DBAdapter` interface from `@MaiaOS/operations`:

```
┌─────────────────────────────────────────┐
│         @MaiaOS/operations               │
│  (DBEngine, Operations, DBAdapter)       │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        ↓                   ↓
┌───────────────┐   ┌───────────────┐
│ IndexedDB     │   │ CoJSON        │
│ Backend       │   │ Backend       │
│ (implements   │   │ (implements   │
│  DBAdapter)   │   │  DBAdapter)   │
└───────────────┘   └───────────────┘
```

---

## Documentation

- **[CoJSON Architecture](./cojson.md)** - Complete layer hierarchy from cryptographic primitives to high-level CoValues

---

## Related Documentation

- [maia-operations Package](../06_maia-operations/README.md) - Shared operations layer and DBAdapter interface
- [maia-script Package](../04_maia-script/README.md) - IndexedDB backend implementation
- [maia-schemata Package](../03_maia-schemata/README.md) - Schema validation and transformation

---

## Source Files

**Package:** `libs/maia-db/`

**Key Files:**
- `src/cojson/` - CoJSON backend implementation
- `src/services/` - CoValue creation services
- `src/schemas/` - Schema system integration

**Dependencies:**
- `cojson` - CRDT library
- `@MaiaOS/schemata` - Schema validation
