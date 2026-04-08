# Spark registry model — single aggregator for maia-seed

## Intent (refined)

- **Not** separate generated blobs per *type* (vibes vs actors vs data). **Yes** one **`registry.js` per spark** (a “spark” is a top-level silo under `maia-universe/src/`).
- **One** composed export at **[maia-universe/src/registry.js](libs/maia-universe/src/registry.js)** (or `src/registry/index.js` if you prefer a folder). That file is the **only** universe surface `@MaiaOS/seed` needs: **one import, one merged object**, DRY.
- **Glob + watch** (from the prior plan) apply at the **spark** boundary: discover `**/registry.js` under each spark root, or regenerate the **aggregator** that `import`s each spark’s registry—still one entry point.

## Directory shape (illustrative)

```text
libs/maia-universe/src/
  maia/                          # system spark (today’s tree lives here)
    registry.js                  # NEW: exports this spark’s slice (vibes, actor refs, data keys, …)
    actors/ …
    vibes/ …
    data/ …
  third-party-spark/           # example future spark
    registry.js
  other-spark/
    registry.js
  registry.js                  # THE aggregator — imports + merges all spark registries
```

Naming is flexible (`3rdPartySpark` vs `third-party-spark`); **rule**: each spark folder owns **exactly one** `registry.js` that describes **everything** that spark contributes (no separate vibe-index vs seed-config split at the universe boundary).

## Path-derived keys (non-negotiable)

- **Every** map/list entry in the merged registry is keyed (or ordered) from **real paths** discovered **recursively** under each spark (e.g. `Glob` / walk). Keys are **computed** from path—e.g. stable relative POSIX path from spark root, or a deterministic slug (`maia/actors/views/sparks/actor.maia` → one canonical string). **No hand-written registry keys** (no string literals used as object keys for assets that exist on disk).
- **Composition** (which process pairs with which view) must also resolve from **paths** or **declarative files on disk** (e.g. co-located `manifest.maia` / `pairing.json` next to assets), not scattered hardcoded IDs in JS—if something must be declared, it lives **beside** the files it references, still path-addressable.
- **Collisions** (two files mapping to the same key): fail at **generate** time with a clear error.
- The **generator** (or the one `registry.js` that only calls into generated output) is the **only** place that turns `readdir`/`Glob` results into keys; humans do not maintain parallel key lists.

## Aggregator contract

- **`src/registry.js`** (name TBD; keep flat `registry.js` at `src/` for shortest import path):
  - Imports each spark’s contribution—either **generated** from that spark’s tree or a spark `registry.js` that itself re-exports **generated** path-keyed maps.
  - Exports a **single** merged structure whose **identity** is path-derived end-to-end.
- **[@MaiaOS/universe/package.json](libs/maia-universe/package.json)** adds export `"./registry": "./src/registry.js"` (or `./src/registry/index.js`).
- **[maia-seed](libs/maia-seed)** drops multiple universe imports in favor of **`import { … } from '@MaiaOS/universe/registry'`** (or one default export). No parallel `vibe-registries` + manual seed assembly from scattered modules—**one** pass.

## Generator role (Bun, committed, CI)

- **Primary**: One (or per-spark) **generated** module(s) that **scan** `**/*.maia`, `**/registry.js` (vibe manifests), `*.data.maia`, etc., under each spark root **recursively**, emit **imports + path-derived keys** (stable sort). Committed; CI fails on drift.
- **Aggregator** at `src/registry.js`: either **fully generated** (glob `src/*/`) or a **two-line** hand file that only `export * from './registry.generated.js'`—**no** hardcoded key tables.
- **Watch**: `--watch` on universe `src/**` (debounced) so path-keyed output stays in sync in dev.

## Policy: zero fallbacks, zero legacy paths (IMPORTANT + compact-simplify)

Aligned with [`.cursor/rules/IMPORTANT.mdc`](.cursor/rules/IMPORTANT.mdc) and [`.cursor/rules/compact-simplify-consoldiate.mdc`](.cursor/rules/compact-simplify-consoldiate.mdc):

- **No** backwards-compatibility layers, **no** deprecation shims, **no** “try old then new” behavior.
- **No** transitional re-exports (“re-export old module until callers migrate”) — **delete** superseded modules and **update all imports in one migration**.
- **No** heuristic **fallback** branches where behavior is guessed — prefer **explicit** inputs, **fail fast**, or **separate functions** so every path is intentional.
- **No** duplicate “old registry + new registry” in parallel.

## Full system audit (readonly) — double-check

| Area | Finding | Action for this initiative |
|------|---------|----------------------------|
| [`libs/maia-seed/src/ref-transform.js`](libs/maia-seed/src/ref-transform.js) | **`transformForSeeding`** uses **heuristic fallbacks**: (1) “schema structure” branch when `$factory` path didn’t match, (2) **default** “treat as instance if unclear”. That is legacy-style ambiguity, not a hard fail. | **Remove** guesswork: split API (e.g. `transformSchemaForSeeding` / `transformInstanceForSeeding` only) **or** require an explicit discriminant (`kind` / `$factory` contract) so there is **no** “unclear” branch. Update all call sites ([`maia-db` seeding](libs/maia-db/src/migrations/seeding/seed.js), [`data.js`](libs/maia-db/src/migrations/seeding/data.js)). |
| Same file | `Legacy "actors"` → **throws** (good). `@label` skipped (not a compat layer). | Keep throw; no “support old shape”. |
| [`libs/maia-seed/tests/derive-inbox.test.js`](libs/maia-seed/tests/derive-inbox.test.js) | Test string contains `legacy` as a **path segment** only. | No change. |
| [`libs/maia-db/src/migrations/seeding`](libs/maia-db/src/migrations/seeding) | No `legacy`/`fallback` hits. | — |
| [`services/sync/src/index.js`](services/sync/src/index.js) | No seed `fallback`/`legacy` hits. | — |
| [`scripts/fix-seed-config-imports.mjs`](scripts/fix-seed-config-imports.mjs) | Points at **obsolete** `libs/maia-actors/src/maia/seed-config.js` (seed moved to `@MaiaOS/seed`). Dead / misleading tooling. | **Delete** script or replace with generator that targets the new path — **no** half-updated helper. |

**Gap vs spark-registry plan:** the **glob + path-keyed registry** work does **not** automatically fix `ref-transform`; treat **explicit transformer contract** as a **required** sub-milestone so “no fallbacks” is true end-to-end.

## Migration (single cut, no shims)

- **Delete** [`vibe-registries.index.js`](libs/maia-universe/src/maia/vibe-registries.index.js) — **no** re-export shim; wire [`package.json`](libs/maia-universe/package.json) exports straight to the new module(s).
- Collapse [`seed-config.js`](libs/maia-seed/src/seed-config.js) bulk imports: data comes from **`@MaiaOS/universe/registry`** merged shape + path-derived composition only.
- **Delete** [`data/index.js`](libs/maia-universe/src/maia/data/index.js) manual barrel if superseded by generated registry — **no** parallel barrel.

## TDD

- Tests for **key function**: same path → same key; different paths → different keys; collision detection.
- Tests on **merge** (spark order, dedupe, collision across sparks).
- Golden / snapshot for **generated** output shape after migration (maia-seed invariants).
- Tests that **transform** paths never hit a “default” branch: invalid / ambiguous input **throws** with a clear message (no silent instance transform).

## Success criteria

- **One** import path for seed: `@MaiaOS/universe/registry`.
- **Per-spark** ownership: add a folder + one `registry.js`, wire into merge (manually or generated).
- CI: generator + diff check if using generated aggregator.
- **No** remaining heuristic fallbacks in seed transform; **no** dead scripts pointing at old paths; **no** dual registry sources.

## Todos (aligned)

1. Specify **path→key** rule (relative root, normalization) and document in generator only.
2. Implement **generator** (recursive glob, path keys, collision checks, committed output).
3. Add spark roots + root **`src/registry.js`** re-export; **package.json** `"./registry"`.
4. Migrate **maia-seed** to single `@MaiaOS/universe/registry` import; remove hardcoded maps.
5. **`universe:registry:watch`** + CI **generate + diff** gate.
6. **Refactor `transformForSeeding`** (explicit schema vs instance, remove default/fallback branches) + update **maia-db** call sites; **delete** obsolete `fix-seed-config-imports.mjs` or replace with generator.
