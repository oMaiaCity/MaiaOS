# Factory-first indexing and OS cleanup (Phase 1) — revised

## Non-negotiable: zero namekey resolution at runtime

**Correct:** After bootstrap/sync, **every** factory reference in the running stack should be **`co_z` only**. There must be **no** `°maia/...` / namekey **lookup or resolve** on the hot path (loaders, `DataEngine`, `peer.systemFactoryCoIds` string-key resolution, resolver by path, etc.).

**Implications:**

- [`spark.os.instances`](libs/maia-db/src/cojson/spark-os-keys.js) (path → `co_z`) and the **namekey** branch of [`buildSystemFactoryCoIdsFromSparkOs`](libs/maia-db/src/cojson/factory/system-factories-from-os.js) exist to bridge **legacy** “human factory keys” → **co_id**. That bridge is **seed/build/migration** concern only, **not** a permanent runtime API.
- **End state:** delete **instances** map **and** remove **runtime** population of `Map<string,string>` from **titles/paths** once **all** persisted refs and **all** code paths use **`co_z`** (and CI/tests enforce no namekey resolve in runtime packages).
- **Definition catalog** under `spark.os.indexes[metaFactoryCoId]` remains useful as a **set of factory definition co-ids**, not as a “namekey lookup table” for the app at runtime.

## Indexing rule (unchanged)

For every factory definition **`F`** with **`indexing: true`**, maintain **exactly one** colist at **`spark.os.indexes[F]`** (see [`factory-index-manager.js`](libs/maia-db/src/cojson/indexing/factory-index-manager.js)).

## Out of scope for Phase 1

- `spark.os.capabilities` costream — **unchanged**.

## `maiaPathKey`

Remove from **persisted** CoValues and **runtime** reads; **zero** path-key policy in production paths.

## On execution: explicit deletions (after consumers are `co_z`-only)

When the plan is **executed** and tests pass, **yes — we delete**:

| Remove | Where |
|--------|--------|
| **`spark.os.instances`** | No longer create or link the CoMap in [`bootstrap.js`](libs/maia-db/src/migrations/seeding/bootstrap.js); remove [`store-registry.js`](libs/maia-db/src/migrations/seeding/store-registry.js) writes; drop `SPARK_OS_INSTANCES_KEY` from [`spark-os-keys.js`](libs/maia-db/src/cojson/spark-os-keys.js) and all readers (resolver, [`helpers.js`](libs/maia-db/src/migrations/seeding/helpers.js) `ensureSparkOs`, [`factory-index-manager.js`](libs/maia-db/src/cojson/indexing/factory-index-manager.js) `isInternalCoValue`, [`storage-hook-wrapper.js`](libs/maia-db/src/cojson/indexing/storage-hook-wrapper.js)). Existing DBs may need a one-time migration or fresh seed. |
| **Namekey / instances half of `buildSystemFactoryCoIdsFromSparkOs`** | Delete the block that loads `instancesId` and iterates path keys ([`system-factories-from-os.js`](libs/maia-db/src/cojson/factory/system-factories-from-os.js)). Keep only what is still required for **co_z-only** boot (e.g. catalog iteration by **co_id** only, or replace the whole function if `peer.systemFactoryCoIds` is populated without any string namekeys). |

**Order:** migrate all runtime call sites to **`co_z`** refs first → then delete the above (TDD proves no regressions).

## What to do next (execution — when approved)

1. Audit **runtime** call sites of namekey resolution (`resolve`, `systemFactoryCoIds.get(°...)`, `buildSystemFactoryCoIdsFromSparkOs` consumers in [`data.engine.js`](libs/maia-engines/src/engines/data.engine.js), loader, resolver).
2. Migrate **refs** to **`co_z`** at **seed/bundle** boundaries only; then **delete** `instances` + **strip** namekey map from **runtime** boot (see table above).
3. TDD: tests assert **no** namekey resolve in runtime modules (or guard with explicit **bootstrap-only** entrypoint).
4. Fix `@SCHEMA` / `meta.$factory` display and indexing edge cases as in the original plan.

---

*This file supersedes the earlier Cursor plan artifact for the same topic; keep it in-repo for iteration.*
