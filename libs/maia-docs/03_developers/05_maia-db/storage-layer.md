# Storage Layer: CRUD, Read API, CoCache

## Overview

MaiaDB is the single storage layer for MaiaOS. It provides CRUD operations, a universal read API, and CoCache for reactive subscriptions. DataEngine (maia.do) in maia-engines calls MaiaDB for all data operations.

---

## The Simple Version

Think of MaiaDB like a collaborative filing cabinet. When you ask for something, it returns a live document that updates automatically when anyone changes it. The CoCache keeps everything organized and avoids duplicate lookups.

---

## Data Flow

```
maia.do({ op: 'read', schema, filter, ... })  →  DataEngine  →  MaiaDB.read()
                                                                    ↓
                                                         Universal read() + CoCache
                                                                    ↓
                                                         cojson (RawCoMap, RawCoList, RawCoStream)
```

---

## Universal Read API

One `read()` function handles all CoValue types:

- **Single CoValue** (by co-id): `read(peer, coId, ...)`
- **Collection** (by schema): `read(peer, null, schema, filter, ...)`
- **All CoValues** (no schema): `read(peer, null, null, filter, ...)`

**Progressive loading:** Returns immediately with `{loading: true}` or empty array. Subscriptions update when data becomes available.

### Query Objects and Reactive Resolution

Context can contain query objects:

```json
{
  "todos": { "schema": "co_zTodos123", "filter": { "completed": false } },
  "sparkDetails": { "schema": "co_zSpark123", "filter": { "id": "$sparkId" } }
}
```

The unified store detects queries, evaluates filters (e.g., `$sparkId` from context), executes reads, and merges results into context. When context changes, filters re-evaluate and queries re-run.

### Deep Resolution

Nested CoValue references are resolved recursively (configurable max depth, default 15). Non-blocking—returns progressively.

### Map Transformations

On-demand ref resolution via MaiaScript expressions:

```javascript
options: { map: { targetKey: "$sourcePath" } }
```

Automatic subscription to mapped dependencies.

---

## CoCache

Unified cache for subscriptions, stores, resolutions, and resolved data.

**Key types:**
- `subscription:${id}` - CoValue subscriptions
- `store:${key}` - ReactiveStore instances
- `resolution:${id}` - Resolution tracking
- `resolved:${coId}:${options}` - Resolved data

**Features:**
- Auto-cleanup after 5 seconds (configurable)
- Node-aware (clears on node change)
- Memory leak prevention via cleanup timers
- Deduplication (same query → same store)

**Usage:** `getOrCreate(key, factory)` - Get existing or create new. CoCache handles lifecycle.

**Source:** `libs/maia-db/src/cojson/cache/coCache.js`

---

## CRUD Flow

| Operation | Flow |
|-----------|------|
| Create | `peer.create(schemaCoId, data, options)` → Schema index updated |
| Update | `peer.update(coId, data)` → Pre-CRDT validation |
| Delete | `peer.delete(coId)` → Automatic index removal |
| Read | `peer.read(schema, key, keys, filter, options)` → ReactiveStore |

---

## Universal Schema Resolver

Single `resolve()` API for all identifier types:

- **Co-id** (`co_z...`) → Direct load
- **Registry key** (`°Maia/schema/...`) → Resolves via `spark.os.schemata`
- **fromCoValue** (`{ fromCoValue: 'co_z...' }`) → Extracts schema from headerMeta

**Return types:** `coId`, `schema`, `coValue` (ReactiveStore)

**Reactive resolution:** `resolveReactive()`, `waitForReactiveResolution()` - For query objects in context with progressive loading.

**Source:** `libs/maia-db/src/cojson/schema/resolver.js`

---

## Local-First Architecture

Updates are instant locally. Storage sync happens asynchronously. No blocking `waitForStorageSync()`—everything is reactive.

---

## Related Documentation

- [cojson.md](./cojson.md) - CoJSON layer hierarchy
- [schema-indexing.md](./schema-indexing.md) - Automatic schema indexing
- [seeding.md](./seeding.md) - Bootstrap and seed
- [maia-engines](../04_maia-engines/README.md) - DataEngine (maia.do)
