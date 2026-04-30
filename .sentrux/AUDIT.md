# Sentrux structural audit — MaiaOS

Generated from Sentrux CLI + repo changes. Re-run after refactors: `sentrux check .` (enforces [`.sentrux/rules.toml`](.sentrux/rules.toml)); GUI: `sentrux .` or MCP `scan` + `health` + `dsm`.

## Snapshot (2026-04-30 — depth/quality push complete)

| Metric | Value | Notes |
|--------|-------|-------|
| **Quality** (`sentrux check`) | **5537** | printed as single composite after `check` |
| **Cycles** | **0** | `max_cycles = 0` in rules — `sentrux check` passes |
| rules.toml | `max_cycles = 0` | No tolerated SCCs |

**Prior snapshot (plan baseline):** quality_signal **4926**, acyclicity raw **1**, depth raw **28**, propagation_cost **748**, cross_module_edges **312**.

## Refactors captured in this audit

### `@MaiaOS/db` — SCC breaks

1. **groups / indexing / create** — `factory-index-schema.js` no longer imports `../crud/create.js`. Creation uses `createCoValueForSpark` + shared [`determine-cotype-for-create.js`](libs/maia-db/src/cojson/crud/determine-cotype-for-create.js) (`ensure-covalue-core` only). [`create.js`](libs/maia-db/src/cojson/crud/create.js) imports the same helper (removed dependency on `collection-helpers` for cotype resolution).
2. **factory-index-manager ↔ rebuild** — [`rebuildAllIndexes`](libs/maia-db/src/cojson/indexing/factory-index-rebuild.js) is exported from `@MaiaOS/db/cojson/indexing/factory-index-rebuild` only (not re-exported from `factory-index-manager.js`). Seed imports the rebuild subpath.

### Read / groups / MaiaDB split

- Prior work: read stack flatten, `groups-core` / `groups.js`, `factory-index-schema` / `factory-index-rebuild`, MaiaDB split modules under `cojson/core/`.

### Services via `@MaiaOS/runtime`

- Sync/app consumer imports should route through the runtime facade per monorepo policy; verify in PR diff.

## `@MaiaOS/db` resolver graph (2026-04-30)

- **`resolve()`** uses **`peer.read(null, coId, null, null, options)`** — requires MaiaDB-like **`peer.read`**. See [`authoring-resolver.js`](libs/maia-db/src/cojson/factory/authoring-resolver.js).
- **`ensureCoValueLoadedAuthoring`** imports **`ensure-covalue-core.js`** only.
- **`loadFactoriesFromAccount`** in [`load-factories-from-account.js`](libs/maia-db/src/cojson/factory/load-factories-from-account.js); re-exported from [`resolver.js`](libs/maia-db/src/cojson/factory/resolver.js).

## Package cycle removed (historical)

- **`@MaiaOS/runtime` ↔ `@MaiaOS/universe`:** Universe imports `readStore` from **`@MaiaOS/db/resolve-helpers`**.

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
