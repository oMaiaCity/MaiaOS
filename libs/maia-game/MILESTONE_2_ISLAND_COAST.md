# Milestone 2 — Island shores, bays, and peninsulas

## World vs core vs river

- **`WORLD_PLANE_HALF`** / **`PLANE_HALF`** — Half-extent of the terrain mesh and player movement (`8000` → `PLANE_SIZE` 16000).
- **`CORE_PRESERVE_HALF`** — Original playable half-extent (`4000`). Inside `max(|lx|,|ly|) ≤ CORE_PRESERVE_HALF`, height uses the same pipeline as before the coast work (warp + raw + river carve + dry clamp).
- **`RIVER_REFERENCE_HALF`** — Flow length scale for `FLOW_SPAN`, spring search, and chord checks (`4000`). River geometry is unchanged when the world grows.

## Coastal ring

- Outside the core square, [`terrain.js`](src/terrain.js) blends from core height toward sub–sea-level ocean floor over the annulus `CORE_PRESERVE_HALF … WORLD_PLANE_HALF`.
- **Compressed transition** — Blend reaches full seabed over only a **fraction** of the ring width (`COAST_TRANSITION_FRACTION`); the rest of the ring stays at ocean depth. A naïve linear blend across the whole ring left mid-ring terrain **above sea level** (dry tan “beach”), so the extended map did not read as ocean.
- **Organic shore** — The core/coast split no longer uses a plain `max(|lx|,|ly|)` square: `distanceIntoCoastalRingPlane` adds **`coastalShoreWarp(wx, wy)`** (multi-octave `fbm2` + azimuth terms) so bays and peninsulas follow a **wavy** boundary instead of straight diagonal edges.
- **Fine shore wiggle** — Extra `fbm2` on normalized distance for small variation along the shore. **Seabed roughness** adds subtle depth variation.

## Hydraulics

- **`seaLevel()`** / **`waterSurfaceHeightAt`** — Unchanged: one flat sea off-channel; river corridor unchanged.

## Rendering and gameplay

- Terrain and flood use **`PLANE_SIZE`** (world-sized).
- Dome placement and opposite-bank search stay inside **`CORE_PRESERVE_HALF`**.
- **Littoral tint** — [`littoralTerrainRgb`](src/biomes.js) warms low-elevation vertices near the core edge in the ring.
- **Trees** — [`canPlaceTree`](src/biomes.js) rejects sparse low-`tn` placements near the coastal transition when `lx`/`ly` are passed (see [`trees.js`](src/trees.js)).

## Follow-ups (optional)

- LOD or lower segment count in the outer ring if terrain cost grows.
- Shallow-water depth gradient on the flood plane or sand underwater.
