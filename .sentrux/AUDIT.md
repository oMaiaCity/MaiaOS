# Sentrux structural audit — MaiaOS

Generated from Sentrux CLI + repo changes. Re-run after refactors: `sentrux check .` (enforces [`.sentrux/rules.toml`](.sentrux/rules.toml)); GUI: `sentrux .` or MCP `scan` + `health` + `dsm`.

## Snapshot (2026-04-30 — Sentrux depth execution pass)

| Metric | Value | Notes |
|--------|-------|-------|
| **Quality** (`sentrux check` / MCP `quality_signal`) | **5655** | composite after `check` |
| **depth raw** (MCP `health`) | **28** | bottleneck remains **depth** (score ~2222) |
| **Cycles** | **0** | `max_cycles = 0` — `sentrux check` passes |
| **DSM (stats)** | propagation_cost **779**, level_breaks **30**, edges **871**, size **408** | clean layering |
| **cross_module_edges** (health) | **312** | |

**Historical baselines:** quality_signal **4926** (older); **5537** (pre–depth-execution doc row).

### Local longest-path script

[`scripts/sentrux-longest-chain.mjs`](../scripts/sentrux-longest-chain.mjs) — static `from` imports with comments stripped; `@MaiaOS/*` resolved via `package.json` workspace layout. **Not identical** to Sentrux’s resolver (e.g. `.maia` graph); use for **before/after chain length** and **which files sit on the spine**. After this pass, example spine length **~27 nodes** (often via **`services/sync`** → runtime → flows → seed → universe → db → … → logs).

### validation → universe tail (Phase 3 decision)

**No change:** [`libs/maia-validation/src/identity-from-maia-path.js`](libs/maia-validation/src/identity-from-maia-path.js) depends on universe helpers for canonical Maia path / nanoid behavior. Splitting nanoid-only bits into validation would duplicate the universe contract; **accepted** as an intentional layering cost for factory and schema identity.

## Refactors — depth execution (2026-04-30)

1. **App / db-view** — Narrow `@MaiaOS/runtime` where possible: [`db-view.js`](../services/app/db-view.js) uses `@MaiaOS/db` + `@MaiaOS/logs`; [`dashboard.js`](../services/app/dashboard.js) same pattern; [`capabilities.js`](../services/app/db-view/capabilities.js) / [`members.js`](../services/app/db-view/members.js) import db + logs; [`cobinary-preview.js`](../services/app/db-view/cobinary-preview.js) → `@MaiaOS/logs`; [`sync-inspector.js`](../services/app/db-view/sync-inspector.js) → `@MaiaOS/peer` for sync URL; [`maia-game-mount.js`](../services/app/maia-game-mount.js) → `@MaiaOS/logs` for `createLogger`.
2. **Chat session path** — [`chat-session-ids.js`](../services/app/chat-session-ids.js): `resolveChatVibeCoId` / `findSessionChatIntentActorId` with `@MaiaOS/validation/identity-from-maia-path` only (no runtime barrel on dashboard import path). [`maia-ai-global.js`](../services/app/maia-ai-global.js): `ACTOR_NANOID_TO_EXECUTABLE_KEY` from `@MaiaOS/universe/generated/registry.js`; re-exports chat helpers from `chat-session-ids.js`.
3. **`@MaiaOS/db` cotypes** — [`coList.js`](../libs/maia-db/src/cojson/cotypes/coList.js) / [`coMap.js`](../libs/maia-db/src/cojson/cotypes/coMap.js): **`import()`** `@MaiaOS/validation/validation.helper` at validate time to drop static **`validation.helper` → engine** from the load-time graph.
4. **Index warm-load** — [`factory-index-warm-load.js`](../libs/maia-db/src/cojson/indexing/factory-index-warm-load.js): `createLogger` from `@MaiaOS/logs/subsystem-logger` (shallow log path, same idea as `ensure-covalue-core`).

**`services/app/package.json`:** direct `workspace:*` on `@MaiaOS/db`, `@MaiaOS/logs`, `@MaiaOS/peer`, `@MaiaOS/universe`, `@MaiaOS/validation` where used above.

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
