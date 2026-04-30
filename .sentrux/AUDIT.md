# Sentrux structural audit — MaiaOS

Generated from Sentrux MCP + repo changes. Re-run after refactors: `sentrux .` (GUI) or MCP `scan` + `health` + `dsm`.

## Snapshot (pre/post cycle-break)

| Metric | Value | Notes |
|--------|-------|--------|
| quality_signal | ~4806 | geometric mean of five root causes |
| bottleneck | **depth** | raw 32; target: flatten lib graph |
| acyclicity | 5000 | raw **1** cycle at file graph — one **package** cycle was **runtime ↔ universe** |
| DSM | above_diagonal 0, level_breaks 20 | clean downward layering but **deep** |
| propagation_cost | 1250 | high ripple from edits |

## Package cycle removed (2026-04-30)

- **Before:** `@MaiaOS/runtime` → `@MaiaOS/universe` → `@MaiaOS/runtime` (via `readStore` import from `runtime/utils/resolve-helpers.js`).
- **After:** `readStore` / `loadContextStore` / `resolveSchemaFromCoValue` / `resolveToCoId` live in **`@MaiaOS/db`** (`resolve-helpers` export). `@MaiaOS/runtime/utils/resolve-helpers` re-exports from db. **Universe** imports `readStore` from **`@MaiaOS/db/resolve-helpers`** and no longer lists `@MaiaOS/runtime` in `package.json`.

## Longest chain / remaining depth

Sentrux Pro advertises deeper “root-cause diagnostics.” In OSS tooling, use **GUI treemap** (`sentrux .`) for file-level longest paths. Depth is expected to improve incrementally as **lib→lib** edges are folded through **`@MaiaOS/runtime` / `maia-distros`** per monorepo rules.

## Next actions

1. `.sentrux/rules.toml` — layers; **`max_cycles = 1`** until `resolve()` no longer depends on universal `read()` in the authoring ↔ indexing bootstrap SCC (quality **~4987** as of 2026-04-30).
2. **`sentrux check .`** in PR CI (`.github/workflows/biome.yml` — Linux binary).
3. **Test gaps:** follow [`libs/maia-docs/03_developers/sentrux-test-gaps.md`](../libs/maia-docs/03_developers/sentrux-test-gaps.md).

### 2026-04-30 — `@MaiaOS/db` cycle shrink

- `reactive-resolver.js` no longer imports `read.js`; reactive queries use **`peer.read`** (MaiaDB).
- `data-extraction.js` + `reactive-resolver.js` use **`ensure-covalue-core.js`** instead of `collection-helpers` for load/wait (avoids pulling indexing into that edge).
- `factory-index-manager.js` warm-load uses **`ensureCoValueLoaded`** from `ensure-covalue-core.js`, not universal `read()`.
