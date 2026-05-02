# Sentrux structural audit — MaiaOS

Generated from Sentrux CLI + repo changes. Re-run after refactors: `sentrux check .` (enforces [`.sentrux/rules.toml`](.sentrux/rules.toml)); GUI: `sentrux .` or MCP `rescan` + `health` + `dsm`.

## Canonical source of truth (Sentrux only)

Depth and structural quality are defined **only** by Sentrux — not by ad‑hoc repo scripts.

- **CLI:** `sentrux check .`
- **MCP (Cursor):** `rescan` then `health` on the repo root

Use **`health.quality_signal`**, **`health.bottleneck`**, and **`health.root_causes`** (`depth`, `equality`, `modularity`, `redundancy`, `acyclicity` — each has `raw` and `score`). Use **`health.total_import_edges`** and **`health.cross_module_edges`** for graph size. **`rescan`** reports **`files`** included in the scan.

### Latest MCP snapshot (2026-04-30)

| Field | Value |
|--------|--------|
| `quality_signal` | **5757** |
| `bottleneck` | **depth** |
| `depth.raw` / `depth.score` | **24** / **2500** |
| `equality.score` | **4193** |
| `modularity.score` | **6807** |
| `redundancy.score` | **8866** |
| `acyclicity.score` | **10000** |
| `total_import_edges` | **905** |
| `cross_module_edges` | **325** |
| `files` (after `rescan`) | **837** |

## Baseline — depth cut pass (2026-04-30, pre-implementation)

| Metric | Value | Notes |
|--------|-------|-------|
| **Quality** (`sentrux check` / MCP `quality_signal`) | **5,651** | MCP `health` at repo root |
| **depth raw** | **28** | bottleneck **depth** (score ~2,222) |
| **DSM** | propagation_cost **709**, level_breaks **30**, edges **897**, size **415** | clean layering |

## Post-pass — `@MaiaOS/db` primitives + modules facade (2026-04-30)

Implemented in repo (re-run Sentrux when CLI available):

- **`libs/maia-db/src/primitives/`** — `reactive-store`, `co-cache`, `ensure-covalue-core`, `data-extraction`, `factory-registry` (→ validation), `capability-grant-ttl`; cojson code imports these via `../../primitives/...`.
- **`libs/maia-db/src/modules/{crud,groups,spark,indexing}.js`** — grouped barrels (no cross-imports between module files); implementation stays under `cojson/` until any full single-file merge.
- **`libs/maia-db/src/index.js`** — thin facade: `@MaiaOS/peer` + `export *` from modules + `profile-bootstrap` + `generateRegistryName`.
- **Maia-domain naming** — `getFactory` / `hasFactory` / `resolveFactoryFromCoValue`; **`builtin-factories.data.js`**; seed **`sortFactoriesByDependency`**; `clearLocalPgliteAndFsBlob` from **`@AvenOS/kernel/server`** so sync keeps OS surface in one workspace package.
- **CI** — [`scripts/lint-import-invariants.mjs`](../scripts/lint-import-invariants.mjs), [`scripts/lint-naming-invariants.mjs`](../scripts/lint-naming-invariants.mjs) in `check:ci`; Biome ignores vendored **`libs/kernel/output`**.
- **Verification** — `bun test` (db, validation, engine, seed); **`bun run check:ci`** passes.

## Snapshot (2026-04-30 — Sentrux depth execution pass)

| Metric | Value | Notes |
|--------|-------|-------|
| **Quality** (`sentrux check` / MCP `quality_signal`) | **5655** | composite after `check` |
| **depth raw** (MCP `health`) | **28** | bottleneck remains **depth** (score ~2222) |
| **Cycles** | **0** | `max_cycles = 0` — `sentrux check` passes |
| **DSM (stats)** | propagation_cost **779**, level_breaks **30**, edges **871**, size **408** | clean layering |
| **cross_module_edges** (health) | **312** | |

**Historical baselines:** quality_signal **4926** (older); **5537** (pre–depth-execution doc row).

### validation ↔ migrate identity (Phase 3 decision)

**No change:** [`libs/maia-validation/src/identity-from-maia-path.js`](libs/maia-validation/src/identity-from-maia-path.js) implements Maia path / nanoid behaviour aligned with [`libs/universe/src/avens/maia/helpers/identity-from-maia-path.js`](libs/universe/src/avens/maia/helpers/identity-from-maia-path.js). Authoring JSON is under **`libs/universe/src/avens/maia/seed/`** with **`bun run migrate:registry`** for generated registry slices.

## Refactors — depth execution (2026-04-30)

1. **App / db-view** — Narrow `@MaiaOS/runtime` where possible: [`db-view.js`](../services/app/db-view.js) uses `@MaiaOS/db` + `@MaiaOS/logs`; [`dashboard.js`](../services/app/dashboard.js) same pattern; [`capabilities.js`](../services/app/db-view/capabilities.js) / [`members.js`](../services/app/db-view/members.js) import db + logs; [`cobinary-preview.js`](../services/app/db-view/cobinary-preview.js) → `@MaiaOS/logs`; [`sync-inspector.js`](../services/app/db-view/sync-inspector.js) → `@MaiaOS/peer` for sync URL; [`maia-game-mount.js`](../services/app/maia-game-mount.js) → `@MaiaOS/logs` for `createLogger`.
2. **Chat session path** — [`chat-session-ids.js`](../services/app/chat-session-ids.js): `resolveChatVibeCoId` / `findSessionChatIntentActorId` with `@MaiaOS/validation/identity-from-maia-path` only (no runtime barrel on dashboard import path). [`maia-ai-global.js`](../services/app/maia-ai-global.js) re-exports those helpers (no static import of a generated actor registry).
3. **`@MaiaOS/db` cotypes** — [`coList.js`](../libs/maia-db/src/cojson/cotypes/coList.js) / [`coMap.js`](../libs/maia-db/src/cojson/cotypes/coMap.js): **`import()`** `@MaiaOS/validation/validation.helper` at validate time to drop static **`validation.helper` → engine** from the load-time graph.
4. **Index warm-load** — [`factory-index-warm-load.js`](../libs/maia-db/src/cojson/indexing/factory-index-warm-load.js): `createLogger` from `@MaiaOS/logs/subsystem-logger` (shallow log path, same idea as `ensure-covalue-core`).

**`services/app/package.json`:** workspace deps for the SPA are **`@MaiaOS/game`** and **`@AvenOS/kernel`** (narrow shell; DB/peer live in bundled client from distros where needed).

## Refactors captured in this audit

### `@MaiaOS/db` — SCC breaks

1. **groups / indexing / create** — `factory-index-schema.js` no longer imports `../crud/create.js`. Creation uses `createCoValueForSpark` + shared [`determine-cotype-for-create.js`](libs/maia-db/src/cojson/crud/determine-cotype-for-create.js) (`ensure-covalue-core` only). [`create.js`](libs/maia-db/src/cojson/crud/create.js) imports the same helper (removed dependency on `collection-helpers` for cotype resolution).
2. **factory-index-manager ↔ rebuild** — [`rebuildAllIndexes`](libs/maia-db/src/cojson/indexing/factory-index-rebuild.js) is exported from `@MaiaOS/db/cojson/indexing/factory-index-rebuild` only (not re-exported from `factory-index-manager.js`). Seed imports the rebuild subpath.

### Read / groups / MaiaDB split

- Prior work: read stack flatten, `groups-core` / `groups.js`, `factory-index-schema` / `factory-index-rebuild`, MaiaDB split modules under `cojson/core/`.

### Services via `@MaiaOS/runtime`

- **Boot / MaiaOS / engines** still use **`@MaiaOS/runtime`** (e.g. [`main.js`](../services/app/main.js), sync). **DB viewer** modules narrow to **`@MaiaOS/db`**, **`@MaiaOS/logs`**, **`@MaiaOS/peer`** where possible to shorten the static import spine (see **Refactors — depth execution** above).

## `@MaiaOS/db` resolver graph (2026-04-30)

- **`resolve()`** uses **`peer.read(null, coId, null, null, options)`** — requires MaiaDB-like **`peer.read`**. See [`authoring-resolver.js`](libs/maia-db/src/cojson/factory/authoring-resolver.js).
- **`ensureCoValueLoadedAuthoring`** imports **`ensure-covalue-core.js`** only.
- **`loadFactoriesFromAccount`** in [`load-factories-from-account.js`](libs/maia-db/src/cojson/factory/load-factories-from-account.js); re-exported from [`resolver.js`](libs/maia-db/src/cojson/factory/resolver.js).

## Package cycle removed (historical)

- **Historical — resolver helpers:** Spark migrate content and runtime read paths use **`readStore`** from **`@MaiaOS/db/resolve-helpers`** (`@MaiaOS/universe` removed 2026-05).

## Next actions

1. **`sentrux check .`** in PR CI when ready (metrics align with `rules.toml`).
2. **MCP `health` / `dsm`:** optional for full quality_signal / depth raw / propagation_cost table when GUI/MCP available.
3. **Test gaps:** follow [`TEST-GAPS.md`](TEST-GAPS.md).

### Historical — `@MaiaOS/db` cycle shrink

- `reactive-resolver.js` / `data-extraction.js`: **`ensure-covalue-core.js`** where applicable.
- `groups.js` **`addGroupMember`**: **`ensure-covalue-core`** (no dynamic `collection-helpers`).

### Historical — Phase 4: DataEngine CoList dispatch

- **`libs/maia-runtime/src/engines/data.engine.js`**: `COLIST_OP_DISPATCH` / **`COLIST_WRITE_OP_NAMES`**.

### Historical — Repo trim: Moai / maia-ai

- In-app chat: **`services/app/maia-ai-global.js`**, sync **`/api/v0/llm/chat`**.
