# Loader Single Entry + @MaiaOS/seed Fullstack Refactor

---
name: Loader Single Entry Seed Refactor
overview: Extract all seeding logic into @MaiaOS/seed; make loader the single entry point. One clean flow for dev and prod.
todos:
  - id: m1
    content: Create @MaiaOS/seed package with registry data and seeding orchestration
    status: pending
  - id: m2
    content: Update vibes to import registries from seed; remove seeding functions from vibes
    status: pending
  - id: m3
    content: Extend loader to re-export from seed; add cojson-transport-ws
    status: pending
  - id: m4
    content: Update moai and maia to import only from loader; slim deps
    status: pending
  - id: m5
    content: Docs, verification, cleanup
    status: pending
---

## Problem Statement

Services (maia, moai) import from multiple packages. Seeding logic is scattered across vibes (getAllVibeRegistries, buildSeedConfig, filterVibesForSeeding), schemata (getAllSchemas), tools (getAllToolDefinitions), and maia-db (simpleAccountSeed, genesisAccountSeed). Target: **@MaiaOS/seed** owns all seeding; **loader** is the single entry; one flow for dev and prod.

## Success Criteria

- **Desirable**: Single dependency (loader) for services; seeding centralized in @MaiaOS/seed
- **Feasible**: No circular dependencies (loader -> seed -> ... ; seed must not depend on loader)
- **Viable**: Clear separation; maia-db execution layer can stay or migrate later

## Constraint: Breaking the Cycle

**Current cycle**: vibes -> loader. If loader re-exports seeding and seeding needs vibes, we get loader -> seed -> vibes -> loader.

**Solution**: @MaiaOS/seed owns the **registry data** (TodosVibeRegistry, etc.) and **seeding orchestration**. Vibes imports registries from seed for its loaders. Flow: vibes -> seed. loader -> seed. No cycle.

---

## Architecture (Target)

```mermaid
flowchart TB
    subgraph services [Services]
        maia[maia]
        moai[moai]
    end
    
    subgraph loader [Loader - Single Entry]
        loaderIdx[loader/src/index.js]
    end
    
    subgraph seed [@MaiaOS/seed]
        registries[Registries + orchestration]
        getAllVibeRegistries[getAllVibeRegistries]
        buildSeedConfig[buildSeedConfig]
        filterVibes[filterVibesForSeeding]
        getAllSchemas[getAllSchemas]
        getAllTools[getAllToolDefinitions]
    end
    
    subgraph vibes [maia-vibes]
        loaders[loadTodosVibe etc]
    end
    
    maia --> loaderIdx
    moai --> loaderIdx
    loaderIdx --> seed
    loaderIdx --> cojsonWs[cojson-transport-ws]
    seed --> schemata[maia-schemata]
    seed --> tools[maia-tools]
    loaders --> registries
    vibes --> seed
```

---

## Implementation Milestones

### Milestone 1: Create @MaiaOS/seed

**Create** `libs/maia-seed/`:

**1.1 Package structure**
- `package.json`: name `@MaiaOS/seed`, deps: `@MaiaOS/schemata`, `@MaiaOS/tools`
- `src/index.js` - main exports
- `src/registries/` - registry data (moved from vibes)

**1.2 Move registry data from vibes to seed**
- Copy `libs/maia-vibes/src/todos/`, `db/`, `chat/`, `sparks/`, `creator/` (registry.js + .maia files) into `libs/maia-seed/src/registries/`
- Create `libs/maia-seed/src/registries/index.js` that builds ALL_REGISTRIES and exports:
  - `getAllVibeRegistries()`
  - Individual registries (TodosVibeRegistry, DbVibeRegistry, etc.) for vibes loaders

**1.3 Move pure seeding helpers from vibes**
- `getVibeKey`, `normalizeVibeForSeeding`, `buildSeedConfig`, `filterVibesForSeeding` - move to [libs/maia-seed/src/index.js](libs/maia-seed/src/index.js)
- These are pure; buildSeedConfig/filterVibes use registries passed in or from getAllVibeRegistries

**1.4 Re-export schemata + tools**
- `export { getAllSchemas } from '@MaiaOS/schemata'`
- `export { getAllToolDefinitions } from '@MaiaOS/tools'`

**1.5 Root workspaces**
- Add to root `package.json` workspaces (libs/* already includes new dir)
- Run `bun install`

---

### Milestone 2: Update vibes to use seed

**Edit** [libs/maia-vibes](libs/maia-vibes):

- Add dep: `@MaiaOS/seed`
- Remove from vibes index: getAllVibeRegistries, buildSeedConfig, filterVibesForSeeding, getVibeKey, normalizeVibeForSeeding
- Remove registry definitions - instead re-export from seed:
  - `export { TodosVibeRegistry, DbVibeRegistry, ... } from '@MaiaOS/seed'`
- Update `todos/loader.js`, `db/loader.js`, etc.: import registry from `@MaiaOS/seed` (or `../registries` rel path) - registries now live in seed, vibes just re-exports for backwards compat
- Delete duplicated registry files in vibes (or make them thin re-exports from seed)

**Vibes structure after**: vibes owns loaders (createVibeLoader, loadTodosVibe, etc.) and re-exports registries from seed. Vibes keeps MaiaOS re-export from loader.

---

### Milestone 3: Extend loader

**Edit** [libs/maia-loader/package.json](libs/maia-loader/package.json):
- Add deps: `@MaiaOS/seed`, `cojson-transport-ws`

**Edit** [libs/maia-loader/src/index.js](libs/maia-loader/src/index.js):
- Re-export from seed: `getAllSchemas`, `getAllToolDefinitions`
- Re-export: `createWebSocketPeer` from `cojson-transport-ws`
- **Do NOT** re-export getAllVibeRegistries, buildSeedConfig, filterVibesForSeeding — those come from vibes.mjs (loaded separately by both maia and moai at runtime)

**getAllSchemas clarity**: Loader exports schemata's getAllSchemas via seed. Db internals use their own import from db.

---

### Milestone 4: Update moai and maia

**Edit** [services/moai/src/index.js](services/moai/src/index.js):
- Import core/backend from `@MaiaOS/loader` (CoJSONBackend, DBEngine, etc.)
- Load vibes from vibes.mjs via dynamic import (same pattern as client loading vibes separately):
  - `const { getAllVibeRegistries, buildSeedConfig, filterVibesForSeeding } = await import(pathToVibesMjs)`
  - Path: resolve relative to moai runtime (e.g. `join(__dirname, '../../libs/maia-distros/output/vibes.mjs')` when running from services/moai, or from distros output when running bundled)
- Import createWebSocketPeer from loader; getAllSchemas, getAllToolDefinitions from loader (or seed via loader)

**Edit** [libs/maia-distros/scripts/build.js](libs/maia-distros/scripts/build.js):
- Add `external: ['vibes.mjs']` or use a dynamic import pattern so vibes is NOT bundled into moai-server.mjs
- Moai's dynamic import uses a path—Bun.build may need `external` for the vibes entry or we use `import.meta.resolve` / path join that the bundler treats as external

**Edit** [services/moai/package.json](services/moai/package.json):
- Remove: `@MaiaOS/schemata`, `@MaiaOS/tools`, `@MaiaOS/vibes`, `cojson-transport-ws`
- Keep: `@MaiaOS/loader`, `@MaiaOS/maia-distros`

**Edit** [services/maia/main.js](services/maia/main.js), [services/maia/dashboard.js](services/maia/dashboard.js):
- Keep loading vibes from vibes.mjs (jsconfig maps @MaiaOS/vibes to it)
- Replace tools/schemata imports with loader (getAllSchemas, getAllToolDefinitions)

**Edit** [services/maia/db-view.js](services/maia/db-view.js):
- Verify getAllSchemas from loader (loader will have it from seed)

---

### Milestone 5: Documentation and verification

- Update [.cursor/rules/monorepo-architecture.mdc](.cursor/rules/monorepo-architecture.mdc)
- Update [libs/maia-docs/03_developers/02_maia-loader/](libs/maia-docs/03_developers/02_maia-loader/) - document seed re-exports
- Create `libs/maia-docs/03_developers/02_maia-seed/` or add to 02_maia-loader
- Update maia-db seed.js: ensure it still gets getAllSchemas from schemata (it uses dynamic import - no change needed) or from a param
- Run: `bun install`, `bun run distros:build`, `bun run check:ci`, manual dev test

---

## Bundle Structure

**Vibes stays standalone**—`vibes.mjs` is a separate bundle (not merged into maia-client or moai-server).

**Same flow for client and server**: Both maia and moai load vibes from vibes.mjs at runtime.

**Distros output:**
- `maia-client.mjs` — main client (loader re-exports)
- `vibes.mjs` — standalone vibes bundle (used by both maia client and moai server)
- `moai-server.mjs` — Node server (does NOT bundle vibes; loads from vibes.mjs at runtime)
- `pglite.wasm` — vendored for PGlite

**Deploy artifacts:**
- **Maia**: maia-client.mjs + vibes.mjs
- **Moai**: moai-server.mjs + vibes.mjs + pglite.wasm

**Implementation**: Moai uses dynamic `import()` to load vibes. Path: when running from distros output, vibes.mjs is next to moai-server.mjs, so use `join(dirname(fileURLToPath(import.meta.url)), 'vibes.mjs')`. In dev, moai runs from source—use `import('@MaiaOS/vibes')` (resolves via workspace). Use a runtime check: if running as bundled (import.meta.url points to output dir), use file path; else use '@MaiaOS/vibes'. Moai must NOT statically import from vibes so the bundler excludes it from moai-server.mjs. Distros build: add vibes to external or ensure dynamic import path is not bundled.

**Node compatibility**: vibes.mjs is currently built with `target: 'browser'`. For moai (Node) to load it, we need either: (a) vibes.mjs to be Node-compatible for the seeding path (no browser-only code when only seeding exports are used), or (b) a separate `vibes-server.mjs` (target: node) with only seeding exports. Prefer (a) first; add (b) if browser-only code runs at import time.

---

## File Summary

| Action | Path |
|--------|------|
| Create | libs/maia-seed/package.json |
| Create | libs/maia-seed/src/index.js |
| Create | libs/maia-seed/src/registries/ (todos, db, chat, sparks, creator) |
| Edit | libs/maia-vibes - remove seeding logic, import registries from seed |
| Edit | libs/maia-loader - add seed, cojson-transport-ws; re-export |
| Edit | services/moai - import from loader only; remove deps |
| Edit | services/maia - import from loader only |

---

## Registry Move Detail

Registries in vibes: [libs/maia-vibes/src/todos/registry.js](libs/maia-vibes/src/todos/registry.js) etc. Each imports .maia files and exports `{ vibe, styles, actors, views, contexts, states, inboxes, data }`. Move entire dirs (registry.js + .maia files) to maia-seed. Vibes loaders import from seed. Shared files (e.g. `shared/brand.style.maia`) - move to seed's shared/ or adjust imports.
