# Sentrux structural audit — MaiaOS

Generated from Sentrux MCP + repo changes. Re-run after refactors: `sentrux .` (GUI) or MCP `scan` + `health` + `dsm`.

## Snapshot (2026-04-30 — Phase 5 rescan)

| Metric | Value | Notes |
|--------|-------|-------|
| quality_signal | **4938** | Sentrux `health` / `scan` (geometric mean) |
| files | 783 | `scan` |
| lines (approx.) | 119547 | `scan` |
| import_edges | 712–714 | `scan` / `health` (tool rounding) |
| bottleneck | **depth** | raw **26** (score 2353) |
| acyclicity | 5000 | raw **1** |
| DSM | above_diagonal **0**, level_breaks **26**, matrix size **345** | `dsm` stats; propagation_cost **801** |
| cross_module_edges | 283 | `health` |

Historical row (pre–Phase 5): quality_signal ~4806, depth raw 32, level_breaks 20, propagation_cost 1250.

## Package cycle removed (2026-04-30)

- **Before:** `@MaiaOS/runtime` → `@MaiaOS/universe` → `@MaiaOS/runtime` (via `readStore` import from `runtime/utils/resolve-helpers.js`).
- **After:** `readStore` / `loadContextStore` / `resolveSchemaFromCoValue` / `resolveToCoId` live in **`@MaiaOS/db`** (`resolve-helpers` export). `@MaiaOS/runtime/utils/resolve-helpers` re-exports from db. **Universe** imports `readStore` from **`@MaiaOS/db/resolve-helpers`** and no longer lists `@MaiaOS/runtime` in `package.json`.

## Longest chain / remaining depth

Sentrux Pro advertises deeper “root-cause diagnostics.” In OSS tooling, use **GUI treemap** (`sentrux .`) for file-level longest paths. Depth is expected to improve incrementally as **lib→lib** edges are folded through **`@MaiaOS/runtime` / `maia-distros`** per monorepo rules.

## Next actions

1. `.sentrux/rules.toml` — layers; **`max_cycles = 1`** until `resolve()` no longer depends on universal `read()` in the authoring ↔ indexing bootstrap SCC (quality **~4938** as of 2026-04-30 Phase 5 rescan).
2. **`sentrux check .`** in PR CI (`.github/workflows/biome.yml` — Linux binary).
3. **Test gaps:** follow [`TEST-GAPS.md`](TEST-GAPS.md).

### 2026-04-30 — `@MaiaOS/db` cycle shrink

- `reactive-resolver.js` no longer imports `read.js`; reactive queries use **`peer.read`** (MaiaDB).
- `data-extraction.js` + `reactive-resolver.js` use **`ensure-covalue-core.js`** instead of `collection-helpers` for load/wait (avoids pulling indexing into that edge).
- `factory-index-manager.js` warm-load uses **`ensureCoValueLoaded`** from `ensure-covalue-core.js`, not universal `read()`.

### 2026-04-30 — Phase 4: DataEngine CoList dispatch table

- **`libs/maia-runtime/src/engines/data.engine.js`**: all `colist*` mutations are registered from one **`COLIST_OP_DISPATCH`** map plus **`bindColistDispatch`**; **`execute`’s** `WRITE_OPS` uses **`COLIST_WRITE_OP_NAMES`** derived from the same map (no duplicated op name lists).

### 2026-04-30 — Phase 5: Sentrux

- MCP **`scan`** (`path` = repo root), **`health`**, **`dsm`** (`format: stats`) after Phase 4; figures reflected in the snapshot table above.
