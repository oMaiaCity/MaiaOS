# Seeding System

## Overview

The seeding system bootstraps and populates the database with schemas, configs, and initial data. Used for development and fresh installs.

---

## The Simple Version

Think of seeding like setting up a new house. First you install the plumbing (bootstrap), then you add the furniture (schemas, configs, data). The tree is built in a specific order so everything has what it needs.

---

## When Seeding Runs

- **Sync service** → `PEER_SYNC_MODE=seed` runs genesis seed once (then unset `PEER_SYNC_MODE` so later restarts use the persisted scaffold). Unset or `none` = normal run, no genesis seed.
- **PEER_FRESH_SEED=true** → Full bootstrap + seed (clean slate) where applicable

**Reseed:** Wipe Postgres, PGlite data directory, and/or Tigris blob storage manually, then restart sync. There is no env-based force reseed.

### When to Re-seed

**Re-seed when actor, process, view, or context configs change.** Runtime expects all config references to be co-ids. Refs are transformed to co-ids only during seeding. If you modify `.maia` files (actors, processes, views, contexts) or the seed config, run with `PEER_FRESH_SEED=true` before testing. Otherwise the app may fail with "Expected co-id, got ref" or process load errors.

```bash
PEER_FRESH_SEED=true bun dev:sync
```

---

## Seeding Order

1. **Bootstrap** - Account registries, spark structure
2. **Schemas** - Schema CoValues
3. **Configs** - Actor configs, views, styles, process definitions
4. **Data** - Initial application data
5. **Registry** - Store registry updates

---

## Structure

```
libs/maia-db/src/migrations/seeding/
├── bootstrap.js    # Account registries, spark scaffold
├── configs.js      # Actor configs, views, styles, process
├── data.js         # Initial data
├── helpers.js      # Build meta, ensure spark.os, remove id fields
├── seed.js         # Main seed entry, orchestrates order
└── store-registry.js  # Registry updates
```

---

## Key Exports

- **simpleAccountSeed** - Minimal seed (registries via link)
- **factoryMigration** - Schema migration utilities

**Note:** Full seeding is invoked via `MaiaDB.seed()` (not a top-level export). The seed logic lives in `migrations/seeding/seed.js`.

---

## Reference Props

Config references (actor, context, view, process, brand, style, inbox, etc.) are transformed during seeding. Human-readable IDs (`@factory/...`) become co-ids (`co_z...`).

---

## Related Documentation

- [storage-layer.md](./storage-layer.md) - CRUD operations
- [schema-indexing.md](./schema-indexing.md) - Automatic indexing
- [maia-engines](../04_maia-engines/README.md) - DataEngine seed op
