# Single `maia/registry.js` + recursive spark discovery

## Corrections from prior implementation

- **No** [`maia/generated/`](libs/maia-universe/src/maia/generated/) — one generated file: [`libs/maia-universe/src/maia/registry.js`](libs/maia-universe/src/maia/registry.js).
- **No** separate hardcoded generator roots like “only `actors/`”, “only `data/`”, “only `vibes/**/registry.js`” as **three independent** scans that encode folder names in code.

## Intent (refined)

### Recursive auto-discovery under the spark

- **Spark root** (today): `libs/maia-universe/src/maia/`.
- **Discover** all `**/*.maia` files under that root **recursively** (includes [`maia/factories/`](libs/maia-universe/src/maia/factories), [`maia/data/`](libs/maia-universe/src/maia/data), [`maia/vibes/`](libs/maia-universe/src/maia/vibes), [`maia/actors/`](libs/maia-universe/src/maia/actors), and **any future subfolder** without changing the generator’s folder list).
- **Discover** all `**/registry.js` under the same spark root (vibe / intent registry entrypoints), not limited to `vibes/**` if you add e.g. `brand/registry.js` later.
- **Do not** maintain parallel “registry index” files by hand ([`dashboard-icon-svgs.js`](libs/maia-universe/src/maia/dashboard-icon-svgs.js) goes away; icon SVGs derived from glob under e.g. `**/data/icons/*.maia` or any agreed subtree — still **one glob family**, not a fixed list of import lines).

### `icons.data.maia` vs per-vibe icon files

- **Today:** [`icons.data.maia`](libs/maia-universe/src/maia/data/icons.data.maia) only lists `dashboardVibeKeys`; actual SVG strings live in **`vibes/data/icons/*.maia`** and are wired via [`dashboard-icon-svgs.js`](libs/maia-universe/src/maia/dashboard-icon-svgs.js).
- **Preferred for “icons data” as the single seed truth:** the **dashboard icon cotext payload** (per vibe key → SVG string or structured cotext-ready shape) should be **authored in or derived from `icons.data.maia`**, not split across keys-in-one-file and SVG-in-nine-files without a manifest link.
- **Options (pick one when implementing):**
  - **Inline:** embed per-key `svg` (or `cotext`) inside `icons.data.maia` — one file, no separate icon `.maia` per vibe (file may be large).
  - **Manifest:** `icons.data.maia` holds keys **and** stable relative paths to each icon’s `.maia` under the spark; generator resolves paths → **no** hand `ICON_SVG_BY_KEY` table.
  - **Keep split files** only if `icons.data.maia` explicitly references them (path keys) so discovery is still data-driven.

### One standardized namekey / path key (end-to-end)

- **Single canonical key function** (one module, used by generator output and referenced from [`@MaiaOS/seed`](libs/maia-seed) docs/code): e.g. `posixPathRelativeToSparkRoot` with stable normalization (lowercase? no — keep case as on disk for °maia paths; document once).
- **SEED_DATA** bucket keys: derive from `*.data.maia` basename (e.g. `icons.data.maia` → `icons`) — rule lives **only** in the generator + tests, not duplicated in maia-seed.
- **Actor annotate map**: keys remain the **actors-relative** segment if that is what seeding already expects (`os/ai/actor.maia`), **or** unify to **full path from spark** (`actors/os/ai/actor.maia`) — pick **one** and migrate [`seed-config.js`](libs/maia-seed/src/seed-config.js) in the same change (no dual conventions).

### Package boundaries

- [`libs/maia-universe/src`](libs/maia-universe/src): emits **one** [`maia/registry.js`](libs/maia-universe/src/maia/registry.js) + thin [`src/registry.js`](libs/maia-universe/src/registry.js) re-export.
- [`libs/maia-seed`](libs/maia-seed): imports registry surface from `@MaiaOS/universe/registry` only; composition lists use **only** canonical keys from the same rules (no second key scheme).

## Generator algorithm (conceptual)

1. `Glob('**/*.maia', { cwd: sparkRoot })` → sorted list of relative paths.
2. **Partition** for **emitted exports** using **path/filename rules** (not hardcoded top-level folder names in code):
   - `**/actors/**/*.maia` → `annotateMaiaByActorsPath` (or rename to `annotateMaiaByPath` if unified).
   - `data/*.data.maia` → `SEED_DATA` keys (basename rule).
   - `**/vibes/data/icons/*.maia` (or `**/data/icons/*.maia`) → `ICON_SVG_BY_KEY` / `DEFAULT_CARD_ICON_SVG`.
   - Other `.maia` under `factories/` etc. → include in a **single** `maiaFilesBySparkPath` map **or** fold into annotate map if they share the same consumer — **avoid** orphan files; if a file matches no partition, **fail** with a clear error (no silent skip).
3. `Glob('**/registry.js', { cwd: sparkRoot })` → vibe registry modules; parse `export const` as today.
4. Emit **one** `registry.js` file with deterministic section order + banner.

## CI

- [`scripts/check-universe-registry.mjs`](scripts/check-universe-registry.mjs): `git diff` on `libs/maia-universe/src/maia/registry.js` only.

## Tests

- [`libs/maia-universe/tests/registry.test.js`](libs/maia-universe/tests/registry.test.js): discovery invariants (counts, known paths), key normalization, **unknown .maia** placement rules (error or bucket).
- Keep maia-seed / db tests green after key unification.

## Todos

1. Refactor generator: single output `maia/registry.js`, recursive `.maia` + `registry.js` discovery, partition rules, icons from glob; delete `maia/generated/` and hand [`dashboard-icon-svgs.js`](libs/maia-universe/src/maia/dashboard-icon-svgs.js).
2. Unify path key scheme end-to-end; update [`seed-config.js`](libs/maia-seed/src/seed-config.js) and [`package.json`](libs/maia-universe/package.json) exports.
3. Rewire [`src/registry.js`](libs/maia-universe/src/registry.js), [`maia/index.js`](libs/maia-universe/src/maia/index.js), CI, tests.
4. `bun run check:ci` + workspace tests.
