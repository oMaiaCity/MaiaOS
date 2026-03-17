# cojson/CRDT Architecture

**Complete hierarchy from lowest-level primitives to high-level CoValues**


---

## Overview

This document maps the complete cojson architecture from cryptographic primitives (Layer 0) to application-level CoValues (Layer 7+), showing what composes what and how the CRDT system works under the hood.

**Raw CoJSON types:** comap, colist, costream, cobinary. These are the only types at the CRDT layer.

**CoText:** Plaintext CRDT content is supported via `°Maia/factory/os/cotext` – implemented as **colist** with grapheme items. Notes, wasm code, and paper content use this. CoText is an abstraction (colist + schema), not a raw type.

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
│   - type: "comap" | "colist" | "costream" | "cobinary"               │
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
│    • set(k, v)      │    │ 2. RawBinaryCoStream    │
│    • delete(k)      │    │    type: "costream"     │
│    • get(k)         │    │    meta: {type:"binary"}│
│                     │    │    • Binary chunks      │
│ 2. RawCoStream      │    │    • push(Uint8Array)   │
│    type: "costream" │    │                         │
│    ↓                │    │                         │
│    Append-only log  │    │                         │
│    • push(item)     │    │                         │
│    • Session-based  │    │                         │
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
│   headerMeta: {$factory: "ProfileFactory"} (by YOU!)          │
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
```

---

## The 4 Base CRDT Types

| Type | Internal Structure | Operations | Use Case |
|------|-------------------|------------|----------|
| **CoMap** | `Map<string, JsonValue>` | set, delete, get | Objects, documents |
| **CoList** | Ordered list with CRDT positions | insert, delete, move | Arrays, todo lists |
| **CoStream** | Session-based append log | push (append-only) | Events, messages, logs |

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
headerMeta: { $factory: "YourSchema" }  ← Layer 8: YOUR APPLICATION
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
- **Type-safe** through `$factory` references
- **Inspectable** - all schemas visible in CoValue metadata

---

## Example: Full Stack

### Creating a Profile

```javascript
// Layer 8: Your schema
const profileMeta = { $factory: "ProfileFactory" };

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
    $factory: "ProfileFactory"
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
5. **Everything else supports schemas** - CoMap, CoList, CoStream via `meta` parameter

---

## References

- **cojson:** `node_modules/cojson/src/` - RawCoValue, coreToCoValue, coValueCore, coValues
- **MaiaOS:** `libs/maia-db/src/cojson/` - MaiaDB, CRUD, schema resolution

**Related:** [maia-engines](../04_maia-engines/README.md) - DataEngine (maia.do) calls MaiaDB
