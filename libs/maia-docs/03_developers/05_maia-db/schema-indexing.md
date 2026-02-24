# Schema Indexing

## Overview

MaiaDB automatically indexes CoValues by schema. Indexes are stored in `spark.os.indexes` keyed by schema co-id. When you create, update, or delete a CoValue, the index is updated automatically—no manual seeding needed.

---

## The Simple Version

Think of schema indexes like a library's card catalog. When you add a new book (CoValue), it's automatically added to the right section (schema index). Queries use these indexes to find CoValues quickly.

---

## Structure

```
spark.os.schematas   →  "°Maia/schema/namekey" → schema co-id (registry)
spark.os.indexes     →  schema-co-id → colist of instance co-ids (index)
spark.os.unknown     →  colist of co-values without schemas
```

**Location:** `account.registries.sparks[°Maia].os` (or system spark)

---

## Automatic Indexing

Storage-level hooks catch **all writes**:
- CRUD operations (create, update, delete)
- Sync (incoming from other peers)
- Direct CoJSON operations

**On create:** Co-value added to its schema's index colist before vibe/context references.
**On update:** If schema changes, remove from old index, add to new.
**On delete:** Co-value removed from schema index.

---

## Index Colist Schemas

Each schema index uses a colist with `$co` type safety for instance co-ids.

---

## Schema Registration

When a schema is registered in `spark.os.schemata`, its index colist is created automatically. No manual setup.

---

## Source

`libs/maia-db/src/cojson/indexing/schema-index-manager.js`

---

## Related Documentation

- [storage-layer.md](./storage-layer.md) - CRUD and read API
- [cojson.md](./cojson.md) - CoJSON architecture
