# Seeding System

## Overview

The seeding system bootstraps and populates the database with schemas, configs, and initial data. Used for development and fresh installs.

---

## The Simple Version

Think of seeding like setting up a new house. First you install the plumbing (bootstrap), then you add the furniture (schemas, configs, data). The tree is built in a specific order so everything has what it needs.

---

## When Seeding Runs

- **Sync service** → `PEER_SYNC_SEED=true` is the **only** env gate for **genesis** (full scaffold + seed). Without it, if `account.sparks` is missing, sync **fails fast** (operator must run one boot with `PEER_SYNC_SEED=true`, then unset). When scaffold already exists, unset or not `true` = normal run (genesis step skips). **Local dev only** (PGlite, no remote bucket): sync may also clear local PGlite + `binary-bucket`, regenerate tester lines in `.env` — not used on production or with Postgres/Tigris.
- **Operational flows** — Server startup and `POST /bootstrap` sequences live in `@MaiaOS/flows` (reconcile steps: `{ id, check, apply }`); only the genesis step is gated by `PEER_SYNC_SEED`.

**Reseed:** Wipe Postgres, PGlite data directory, and/or Tigris blob storage manually, then restart sync with `PEER_SYNC_SEED=true` for one boot. **Remote/prod:** no automatic wipe from env. **Local PGlite only:** `PEER_SYNC_SEED=true` (with no remote bucket) triggers a local filesystem reset and tester regen as described above—still not applicable to Postgres or Tigris.

### When to Re-seed

**Re-seed when actor, process, view, or context configs change.** Runtime expects all config references to be co-ids. Refs are transformed to co-ids only during seeding. If you modify `.maia` files (actors, processes, views, contexts) or the seed config, run sync with `PEER_SYNC_SEED=true` (one-shot) after wiping storage, or follow your usual DB reset flow. Otherwise the app may fail with "Expected co-id, got ref" or process load errors.

```bash
PEER_SYNC_SEED=true bun dev:sync
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
