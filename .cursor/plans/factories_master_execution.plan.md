---
name: Factories master execution (co-id + strict-only)
overview: "Single plan: strict-only runtime (co_z only, no dual modes), runtimeRefs for infra roles, no runtime spark.os.factories namekey walks, seed keeps factories registry; strip resolver glue ~20%; TDD in maia-db/maia-engines."
todos:
  - id: strict-resolver
    content: Delete non-strict branch in resolve(); lookupRegistryKey seed/migrate-only
    status: completed
  - id: remove-strictmode
    content: Remove peer.strictMode; loader/seed assignments; invariant unconditional
    status: completed
  - id: reactive-resolver
    content: Collapse reactive-resolver.js strictMode branches to single path
    status: completed
  - id: runtime-refs
    content: runtimeRefs CoMap + getRuntimeRef(role); replace systemFactoryCoIds.get(°maia...)
    status: completed
  - id: read-collection
    content: read/collection-helpers/process-inbox/message-helpers/index-manager use refs + co_z; fail fast on namekeys
    status: completed
  - id: seed-runtimeRefs
    content: Write runtimeRefs in seed/bootstrap; verify transformForSeeding materializes co_z
    status: completed
  - id: compaction
    content: Dedupe seed helpers; ~20% line reduction in resolver + touched files
    status: cancelled
  - id: tdd-ci
    content: resolver-strict always-on tests; runtime-pointers optional; bun test + check:ci
    status: completed
  - id: feedback-option1
    content: Confirm Option 1 — keep factories map ° keys; runtimeRefs for infra only
    status: completed
isProject: true
---

# Master execution plan: factories / schema runtime (co-id + strict-only)

Merged from `factories_co-id_execution_ef3ac63d.plan.md` and `factories_strict_only_execution.plan.md`.

---

## 1. Intent

- **Runtime:** No walking `account → spark → os → spark.os.factories` to resolve `°maia/...` → `co_z`. No scattered `peer.systemFactoryCoIds.get('°maia/...')` in app/db code.
- **Strict-only:** **One** resolution mode — **`co_z`** (and narrow explicit sentinels if the contract keeps `@account` / `@group` / `@metaSchema`). **No `peer.strictMode` flag** — delete the toggle; non-strict branches are **removed**, not disabled.
- **Seed:** Continue writing [`spark.os.factories`](libs/maia-db/src/migrations/seeding/bootstrap.js) and the full seed/migrate pipeline **unchanged** for bootstrap/tooling.
- **Indexing:** [`spark.os.indexes`](libs/maia-db/src/cojson/indexing/factory-index-manager.js) is **orthogonal** — it lists **instance** co-ids per **schema co-id**. It does **not** replace namekey→schema resolution; strict + materialized `co_z` + **`runtimeRefs`** do.

---

## 2. First principles

1. **Public API = `co_z` only** for `resolve`, `read`, create/update, process, inbox (no namekey strings at runtime).
2. **Seed registry** remains the authoring/bootstrap source of truth; seed may still use namekeys **inside** seed/migrate code paths only.
3. **Infra well-known schemas** (spark item, human, aven-identity, event, indexes-registry, meta): **`spark.os.runtimeRefs`** CoMap (short ASCII keys → `co_z`) written at seed + **`peer.getRuntimeRef(role)`** — **no `°` in JS call sites**.
4. **`lookupRegistryKey`:** **not** imported from runtime resolver — only **seed/migrate** (or minimal inline where seed must walk factories).
5. **`resolve()`:** delete the registry-key / vibe / instance string branch entirely (~492+ in [`resolver.js`](libs/maia-db/src/cojson/factory/resolver.js)).

---

## 3. Glue to strip (strict-only deletion list)

| Area | Action |
|------|--------|
| [`resolver.js`](libs/maia-db/src/cojson/factory/resolver.js) | Remove non-strict path (`FACTORY_REF_PATTERN`, vibe/instance walks, `lookupRegistryKey` from `resolve`). |
| [`MaiaDB.js`](libs/maia-db/src/cojson/core/MaiaDB.js) | Remove `strictMode` property and all assignments. |
| [`reactive-resolver.js`](libs/maia-db/src/cojson/crud/reactive-resolver.js) | Single behavior: reject non-`co_z` where applicable. |
| [`seed.js`](libs/maia-db/src/migrations/seeding/seed.js) | Remove `peer.strictMode = true` tail if property deleted. |
| [`maia-loader`](libs/maia-loader/src/loader.js) | Remove `maiaDB.strictMode = true` if property deleted. |
| [`factory-index-manager.js`](libs/maia-db/src/cojson/indexing/factory-index-manager.js) | No runtime human-readable registry resolution — use **`runtimeRefs` + `co_z`**. |

---

## 4. Fullstack file audit (repo-wide)

Legend: **R** = runtime path — strip fallbacks / dual mode / `°maia/` lookups; replace with strict + `runtimeRefs` where listed. **S** = seed/migrate/build-time — may keep namekey transforms; **re-export** `lookupRegistryKey` only if seed-only module needs public API. **T** = tests — update expectations. **A** = authoring source — `°` in JSON/.maia remains until `transformForSeeding`; not “runtime glue” (verify output is `co_z`).

### `libs/maia-db`

| File | Action |
|------|--------|
| [`src/cojson/factory/resolver.js`](libs/maia-db/src/cojson/factory/resolver.js) | **R** — Delete `peer.strictMode` branch; delete non-`co_z` string resolution path; move `lookupRegistryKey` to seed-only or keep export from thin shim used only by migrations. Simplify `resolveFactoryDefFromPeer` to `co_z` + `runtimeRefs` only. |
| [`src/cojson/core/MaiaDB.js`](libs/maia-db/src/cojson/core/MaiaDB.js) | **R** — Remove `strictMode`; replace `systemFactoryCoIds.get('°maia/...')` with `getRuntimeRef` / `runtimeRefs` map for spark/groups/os/vibes/capabilities paths. |
| [`src/cojson/crud/reactive-resolver.js`](libs/maia-db/src/cojson/crud/reactive-resolver.js) | **R** — Remove `strictMode` branches; remove `lookupRegistryKey` async fallbacks; single path. |
| [`src/cojson/crud/read.js`](libs/maia-db/src/cojson/crud/read.js) | **R** — Replace `systemFactoryCoIds.get('°maia/factory/data/spark' \| …human\|…aven-identity)` with `runtimeRefs`. |
| [`src/cojson/crud/collection-helpers.js`](libs/maia-db/src/cojson/crud/collection-helpers.js) | **R** — Delete `lookupRegistryKey` fallback; require `co_z` schema or resolve via `runtimeRefs` only. |
| [`src/cojson/crud/process-inbox.js`](libs/maia-db/src/cojson/crud/process-inbox.js) | **R** — Replace `systemFactoryCoIds.get(messageFactoryRef)` / event fallback with `runtimeRefs` + `co_z` from message header. |
| [`src/cojson/crud/message-helpers.js`](libs/maia-db/src/cojson/crud/message-helpers.js) | **R** — Same as process-inbox for message factory resolution. |
| [`src/cojson/indexing/factory-index-manager.js`](libs/maia-db/src/cojson/indexing/factory-index-manager.js) | **R** — Replace `lookupRegistryKey` + `systemFactoryCoIds` literals with `runtimeRefs` / `co_z`; remove `resolveSystemFactories` guard comments that assume namekey resolution. |
| [`src/cojson/indexing/storage-hook-wrapper.js`](libs/maia-db/src/cojson/indexing/storage-hook-wrapper.js) | **R** — Review imports from resolver; ensure no registry-key path. |
| [`src/factories/registry.js`](libs/maia-db/src/factories/registry.js) | **R** — Replace `systemFactoryCoIds.get('°maia/factory/meta')` with `runtimeRefs` or meta co-id parameter. |
| [`src/migrations/seeding/seed.js`](libs/maia-db/src/migrations/seeding/seed.js) | **S** — Remove `peer.strictMode = true`; add `runtimeRefs` writes after factories populated. |
| [`src/migrations/seeding/bootstrap.js`](libs/maia-db/src/migrations/seeding/bootstrap.js) | **S** — Create `runtimeRefs` CoMap on `os` if adopted. |
| [`src/migrations/seeding/configs.js`](libs/maia-db/src/migrations/seeding/configs.js) | **S** — Verify only; seed still uses namekeys in input. |
| [`src/cojson/helpers/resolve-capability-group.js`](libs/maia-db/src/cojson/helpers/resolve-capability-group.js) | **Optional** — Display strings mention `°maia`; no resolver glue today. |
| [`src/index.js`](libs/maia-db/src/index.js) | **R** — Export `lookupRegistryKey` only if re-exporting seed shim; or move export to `migrations/` entry. |

### `libs/maia-engines`

| File | Action |
|------|--------|
| [`src/engines/data.engine.js`](libs/maia-engines/src/engines/data.engine.js) | **R** — `resolveSystemFactories`: populate `runtimeRefs` + keep or slim `systemFactoryCoIds` mirror; remove literal `COBINARY_DATA_FACTORY_KEY = '°maia/...'` from hot path (use ref role). |
| [`src/runtimes/browser.js`](libs/maia-engines/src/runtimes/browser.js) | **R** — Replace `systemFactoryCoIds.get('°maia/factory/actor' \| '…/meta')` and interface ref map with `runtimeRefs` / `co_z`. |
| [`src/utils/evaluator.js`](libs/maia-engines/src/utils/evaluator.js) | **R** — `resolveFactoryDefFromPeer` must accept only `co_z` or keys in `runtimeRefs` (no raw registry namekeys). |

### `libs/maia-loader`

| File | Action |
|------|--------|
| [`src/loader.js`](libs/maia-loader/src/loader.js) | **R** — Remove `config.peer.strictMode` / `maiaDB.strictMode` assignments. |
| [`src/cojson-factory.js`](libs/maia-loader/src/cojson-factory.js) | **R** — Keep `resolveSystemFactories` call; no strict flag. |

### `services/sync`

| File | Action |
|------|--------|
| [`src/index.js`](services/sync/src/index.js) | **R** — Remove `if (!peer.strictMode) peer.strictMode = true`; remove `systemFactoryCoIds.get('°maia/factory/os/capability' \| …human\|…aven-identity)` → `runtimeRefs`. |

### `libs/maia-factories`

| File | Action |
|------|--------|
| [`src/validation.helper.js`](libs/maia-factories/src/validation.helper.js) | **R** — Update comment + `resolveFactoryDefFromPeer` usage to co-id + `runtimeRefs` only. |
| [`src/factory-transformer.js`](libs/maia-factories/src/factory-transformer.js) | **S** — Keep; seed transform. No runtime fallback. |
| [`src/validation.engine.js`](libs/maia-factories/src/validation.engine.js) | **S/A** — Authoring/build validation; reduce `°maia` only if moving to slug ids (optional later). |
| [`tests/*.test.js`](libs/maia-factories/tests) | **T** — Keep pattern tests; add/update if public API of resolver changes. |

### `libs/maia-universe` / `libs/maia-seed`

| File | Action |
|------|--------|
| [`maia-universe/src/maia/seeding.js`](libs/maia-universe/src/maia/seeding.js) | **S** — Vibe constants; still seed input. |
| [`maia-universe/src/maia/actors/actor-service-refs.js`](libs/maia-universe/src/maia/actors/actor-service-refs.js) | **R** — Long-term: map `°maia/...` paths to roles or `co_z` after seed; optional Phase 2. |
| [`maia-seed/src/seed-config.js`](libs/maia-seed/src/seed-config.js) | **S** — Seed input `$factory` strings. |

### Tests (colocated)

| File | Action |
|------|--------|
| [`libs/maia-db/tests/resolver-strict.test.js`](libs/maia-db/tests/resolver-strict.test.js) | **T** — Always-strict; remove dual-mode mocks. |

### `services/app/` + `libs/maia-distros/`

| File | Action |
|------|--------|
| — | **No** current `strictMode` / `lookupRegistryKey` / `systemFactoryCoIds` usage (grep clean). Re-verify after refactor. |

### Seeding subsystem — full analysis (must align with `runtimeRefs` + strict runtime)

These files **feed or implement** seed/migrate; they keep **`°maia/...` in authoring JSON** where needed. The master plan change is: **after** factories + indexes exist, **write `spark.os.runtimeRefs`** (short keys → `co_z`) and remove **`peer.strictMode`** from [`seed.js`](libs/maia-db/src/migrations/seeding/seed.js) tail. Most helpers stay **namekey-aware** until transform completes.

| File | Role | Update for this plan? |
|------|------|----------------------|
| [`libs/maia-db/src/migrations/seeding/seed.js`](libs/maia-db/src/migrations/seeding/seed.js) | Orchestrates bootstrap, schema seed, vibes, `seedData`, `storeRegistry`, sets `peer.strictMode` | **Yes** — remove `strictMode` assignment; **add** `runtimeRefs` population (after `factoryCoIdMap` / `spark.os` ready). |
| [`libs/maia-db/src/migrations/seeding/bootstrap.js`](libs/maia-db/src/migrations/seeding/bootstrap.js) | Creates °maia spark, `os`, `factories`, `indexes`, `vibes`, account registries | **Yes** — create or reserve **`runtimeRefs`** CoMap on `os` (or set fields) so seed can fill co-ids in one place. |
| [`libs/maia-db/src/migrations/seeding/configs.js`](libs/maia-db/src/migrations/seeding/configs.js) | `seedConfigs` / `createCoValueForSpark` for actors, contexts, vibes | **Verify** — already uses `transformForSeeding`; ensure outputs are `co_z` for stored configs (no new fallback). |
| [`libs/maia-db/src/migrations/seeding/data.js`](libs/maia-db/src/migrations/seeding/data.js) | `seedData` — todos, notes, etc. | **Verify** — looks up factory via registry map from seed; may need **keys** aligned with `runtimeRefs` roles only if you add parallel lookups (usually unchanged). |
| [`libs/maia-db/src/migrations/seeding/helpers.js`](libs/maia-db/src/migrations/seeding/helpers.js) | `sortSchemasByDependency`, `ensureSparkOs`, `findCoReferences` (`°maia/factory/`) | **Keep** — pure seed-time dependency sort; **no** runtime change unless you rename factory keys globally (out of scope). |
| [`libs/maia-db/src/migrations/seeding/store-registry.js`](libs/maia-db/src/migrations/seeding/store-registry.js) | Persists nanoid/co-id registry after seed | **Verify** — if `runtimeRefs` are duplicated state, document single writer (seed) to avoid drift. |
| [`libs/maia-db/src/migrations/seeding/nanoid-registry.js`](libs/maia-db/src/migrations/seeding/nanoid-registry.js) | Migrate nanoid map | **Verify** on migrate path only. |
| [`libs/maia-db/src/migrations/factory.migration.js`](libs/maia-db/src/migrations/factory.migration.js) | Fresh-account profile scaffold (`createFactoryMeta`) | **Unlikely** — not registry walk; revisit only if `createFactoryMeta` / `ProfileFactory` contract changes. |
| [`libs/maia-factories/src/factory-transformer.js`](libs/maia-factories/src/factory-transformer.js) | `transformForSeeding`, validation of remaining `°maia` refs | **Keep** — core of **S** path; ensure it still emits **only** `co_z` for stored CoValues (existing contract). |
| [`libs/maia-factories/src/seeding-utils.js`](libs/maia-factories/src/seeding-utils.js) | `deriveInboxId` from actor path strings | **Unlikely** — file-path convention, not peer resolution. |
| [`libs/maia-universe/src/maia/seeding.js`](libs/maia-universe/src/maia/seeding.js) | `buildSeedConfig`, `VIBE_SCHEMA` / `INBOX_SCHEMA` constants, merges vibe registries | **Keep constants** as seed input; **no** runtime peer. Optional later: reduce duplication if vibe schema co-id is injected from build. |
| [`libs/maia-seed/src/seed-config.js`](libs/maia-seed/src/seed-config.js) | Standalone seed config helpers (`$factory` strings) | **S** — stays namekey-in; transform in db seed. |
| [`libs/maia-factories/tests/seeding-utils.test.js`](libs/maia-factories/tests/seeding-utils.test.js) | Inbox id derivation | **T** — update only if `deriveInboxId` rules change. |
| [`libs/maia-engines/src/engines/data.engine.js`](libs/maia-engines/src/engines/data.engine.js) | `seedOp` → `peer.seed(...)` | **Yes** — same peer as post-boot; after seed completes, **`resolveSystemFactories`** / **`runtimeRefs`** must reflect new state (already calls seed via peer). |
| [`libs/maia-peer/src/coID.js`](libs/maia-peer/src/coID.js) | Injects optional `seed(account, node)` after account create | **Unlikely** — wiring only. |
| [`libs/maia-storage/src/clearStorageForReseed.js`](libs/maia-storage/src/clearStorageForReseed.js) | PGlite/postgres truncate for `PEER_SYNC_SEED` | **No** — storage only. |
| [`services/sync/src/index.js`](services/sync/src/index.js) | Boot peer, `resolveSystemFactories`, `strictMode` | **Yes** — same as runtime audit (not seed file, but runs seed on server). |

**Summary:** **Must change** for seeding: **`seed.js`**, **`bootstrap.js`**, and **`data.engine.js`** (fill `runtimeRefs` + mirror after seed if needed). **Must verify:** `configs.js`, `data.js`, `store-registry.js`, `factory-transformer`. **Leave** unless global rename: `helpers.js`, `seeding-utils.js`, `maia-universe/seeding.js` (authoring constants).

---

## 5. TDD (bun, colocated)

- [`libs/maia-db/tests/resolver-strict.test.js`](libs/maia-db/tests/resolver-strict.test.js): **always** strict — remove `strictMode: false` mocks; negative tests for non-`co_z` identifiers.
- Optional: `runtime-pointers.test.js` — infra paths use `getRuntimeRef` / `runtimeRefs` only.
- Optional: `maia-engines` test for `resolveSystemFactories` filling refs **without** `°maia` in consumer code.
- Run: `bun test`, `bun run check:ci`.

---

## 6. Execution phases (single ordered track)

**Phase 1 — Resolver + strict flag**  
- Delete non-strict `resolve()` branch; move **`lookupRegistryKey`** to seed-only module if still needed.  
- Remove **`peer.strictMode`** from MaiaDB, loader, seed tail; fix **reactive-resolver** single path.

**Phase 2 — `runtimeRefs` + call sites**  
- Add **`spark.os.runtimeRefs`** (or equivalent) at seed; **`peer.getRuntimeRef(role)`** + role enum module.  
- Replace all **`systemFactoryCoIds.get('°maia/...')`** in read, MaiaDB helpers, inbox, index-manager.

**Phase 3 — Collection / read**  
- **`collection-helpers`:** non-`co_z` schema → **throw** (no `lookupRegistryKey`).

**Phase 4 — Seed / universe**  
- Write **`runtimeRefs`** in bootstrap/seed after factories map exists; verify **`transformForSeeding`** materializes **`co_z`** in stored CoValues.

**Phase 5 — Compaction**  
- Dedupe seed-only helpers; target **~20%** line reduction in resolver and related files by **deleting** branches.

**Phase 6 — CI**  
- Full test + `check:ci`.

---

## 7. Optional add-on (first-principles “smartest addition”)

- **`runtimeRefs`** as the **only** infra lookup surface at runtime — migrate can repopulate from `spark.os.factories` in **one** place; application JS stays free of `°maia/` and free of factories map walks for infra.

---

## 8. Human feedback gate

- **Option 1 (default):** Keep `spark.os.factories` keys as `°maia/...`; add **`runtimeRefs`** for infra.  
- **Option 2 (later):** Migrate factories map keys (full DB migration) — out of scope for this execution unless explicitly scheduled.

---

## 9. Out of scope (unless added later)

- Renaming all `spark.os.factories` keys away from `°maia/...`.  
- Deleting the factories CoMap (breaks seed/migrate).

---

## 10. Supersedes

- `~/.cursor/plans/factories_co-id_execution_ef3ac63d.plan.md`  
- [`.cursor/plans/factories_strict_only_execution.plan.md`](.cursor/plans/factories_strict_only_execution.plan.md) (redirect stub)

Canonical copy: **this file** — [`MaiaOS/.cursor/plans/factories_master_execution.plan.md`](.cursor/plans/factories_master_execution.plan.md).
