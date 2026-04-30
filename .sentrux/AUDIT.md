# Sentrux structural audit — MaiaOS

Generated from Sentrux MCP + repo changes. Re-run after refactors: `sentrux .` (GUI) or MCP `scan` + `health` + `dsm`.

## Snapshot (2026-04-30 — removed `services/moai` + `libs/maia-ai`, rescan)

| Metric | Value | Notes |
|--------|-------|-------|
| quality_signal | **4847** | `health` / `scan` (geometric mean) |
| files | 817 | `scan` |
| lines (approx.) | 120437 | `scan` |
| import_edges | 848–850 | `scan` / `health` (tool rounding) |
| bottleneck | **depth** | raw **31** (score 2051) |
| acyclicity | 5000 | raw **1** |
| DSM | above_diagonal **0**, level_breaks **27**, matrix size **399** | `dsm` stats; propagation_cost **778** |
| cross_module_edges | 312 | `health` |

**Compare — Phase 5 row (2026-04-30, pre-removal inventory):** quality_signal **4938**, depth raw **26**, level_breaks **26**, propagation_cost **801**, DSM size **345**, cross_module_edges **283**, import_edges **712–714**, files **783**.

Numbers move with **which files are in the tree** (e.g. `libs/ui` and other additions) as well as refactors; treat **bottleneck label** and **rule targets** as the stable guide, not single-point diffs.

## Cycle & depth optimization (audit focus)

### 1. Cycles (acyclicity raw = 1)

- **Constraint:** `.sentrux/rules.toml` keeps **`max_cycles = 1`** until the last SCC is gone.
- **Where it lives:** `read` ↔ authoring resolver (`readLazy` / `resolveSchemaLazy`) ↔ bootstrap through **`collection-helpers` → `factory-index-manager` → `create-covalue-for-spark` → cotypes → dynamic authoring** (see comment in `rules.toml`).
- **Primary lever:** Stop **`resolve()`** from depending on universal **`read()`** on the authoring ↔ indexing bootstrap path, **without** changing semantics — use peer-scoped reads and patterns already used elsewhere (**`ensure-covalue-core`**, warm-load paths that avoid pulling full `read.js`).

Breaking this SCC raises acyclicity score and usually **shortens** dependent chains that sit on top of the cycle.

### 2. Depth (current bottleneck)

Raw depth and **level_breaks** track how long dependency chains are; **propagation_cost** tracks churn sensitivity across the DSM. Improve by:

- **Facades:** Prefer one **`@MaiaOS/runtime` / `maia-distros`** entry for “app+sync call into the stack” so lib→lib edges do not duplicate long paths (matches monorepo dependency rules).
- **Narrow `maia-db` surface:** Continue splitting **read**, **indexing**, and **reactive** so indexing and reactive code do not import the heavyweight read stack unless necessary (Phase 4-style dispatch tables and `ensure-covalue-core` are the pattern).
- **Guard universe ↔ runtime:** Keep **`@MaiaOS/universe`** on **`@MaiaOS/db`** for resolve/read helpers; do not reintroduce **`@MaiaOS/runtime`** into universe `package.json`.
- **Verify:** After each structural PR, MCP **`scan`** + **`dsm`** (`format: stats`) — watch **propagation_cost**, **level_breaks**, and **cross_module_edges** together, not raw depth alone.

## Package cycle removed (2026-04-30)

- **Before:** `@MaiaOS/runtime` → `@MaiaOS/universe` → `@MaiaOS/runtime` (via `readStore` import from `runtime/utils/resolve-helpers.js`).
- **After:** `readStore` / `loadContextStore` / `resolveSchemaFromCoValue` / `resolveToCoId` live in **`@MaiaOS/db`** (`resolve-helpers` export). `@MaiaOS/runtime/utils/resolve-helpers` re-exports from db. **Universe** imports `readStore` from **`@MaiaOS/db/resolve-helpers`** and no longer lists `@MaiaOS/runtime` in `package.json`.

## Longest chain / tooling

Sentrux Pro advertises deeper “root-cause diagnostics.” In OSS tooling, use **GUI treemap** (`sentrux .`) for file-level longest paths.

## Next actions

1. **Eliminate the remaining SCC** per `rules.toml` (resolve off universal `read()` in the authoring ↔ indexing bootstrap path).
2. **`sentrux check .`** in PR CI (`.github/workflows/biome.yml` — Linux binary) when ready.
3. **Test gaps:** follow [`TEST-GAPS.md`](TEST-GAPS.md).

### 2026-04-30 — `@MaiaOS/db` cycle shrink

- `reactive-resolver.js` no longer imports `read.js`; reactive queries use **`peer.read`** (MaiaDB).
- `data-extraction.js` + `reactive-resolver.js` use **`ensure-covalue-core.js`** instead of `collection-helpers` for load/wait (avoids pulling indexing into that edge).
- `factory-index-manager.js` warm-load uses **`ensureCoValueLoaded`** from `ensure-covalue-core.js`, not universal `read()`.

### 2026-04-30 — Phase 4: DataEngine CoList dispatch table

- **`libs/maia-runtime/src/engines/data.engine.js`**: all `colist*` mutations are registered from one **`COLIST_OP_DISPATCH`** map plus **`bindColistDispatch`**; **`execute`’s** `WRITE_OPS` uses **`COLIST_WRITE_OP_NAMES`** derived from the same map (no duplicated op name lists).

### 2026-04-30 — Repo trim: Moai / maia-ai

- Removed **`services/moai`** and **`libs/maia-ai`** (on-device Python stack). In-app chat remains: **`services/app/maia-ai-global.js`**, sync **`/api/v0/llm/chat`**, **`RED_PILL_API_KEY`**.

### 2026-04-30 — Phase 5 (historical)

- MCP **`scan`**, **`health`**, **`dsm`** after Phase 4; earlier snapshot table preserved in **Compare** row above.
