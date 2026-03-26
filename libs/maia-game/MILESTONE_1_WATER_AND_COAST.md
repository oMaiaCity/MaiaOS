# Milestone 1 — Water surface and coast

## Phase 1 (done): Unified gravity-consistent water

- **Single sea level** — `seaLevel` in [`src/water-surface.js`](src/water-surface.js) is `riverBedElevationFlow` at the downstream mouth on the centerline (`wx = FLOW_DNX * FLOW_SPAN * 0.9`, `wy = riverCenterY(wx)`) plus `WATER_DEPTH`. The old `floodWaterLevel()` average of upstream and downstream endpoints is removed.
- **`waterSurfaceHeightAt(wx, wy)`** — In the river corridor: centerline bed + `WATER_DEPTH`. Elsewhere: flat `seaLevel`. Tinting, movement blocking, trees, and the ocean plane mesh all use this one rule.
- **River shape** — Steeper bed (`RIVER_ELEV_*`, gravity ease-out along active reach). Spring width uses `SPRING_WIDTH_RATIO = 1/4` in the first segment of active flow; center/south keep full nominal width. **`RIVER_FLOW_T_MIN`** — no carve or water upstream of this flow progress, so the channel begins **inland** (mountains) rather than on the square map edge.
- **Water ribbon/volume** — Meshes sample **uniform flow progress** `t` and resolve `wx` with `centerlineWxForFlowT` (see [`src/river.js`](src/river.js)). They must **not** sweep uniform world `wx` alone: flow is diagonal, so an X-sweep pinned the visible start to a map edge and hid the narrow spring.
- **`isRiverCorridor`** — Lives in [`src/river.js`](src/river.js) with corridor geometry; re-exported from [`src/biomes.js`](src/biomes.js) for callers that already imported it there.

## Phase 2 (planned): Island shoreline extension

- Enlarge `PLANE_SIZE` (e.g. 2×), preserve legacy terrain in `CORE_PRESERVE_HALF`, coastal mask + blend in [`src/terrain.js`](src/terrain.js).
- Decouple river flow span and sea reference from mesh size via `RIVER_REFERENCE_HALF` so the playable core matches today when the plane grows.

See the island coastline plan in the repo `.cursor/plans/` for full detail.

## Rendering

Vanilla Three.js: one transparent flood plane at `seaLevel`, river ribbon and volume unchanged; follow disposal and material patterns from the Three.js skill when extending meshes or shaders.
