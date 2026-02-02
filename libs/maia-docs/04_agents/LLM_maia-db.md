# MaiaOS Documentation for maia-db

**Auto-generated:** 2026-02-02T15:39:15.393Z
**Purpose:** Complete context for LLM agents working with MaiaOS

---

# COJSON

*Source: developers/cojson.md*

# cojson/CRDT Architecture

**Complete hierarchy from lowest-level primitives to high-level CoValues**


---

## Overview

This document maps the complete cojson architecture from cryptographic primitives (Layer 0) to application-level CoValues (Layer 7+), showing what composes what and how the CRDT system works under the hood.

---

## Architecture Layers (Lowest → Highest)

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 0: CRYPTOGRAPHIC PRIMITIVES                          │
├─────────────────────────────────────────────────────────────┤
│ • Hash (Blake3)                                             │
│ • Signature (Ed25519)                                       │
│ • Encryption (XSalsa20, X25519)                             │
│ • KeyID, KeySecret, SignerID                                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: IDENTIFIERS                                        │
├─────────────────────────────────────────────────────────────┤
│ • RawCoID: "co_z..." (CoValue ID)                           │
│ • SessionID: "co_zXXX_session_zYYY"                         │
│ • TransactionID: SessionID + txIndex                        │
│ • AgentID: "signer_z..." or "sealer_z..."                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: TRANSACTIONS & OPERATIONS                         │
├─────────────────────────────────────────────────────────────┤
│ • Transaction: Single atomic change                         │
│   - madeAt: timestamp                                       │
│   - changes: JsonValue[] (encrypted ops)                    │
│   - meta: JsonObject (transaction metadata)                 │
│ • VerifiedTransaction: Validated transaction                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: CORE VALUE HEADER & VERIFIED STATE               │
├─────────────────────────────────────────────────────────────┤
│ • CoValueHeader:                                            │
│   - type: "comap" | "colist" | "costream" | "coplaintext"   │
│   - ruleset: ownership/permissions rules                    │
│   - meta: headerMeta (JsonObject | null)                    │
│   - createdAt: timestamp                                    │
│                                                             │
│ • VerifiedState: Validated header + transactions            │
│   - header: CoValueHeader                                   │
│   - sessions: Map<SessionID, Transaction[]>                 │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: CoValueCore (The CRDT Engine)                     │
├─────────────────────────────────────────────────────────────┤
│ • CoValueCore: Low-level CRDT state machine                 │
│   - id: RawCoID                                             │
│   - verified: VerifiedState                                 │
│   - node: LocalNode                                         │
│   - Methods:                                                │
│     • processTransaction()                                  │
│     • getCurrentContent() → RawCoValue                      │
│     • subscribe()                                           │
│     • createBranch()                                        │
│     • mergeBranch()                                         │
│                                                             │
│ ** THIS IS WHERE THE CRDT MAGIC HAPPENS **                  │
│ All conflict resolution, merging, and sync                  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5: RawCoValue (Base Interface)                       │
├─────────────────────────────────────────────────────────────┤
│ Common interface for ALL CoValue types:                     │
│ • id: CoID<T>                                               │
│ • core: CoValueCore                                         │
│ • type: string                                              │
│ • headerMeta: JsonObject | null  ← YOUR $schema HERE!       │
│ • group: RawGroup                                           │
│ • toJSON(): JsonValue                                       │
│ • subscribe()                                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
          ┌──────────────┴──────────────┐
          ↓                             ↓
┌─────────────────────┐    ┌─────────────────────────┐
│ LAYER 6A:           │    │ LAYER 6B:               │
│ BASE CRDT TYPES     │    │ SPECIAL CRDT TYPES      │
├─────────────────────┤    ├─────────────────────────┤
│ 1. RawCoMap         │    │ 1. RawCoList            │
│    type: "comap"    │    │    type: "colist"       │
│    ↓                │    │    • Ordered CRDT list  │
│    Key-value CRDT   │    │    • insert/delete/move │
│    with ops:        │    │                         │
│    • set(k, v)      │    │ 2. RawCoPlainText       │
│    • delete(k)      │    │    type: "coplaintext"  │
│    • get(k)         │    │    • Character CRDT     │
│                     │    │    • append/insert/del  │
│ 2. RawCoStream      │    │                         │
│    type: "costream" │    │ 3. RawBinaryCoStream    │
│    ↓                │    │    type: "costream"     │
│    Append-only log  │    │    meta: {type:"binary"}│
│    • push(item)     │    │    • Binary chunks      │
│    • Session-based  │    │    • push(Uint8Array)   │
│                     │    │                         │
└─────────────────────┘    └─────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 7: SPECIALIZED CoMaps (Subclasses)                   │
├─────────────────────────────────────────────────────────────┤
│ RawGroup extends RawCoMap                                   │
│   type: "comap"                                             │
│   ruleset.type: "group"                                     │
│   headerMeta: null (no schema, cojson limitation)           │
│   Special methods:                                          │
│   • addMember(agent, role)                                  │
│   • createMap(init, meta) → RawCoMap                        │
│   • createList(init, meta) → RawCoList                      │
│   • createStream(meta) → RawCoStream                        │
│   • createBinaryStream(meta) → RawBinaryCoStream            │
│   • createPlainText(text, meta) → RawCoPlainText            │
│                                                             │
│ RawAccount extends RawCoMap                                 │
│   type: "comap"                                             │
│   ruleset.type: "group" (yes, Account IS a Group!)          │
│   headerMeta: {type: "account"} (built-in cojson)           │
│   Special properties:                                       │
│   • profile: CoID<RawCoMap>                                 │
│   • Keys for crypto (sealer, signer, readKey)               │
│                                                             │
│ Profile (just a RawCoMap with convention)                   │
│   type: "comap"                                             │
│   headerMeta: {$schema: "ProfileSchema"} (by YOU!)          │
│   Typical properties:                                       │
│   • name: string                                            │
│   • ... (any JSON data)                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Type System

### Type Discrimination Logic

From `coreToCoValue.ts` - how cojson determines which class to instantiate:

```typescript
if (type === "comap") {
  if (ruleset === "group") {
    if (meta.type === "account") → RawAccount
    else → RawGroup
  } else → RawCoMap
}
else if (type === "colist") → RawCoList
else if (type === "costream") {
  if (meta.type === "binary") → RawBinaryCoStream
  else → RawCoStream
}
else if (type === "coplaintext") → RawCoPlainText
```

---

## What Composes What

```
Account (CoMap + special meta)
  ↳ owns → Group (CoMap + group ruleset)
      ↳ creates → Profile (CoMap with your schema)
      ↳ creates → ProfileList (CoList with your schema)
      ↳ creates → ActivityStream (CoStream with your schema)
      ↳ creates → AvatarStream (BinaryCoStream with your schema)
      ↳ creates → BioText (CoPlainText with your schema)
```

---

## The 4 Base CRDT Types

| Type | Internal Structure | Operations | Use Case |
|------|-------------------|------------|----------|
| **CoMap** | `Map<string, JsonValue>` | set, delete, get | Objects, documents |
| **CoList** | Ordered list with CRDT positions | insert, delete, move | Arrays, todo lists |
| **CoStream** | Session-based append log | push (append-only) | Events, messages, logs |
| **CoPlainText** | Character-based CRDT | append, insert, delete | Text editing, documents |

---

## CoStream vs CoList - Key Differences

### CoList (Collaborative List)
- **Ordered collection** with **positional editing**
- Can **insert, delete, move** items at specific indices
- Items can be **reordered**
- **Structure**: `[item1, item2, item3]`
- **Use cases**: Todo lists, ordered collections, reorderable arrays

### CoStream (Append-Only Log)
- **Immutable append-only** log
- Items organized by **session** (who wrote them)
- **Cannot delete or edit** once pushed
- **Structure**: `{ session_id: [items...], another_session: [items...] }`
- **Use cases**: Activity logs, chat messages, audit trails, event sourcing

### BinaryCoStream
- Same as CoStream but for **binary data** (Uint8Array)
- Push **chunks of bytes**
- **Use cases**: Images, files, video streams, audio

---

## Your Schema Layer (Layer 8)

MaiaOS extends cojson with a schema system using `headerMeta`:

```
headerMeta: { $schema: "YourSchema" }  ← Layer 8: YOUR APPLICATION
         ↓
    RawCoValue (Layer 5)
         ↓
    CoValueCore (Layer 4) ← The CRDT magic happens here
         ↓
    Transactions (Layer 2) ← Synced across peers
```

### Why This Works

- **Proven CRDT primitives** (Layer 4) handle all conflict resolution
- **Your schema system** (Layer 8) adds semantic meaning
- **Zero breaking changes** to cojson - pure extension via `headerMeta`
- **Type-safe** through `$schema` references
- **Inspectable** - all schemas visible in CoValue metadata

---

## Example: Full Stack

### Creating a Profile

```javascript
// Layer 8: Your schema
const profileMeta = { $schema: "ProfileSchema" };

// Layer 7: Create via Group
const profile = group.createMap({ name: "Alice" }, profileMeta);

// Layer 6: RawCoMap instance
// Layer 5: Implements RawCoValue interface
// Layer 4: CoValueCore handles CRDT operations
// Layer 3: Header + VerifiedState
// Layer 2: Transactions synced
// Layer 1: IDs generated
// Layer 0: Crypto operations
```

### Resulting CoValue

```javascript
{
  id: "co_z...",              // Layer 1
  type: "comap",              // Layer 5
  headerMeta: {               // Layer 8 (YOUR LAYER!)
    $schema: "ProfileSchema"
  },
  group: RawGroup,            // Layer 7
  core: CoValueCore           // Layer 4 (CRDT engine)
}
```

---

## Key Insights

1. **Account IS a Group** - with special `meta.type = "account"`
2. **BinaryCoStream IS a CoStream** - with special `meta.type = "binary"`
3. **Groups can't have schemas** - `createGroup()` hardcodes `meta: null`
4. **Accounts have built-in meta** - cojson sets `{type: "account"}` automatically
5. **Everything else supports schemas** - CoMap, CoList, CoStream, CoPlainText via `meta` parameter

---

## References

- **Source**: `libs/maia-db/node_modules/cojson/src/`
  - `coValue.ts` - RawCoValue interface
  - `coreToCoValue.ts` - Type discrimination logic
  - `coValueCore/coValueCore.ts` - CRDT engine
  - `coValues/` - All CoValue implementations

- **MaiaOS Extensions**:
  - `libs/maia-db/src/services/` - CoValue creation services
  - `libs/maia-db/src/utils/meta.js` - Schema metadata utilities
  - `libs/maia-core/src/o.js` - Inspector with schema support

---

## Operations Layer Integration

The CoJSON backend will implement the `DBAdapter` interface from `@MaiaOS/operations`, allowing it to use the same unified operations layer as the IndexedDB backend.

**Future Integration:**
- CoJSON backend will implement `DBAdapter` interface
- Operations (read, create, update, delete) will work identically for both backends
- Same `DBEngine` API regardless of backend choice

**Related Documentation:**
- [maia-operations Package](../06_maia-operations/README.md) - Shared operations layer and DBAdapter interface

---

# README

*Source: developers/README.md*

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

---

