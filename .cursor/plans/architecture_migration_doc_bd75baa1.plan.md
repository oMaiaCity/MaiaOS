---
name: Architecture migration doc
overview: "Full architectural migration catalog (M1–M8) plus implementation annotations—replay order, pitfalls, data/codegen invariants, and corrections discovered while shipping."
todos:
  - id: write-doc
    content: Write the architecture migration document to a file in the workspace
    status: cancelled
isProject: false
---

# Architecture migration — full plan + implementation annotations

This document has two layers:

1. **Implementation annotations** — order, pitfalls, and invariants learned while applying the migrations (use when **starting fresh** or debugging a replay).
2. **Detailed migration catalog** — full descriptions of **M1–M8** (what/why/file tables) as in the original architecture plan. There is **no separate M9** in that catalog; older “1–9” wording was a mistake—use **M1–M8** here.

Historical snapshot (example): *69 files changed, ~960 insertions / ~810 deletions* from a given `HEAD`—treat numbers as approximate; the **sections below** are authoritative.

---

## Part A — Implementation annotations

### A.1 Start-fresh checklist (order matters)

1. **Rename package (M1)** before anything imports `@MaiaOS/migrate`. When moving `libs/maia-seed` → `libs/maia-migrate`, ensure the target directory does not already exist as a partial tree, or you get a nested `maia-migrate/maia-seed/` layout—**flatten** so `package.json` and `src/` sit directly under `libs/maia-migrate/`.
2. **Universe data + factories (M4–M6)** before relying on `buildSeedConfig` / seed tests.
3. Run **`bun scripts/generate-maia-universe-registry.mjs`** after any change to `data/*.data.maia`, vibe `seedData`, or `partitionMaia` / codegen logic.
4. **`bun install`** from repo root after `package.json` / workspace renames.
5. Run **scoped tests**: `@MaiaOS/universe`, `@MaiaOS/migrate`, `@MaiaOS/validation`, `@MaiaOS/db` as touched.

### A.2 Cross-cutting invariants (data & codegen)

**Persistent identity in `.data.maia`**

- **`$nanoid` on each instance row** is **authored** and treated as the **stable persistent key** for that row (notes/todos/icons). **Do not strip** `$nanoid` expecting codegen to invent it unless you add an explicit enrichment step that hashes the same paths.
- **`$label`** for bracket rows is always **`°maia/data/<file>.data.maia[<nanoid>]`**. It may be authored next to `$nanoid` or derived in code; if both exist, they must agree.
- **Root bucket only:** `{ "$factory": "°maia/factory/…", "instances": [ … ] }`. **Do not** repeat `$factory` on every instance row (icons included).

**Icons (`icons.data.maia`)**

- **No `dashboardVibeKeys`** array—redundant. Validate by scanning **`instances`** (each row must have non-empty `svg` and a `$nanoid`).
- **No per-row `key`** (e.g. `"todos"`)—vibe ↔ icon is **only** via manifest `icon: "°maia/data/icons.data.maia[<nanoid>]"` matching a row’s `$nanoid`.
- **Eight** icon rows for **eight** vibes (not nine). Nanoids for icons stay aligned with legacy paths `data/icons/<slug>.maia` (e.g. `todos`, `paper`, …) via `maiaIdentity` so bracket refs stay stable.
- **`title`** (string) on each icon row + **`icon.factory.maia`** requires **`title`** + **`svg`**—human-readable chrome alongside SVG.

**Codegen (`generate-maia-universe-registry.mjs`)**

- **`dashboardIcons` partition removed**—no more `data/icons/*.maia` shards. Remove **all** leftover references (`buckets.dashboardIcons`, `iconPairs`), or generation crashes at runtime.
- **`SEED_DATA.icons`**: `Object.freeze(<import of icons.data.maia>)` (single consolidated file).
- **`seedDataCodegenFragment`**: support **`field` with one segment**—e.g. `"field": ["notes"]` emits `SEED_DATA.notes` (full bucket with `$factory` + `instances`), **not** only `SEED_DATA.notes.instances`. Same for `todos`.

**Seed order (`libs/maia-migrate/src/orchestration/seed.js`)**

- **`seedData()` must run before** the vibe loop so bracket refs on `vibe.icon` resolve to cotext co-ids in the pre-seed map.
- **Icons bucket** in `data.js`: **cotext-only** from `svg` (graphemes); register `instanceCoIdMap` by **`$nanoid`** and full **bracket string**.
- **Data factory registration** loop must use **`bucket.$factory`** basename (`note.factory.maia`, `todo.factory.maia`), not `notes.factory.maia` derived from the key `notes`.

**`vibe.factory.maia`**

- **`icon`** is a **string** (bracket ref), **not** `$co: cotext` in the authored factory schema—manifest stores a logical ref that becomes `co_z` after `transformInstanceForSeeding`.

**Factory registry (`libs/maia-validation`)**

- **M7 “FACTORY_SCHEMAS from generated registry”** may be a **future** simplification. **Practical replay:** extend **manual** maps (`FACTORY_BASENAME_TO_REGISTRY_KEY`, `UNIQUE_PATH_KEYS`, `UNIVERSE_FACTORY_IMPORTS`) with **`note` / `todo` / `icon`** and **`data/icons`** in `getAllFactories()` unless the generated-registry refactor is already merged.

### A.3 Reference — key files

| Concern | Files |
|---------|--------|
| Seed merge / validation | `libs/maia-universe/src/config/build-seed-config.js` |
| Bracket parsing | `libs/maia-universe/src/helpers/bracket-ref.js` |
| Registry codegen | `scripts/generate-maia-universe-registry.mjs` |
| Data authoring | `libs/maia-universe/src/sparks/maia/data/*.data.maia` |
| Seed execution order | `libs/maia-migrate/src/orchestration/seed.js`, `data.js` |
| Ref resolution | `libs/maia-migrate/src/ref-transform.js` |
| Factory loading | `libs/maia-validation/src/factory-registry.js` |

### A.4 Reproduce from clean commit (minimal)

1. `git checkout <baseline>`
2. Apply **M1** (rename + wiring), then **M4–M6** (universe + migrate seed path), then **M2, M3, M7, M8** as required by that baseline.
3. `bun scripts/generate-maia-universe-registry.mjs`
4. `bun install`
5. `bun --filter @MaiaOS/universe test` (and other touched packages)
6. Full stack: wipe local DB + site data, `bun dev`, smoke dashboard and vibes.

---

## Part B — Detailed migration catalog (original descriptions)

### Migration 1: Rename `@MaiaOS/seed` to `@MaiaOS/migrate`

**What:** The entire `libs/maia-seed/` package was renamed to `libs/maia-migrate/` with package name `@MaiaOS/migrate`.

**Why:** The package handles both seeding (genesis) and live migration (registry patches). **“Migrate”** reflects the unified converge/migrate flow.

| File                                     | Change                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `libs/maia-seed/` (deleted)              | Entire directory removed                                                                    |
| `libs/maia-migrate/package.json`         | Name: `@MaiaOS/migrate`, new exports: `./orchestration/converge`, `./orchestration/migrate` |
| `libs/maia-migrate/bunfig.toml`          | Unchanged (moved)                                                                           |
| `libs/maia-migrate/src/index.js`         | Re-exports from `@MaiaOS/universe/config/`* and local `ref-transform.js`                    |
| `jsconfig.json`                          | Path alias `@MaiaOS/seed` replaced with `@MaiaOS/migrate`                                   |
| `package.json` (root)                    | Script `dev:migrate` updated to point at `libs/maia-migrate/`                               |
| `services/sync/package.json`             | Dependency `@MaiaOS/seed` replaced with `@MaiaOS/migrate`                                   |
| `services/sync/src/index.js`             | All imports from `@MaiaOS/seed` changed to `@MaiaOS/migrate`                                |
| `libs/maia-db/package.json`              | Dependency `@MaiaOS/seed` replaced with `@MaiaOS/migrate`                                   |
| `libs/maia-db/src/cojson/core/MaiaDB.js` | Import `@MaiaOS/seed/orchestration` changed to `@MaiaOS/migrate/orchestration`              |
| `bun.lock`                               | Updated lockfile                                                                            |

**Annotation:** See **A.1** — avoid nested `maia-migrate/maia-seed/` when moving on disk.

---

### Migration 2: Unified `converge()` replaces “needsSeed + migrate” two-step

**What:** The sync server no longer probes for an empty database to decide between genesis seed vs registry migrate. Instead, every boot can call **`converge()`** which runs: scaffold (idempotent) then spark registry pipeline then registry patches.

**Why:** Eliminates the fragile **`needsSeed`** boolean and **`probePostgresDatabaseEmpty`** / **`probePGliteDatabaseEmpty`** calls. Single code path for fresh and existing databases.

| File                                                    | Change                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/maia-migrate/src/orchestration/converge.js`       | **NEW.** Single entry: `ensureScaffold` then `runSparkRegistryPipeline` then `applyRegistryPatches`                                                                                                                                       |
| `libs/maia-migrate/src/orchestration/seed.js`           | **NEW.** Thin wrapper: delegates to `runSparkRegistryPipeline` when `forceFreshSeed`                                                                                                                                                      |
| `libs/maia-migrate/src/orchestration/bootstrap.js`      | Added `ensureScaffold()` (idempotent: full bootstrap only when `account.registries` missing) and `ensureFullSparkScaffold()` (renamed from `bootstrapAndScaffold`). Deprecated alias kept.                                                |
| `libs/maia-migrate/src/orchestration/registry-patch.js` | Renamed from `migrate.js`. Export alias `migrate` kept as deprecated.                                                                                                                                                                     |
| `services/sync/src/index.js`                            | Removed `needsSeed` / `probePostgresDatabaseEmpty` / `probePGliteDatabaseEmpty` block (~23 lines). Replaced `dataEngine.execute({ op: 'seed' })` + `migrate()` with single `converge(peer, dataEngine, { configs, data, schemas })` call. |

---

### Migration 3: `$label` removed from lookup paths; `$nanoid` is the only internal key

**What:** All internal Maps that keyed factory schemas by **`$label`** (e.g. `°maia/factory/actor.factory.maia`) now key by **`$nanoid`** (12-char deterministic hash). **`$label`** is stored as CoMap metadata only.

**Why:** **`$label`** is a human-readable logical ref, not a lookup key. Using it as a Map key created fragile coupling. **`$nanoid`** is deterministic from the path and stable across renames.

| File                                                             | Change                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/maia-migrate/src/orchestration/bootstrap.js`               | `uniqueSchemasByLabel` renamed to `uniqueSchemasByNanoid`, keyed by `schema.$nanoid`. `tempCoMap.set(factoryKey, coId)` changed to `tempCoMap.set(factoryNanoid, coId)`. Infra factory lookups (spark, os-registry, groups, indexes-registry, vibes-registry) use `maiaIdentity(basename).$nanoid` helper `n()`. |
| `libs/maia-migrate/src/orchestration/spark-registry-pipeline.js` | Same `uniqueSchemasByNanoid` refactor. `factoryCoIdMap` and `seedRegistry` keyed by `$nanoid`.                                                                                                                                                                                                                   |
| `libs/maia-migrate/src/orchestration/helpers.js`                 | `sortSchemasByDependency` parameter renamed to `uniqueSchemasByNanoid`. Dependency resolution calls `maiaFactoryRefToNanoid(d)` to convert `°maia/factory/...` refs to `$nanoid` for graph edges.                                                                                                                |
| `libs/maia-migrate/src/orchestration/configs.js`                 | Comment added: `$label` stored as CoMap data only, not used as lookup key.                                                                                                                                                                                                                                       |

---

### Migration 4: Data files standardized with `$factory` header + `instances` array

**What:** All `.data.maia` files have the structure `{ "$factory": "°maia/factory/<name>.factory.maia", "instances": [...] }`. Individual icon files (`data/icons/*.maia`) consolidated into a single **`data/icons.data.maia`**.

**Why:** Generic data seeding—the pipeline reads **`$factory`** from each data bucket and validates instances against that schema. No hardcoded per-collection logic.

| File                                                             | Change                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `libs/maia-universe/src/sparks/maia/data/notes.data.maia`        | Rewritten: `$factory: °maia/factory/note.factory.maia`, `instances: [...]`                                                                                                                                                                                                                       |
| `libs/maia-universe/src/sparks/maia/data/todos.data.maia`        | Rewritten: `$factory: °maia/factory/todo.factory.maia`, `instances: [...]`                                                                                                                                                                                                                       |
| `libs/maia-universe/src/sparks/maia/data/icons.data.maia`        | Rewritten: `$factory: °maia/factory/icon.factory.maia`, `instances: [...]` with all icons inline                                                                                                                                                                                               |
| `libs/maia-universe/src/sparks/maia/data/icons/*.maia` (one file per legacy shard) | **DELETED.** Consolidated into `icons.data.maia` (final row count = one icon per vibe; see **A.2**)                                                                                                                                                                                                                                                 |
| `libs/maia-migrate/src/orchestration/data.js`                    | **NEW.** Generic `seedData()`: iterates `{ $factory, instances }` buckets, calls `getFactory(factoryRef)` for schema, materializes CoText fields, registers icon bracket refs in `instanceCoIdMap`.                                                                                              |
| `libs/maia-seed/src/orchestration/data.js`                       | **DELETED.** Old hardcoded per-collection logic.                                                                                                                                                                                                                                                 |
| `libs/maia-universe/src/config/build-seed-config.js`             | `mergeSeedDataBucket` updated to merge `{ $factory, instances }` payloads (concatenate `instances` arrays). Icon validation reads `SEED_DATA.icons.instances`.                                                                                                                                   |
| `scripts/generate-maia-universe-registry.mjs`                    | Removed `dashboardIcons` partition. Added `enrichDataMaiaFilesWithNanoids()` to auto-assign `$nanoid` to data rows. `SEED_DATA` now maps keys directly to raw imports (no special icon object). Added `FACTORY_SCHEMAS` export. `seedDataCodegenFragment` handles single-segment `field` arrays. |

**Annotation:** Consolidated icons are **eight** rows for **eight** vibes; see **A.2**. **`seedDataField`** must use one-segment **`field`** so **`SEED_DATA.notes` / `SEED_DATA.todos`** are full buckets—see **A.2** (codegen).

---

### Migration 5: Factory renames (plural to singular) + new `icon.factory.maia`

**What:** `notes.factory.maia` renamed to **`note.factory.maia`**, `todos.factory.maia` to **`todo.factory.maia`**. New **`icon.factory.maia`** created.

**Why:** Singular naming convention (a factory describes one instance). Icon data needs its own schema for CoText SVG fields.

| File                                                                           | Change                                                                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `libs/maia-universe/src/sparks/maia/factories/note.factory.maia`               | Renamed from `notes.factory.maia`. Title updated.                                                             |
| `libs/maia-universe/src/sparks/maia/factories/todo.factory.maia`               | Renamed from `todos.factory.maia`. Title updated.                                                             |
| `libs/maia-universe/src/sparks/maia/factories/icon.factory.maia`               | **NEW.** `cotype: comap`, `indexing: true`, properties: **`title`** (string), **`svg`** (`$co: cotext.factory.maia`). |
| `libs/maia-universe/src/sparks/maia/factories/vibe.factory.maia`               | **`icon`** added to `required` array. **`icon`** property: string bracket ref (see annotation below).                                |
| `libs/maia-universe/src/sparks/maia/factories/factories-registry.factory.maia` | Description updated to reference `todo.factory.maia`.                                                         |
| Actor/view `.maia` files (5 files)                                             | References updated from `notes.factory.maia`/`todos.factory.maia` to `note.factory.maia`/`todo.factory.maia`. |
| `libs/maia-db/tests/resolver-strict.test.js`                                   | Test ref updated to `todo.factory.maia`.                                                                      |
| `libs/maia-validation/tests/identity-from-maia-path.test.js`                   | Test ref updated to `todo.factory.maia`.                                                                      |

**Annotation:** In the shipped shape, **`vibe.factory.maia`** declares **`icon` as a string** (bracket ref to `icons.data.maia[...]`). Cotext materialization happens in **seed transform**, not as **`$co: cotext`** on the vibe **`icon`** field in the factory schema—see **A.2**.

---

### Migration 6: Vibe icon bracket refs replace auto-derived icon identity

**What:** Each vibe manifest declares **`icon: "°maia/data/icons.data.maia[<nanoid>]"`** explicitly. The old **`normalizeVibeForSeeding`** auto-set `icon: maiaIdentity(data/icons/${key}.maia).$label` is removed.

**Why:** Icons are data rows in **`icons.data.maia`** with stable **`$nanoid`**. Bracket refs are resolved by **`parseDataMaiaBracketRef`** → **`instanceLogicalRefToNanoid`** → nanoid lookup in seed registry → CoText **`co_z`** id.

| File                                                                | Change                                                                                                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 8 `vibes/*/manifest.vibe.maia` files                            | Added explicit `icon: "°maia/data/icons.data.maia[<nanoid>]"`                                                                                                                     |
| `libs/maia-universe/src/helpers/bracket-ref.js`                     | **NEW.** `parseDataMaiaBracketRef()`: extracts `pathKey` and `itemNanoid` from bracket ref.                                                                                       |
| `libs/maia-universe/tests/bracket-ref.test.js`                      | **NEW.** Tests for bracket ref parsing (add if missing in tree).                                                                                                                                   |
| `libs/maia-universe/src/config/build-seed-config.js`                | `normalizeVibeForSeeding` no longer sets `icon`. Added validation: each vibe `icon` must be a valid bracket ref pointing to an existing `$nanoid` in `SEED_DATA.icons.instances`. |
| `libs/maia-migrate/src/ref-transform.js`                            | `instanceLogicalRefToNanoid` calls `parseDataMaiaBracketRef` for bracket refs, returns `itemNanoid`.                                                                              |
| `libs/maia-migrate/tests/ref-transform.test.js`                     | Added test: bracket ref resolves via item nanoid.                                                                                                                                 |
| `libs/maia-universe/src/sparks/maia/vibes/chat/manifest.vibe.maia`  | Removed `seedData.notes` entry (chat no longer seeds notes).                                                                                                                      |
| `libs/maia-universe/src/sparks/maia/vibes/paper/manifest.vibe.maia` | `seedData.notes.field` changed from `["notes", "paper"]` to `["notes"]`.                                                                                                          |
| `libs/maia-universe/src/sparks/maia/vibes/todos/manifest.vibe.maia` | `seedData.todos.field` changed from `["todos", "todos"]` to `["todos"]`.                                                                                                          |

**Annotation:** **`seedData()` before** the vibe loop; **`field: ["notes"]` / `["todos"]`** must yield full buckets in **`SEED_DATA`**—see **A.2**.

---

### Migration 7: Factory registry auto-generated from universe; short-stem resolution

**What:** `libs/maia-validation/src/factory-registry.js` was rewritten. The old ~235-line **`buildFactories()`** with manual **`FACTORY_BASENAME_TO_REGISTRY_KEY`**, **`UNIQUE_PATH_KEYS`**, and **`UNIVERSE_FACTORY_IMPORTS`** maps was **replaced** by a smaller module that imports **`FACTORY_SCHEMAS`** from the generated registry.

**Why:** Single source of truth. No manual lists to maintain when factories are added/renamed.

| File                                                            | Change                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/maia-validation/src/factory-registry.js`                  | Imports `FACTORY_SCHEMAS` from `@MaiaOS/universe/generated/registry.js`. `ensureFactoriesLoaded()` uses dev-server JSON or bundled `FACTORY_SCHEMAS`. `getFactory()` resolves: `°maia/factory/<basename>` (strip prefix), direct basename, or short stem (`actor` -> `actor.factory.maia`). `getAllFactories()` returns basename-keyed shallow copy. |
| `libs/maia-validation/tests/factory-registry.test.js`           | **NEW.** Tests: `°` ref resolution, basename-only keys, short stem resolution.                                                                                                                                                                                                                                                                       |
| `libs/maia-universe/package.json`                               | Added export `"./generated/registry.js"` and `"./helpers/bracket-ref.js"`.                                                                                                                                                                                                                                                                           |
| `scripts/generate-maia-universe-registry.mjs`                   | Generates `FACTORY_SCHEMAS` export (basename -> annotated schema).                                                                                                                                                                                                                                                                                   |
| `libs/maia-universe/tests/registry.test.js`                     | Updated: tests `SEED_DATA` structure (`$factory` + `instances`), `FACTORY_SCHEMAS` aliases, icon rows.                                                                                                                                                                                                                                               |
| `libs/maia-universe/tests/build-seed-config-data-merge.test.js` | Updated: tests `instances` array merging.                                                                                                                                                                                                                                                                                                            |

**Annotation:** **Practical replay** may still use the **manual** registry extended with **`note` / `todo` / `icon`** until the generated-schema refactor is merged—see **A.2**. Do not block M4–M6 on M7 if the branch only has manual maps.

---

### Migration 8: Nanoid index moved under `spark.os.indexes["@nanoids"]`

**What:** The nanoid lookup CoMap (nanoid string → **`co_z`**) moved from **`spark.os.nanoids`** to **`spark.os.indexes["@nanoids"]`**.

**Why:** Consolidates all indexes under a single surface (`spark.os.indexes`). Legacy **`spark.os.nanoids`** is auto-migrated and the key deleted.

| File                                                        | Change                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/maia-db/src/cojson/indexing/factory-index-manager.js` | Added `NANOID_INDEX_KEY = '@nanoids'`. `ensureNanoidIndexCoMap` now delegates to `ensureNanoidCoMapUnderIndexes`. Added `migrateLegacySparkOsNanoids` (copies entries from old `os.nanoids` to `indexes["@nanoids"]`, deletes old key). `loadNanoidIndex` simplified to delegate to `ensureNanoidIndexCoMap`. `removeFromIndex` now also removes from nanoid index. Added `loadCoMapContentById` helper. |

---

## Part C — Deleted files, new files, reproduce (legacy appendix)

### Deleted files (9 icon shards + old `data.js`)

- `libs/maia-universe/src/sparks/maia/data/icons/chat.maia`
- `libs/maia-universe/src/sparks/maia/data/icons/humans.maia`
- `libs/maia-universe/src/sparks/maia/data/icons/logs.maia`
- `libs/maia-universe/src/sparks/maia/data/icons/paper.maia`
- `libs/maia-universe/src/sparks/maia/data/icons/profile.maia`
- `libs/maia-universe/src/sparks/maia/data/icons/quickjs.maia`
- `libs/maia-universe/src/sparks/maia/data/icons/registries.maia`
- `libs/maia-universe/src/sparks/maia/data/icons/sparks.maia`
- `libs/maia-universe/src/sparks/maia/data/icons/todos.maia`
- `libs/maia-seed/src/orchestration/data.js`

### New files (typical set from the migration batch)

- `libs/maia-migrate/src/orchestration/converge.js`
- `libs/maia-migrate/src/orchestration/seed.js`
- `libs/maia-migrate/src/orchestration/data.js`
- `libs/maia-universe/src/helpers/bracket-ref.js`
- `libs/maia-universe/src/sparks/maia/factories/icon.factory.maia`
- `libs/maia-universe/tests/bracket-ref.test.js` (if present)
- `libs/maia-validation/tests/factory-registry.test.js`
- `libs/maia-universe/src/sparks/maia/factories/note.factory.maia` (rename)
- `libs/maia-universe/src/sparks/maia/factories/todo.factory.maia` (rename)

### How to reproduce from clean commit (legacy numbered steps)

1. Start from baseline commit (record the SHA you use).
2. Apply migrations **M1–M8** in dependency order (**M2** assumes **M1**; data migrations **M4–M6** align with universe + migrate).
3. Run `bun scripts/generate-maia-universe-registry.mjs` to regenerate `libs/maia-universe/src/generated/registry.js`
4. Run `bun install` from root
5. Run `bun test` in touched packages (`maia-validation`, `maia-migrate`, `maia-universe`, `maia-db`)—all should pass
6. Wipe PGlite/Postgres + browser IndexedDB, run `bun dev`, verify dashboard loads with icons, vibes, capabilities, registries, profile upload
