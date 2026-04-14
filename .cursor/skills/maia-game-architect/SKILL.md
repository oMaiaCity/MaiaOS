---
name: maia-game-architecture
description: >-
  MaiaOS 3D city game architecture: how services/app hosts @MaiaOS/game (Three.js),
  dependency chain, and which files own terrain, dome, water, trees, and mounting.
  Use when navigating or changing the game, debugging load/mount, or planning 3D work.
  Pair with the three-js skill for API-level Three.js details (vanilla imperative JS).
---

# Maia Game — Architecture Overview

The **game** is a **vanilla Three.js** SPA screen (`the-game`), implemented in **`libs/maia-game`** and **mounted only when that screen is shown** by **`services/app`**. It is **not** React Three Fiber; scene graph and loop live in plain JS modules.

**Related skills**

- **`.cursor/skills/three-js`** — Three.js APIs (scene, materials, loaders, shaders, performance). Use it when implementing or changing rendering behavior; this skill explains **where** code lives in MaiaOS, not every Three.js call.
- **`maia-game-architect` (this file)** — repo layout, wiring, and file responsibilities.

---

## Dependency chain

```
services/app (@MaiaOS/app)
  └── @MaiaOS/game  (workspace:*)
        └── three  (^0.170.x) — only runtime dependency of the game library
```

The app also depends on `@MaiaOS/runtime`, `@MaiaOS/maia-distros` for the rest of the SPA (sync, bundles). The AI chat shell is in-app (`maia-ai-global.js`). Those are **orthogonal** to the game except they share the same HTML shell and navigation.

---

## How the app hosts the game (`services/app`)

| Concern | File(s) | Role |
|--------|---------|------|
| **Screen id** | `main.js`, `dashboard.js` | Dashboard card uses `navigateToScreen('the-game')`. |
| **When to mount** | `db-view.js` | On `currentScreen === 'the-game'`, calls `renderGame()`; otherwise `disposeGame()`. Toggles `body.screen-the-game` for CSS (e.g. nav visibility in `css/maia-ai.css`). |
| **Dynamic load + mount** | `maia-game-mount.js` | `import('@MaiaOS/game')` only after entering The Game (code-split). Decodes loading-screen image in parallel, injects shell HTML, then `mountGame(container, { isCancelled })`. Tracks dispose and session token so navigation away cancels in-flight terrain build. |
| **Assets in dev** | `dev-server.js` | Serves `libs/maia-game/src/assets/*` (e.g. `geodesic-dome.glb`). |
| **Assets in build** | `build.js` | Copies `libs/maia-game/src/assets` into the app bundle output. |

**Flow (short):** user opens **The Game** → `renderGame()` → splash + `import('@MaiaOS/game')` → `mountGame` on `#game-container` → loading overlay removed → full-screen WebGL.

---

## Game library layout (`libs/maia-game`)

**Public API:** `src/index.js` exports **`mountGame(container, options)`** → `{ dispose }`.

| File | Responsibility |
|------|----------------|
| **`src/index.js`** | Main integration: `THREE.Scene`, `WebGLRenderer`, `PointerLockControls`, terrain mesh build loop, animation loop, resize, raycast for dome placement, cleanup `dispose`. Imports almost all feature modules below. |
| **`src/game-constants.js`** | World size (`PLANE_*`), move speed, zoom limits, margins. |
| **`src/terrain.js`** | Heightfield math, warp, `terrainHeightAtPlaneXY`, spawn `findMountainTopSpawnPosition`. |
| **`src/terrain-height-worker.mjs`** | Worker: offloads height batches for plane vertices (optional; falls back to main thread). |
| **`src/biomes.js`** | Vertex coloring: height biomes, grass sub-biomes, river corridor, underwater tint, flood level, dome garden turf blend. |
| **`src/noise.js`** | Procedural noise for micro-variation on terrain tint. |
| **`src/river.js`** | River centerline, width, bed elevation, carve blend (`riverTerrainBlend` in `terrain.js`), used by **`biomes.js`** and **`water-meshes.js`**. |
| **`src/water-meshes.js`** | River water surface + volume meshes and materials (time uniform for animation). |
| **`src/trees.js`** | Instanced forest meshes + disposal. |
| **`src/geodesic-dome.js`** | Loads **`src/assets/geodesic-dome.glb`** (via `load-gltf.js`), builds group, door alignment constant `DOME_BAKED_ENTRANCE_ATAN2`. |
| **`src/load-gltf.js`** | GLTF loading helper for the dome asset. |
| **`src/dome-placement.js`**, **`src/dome-garden.js`**, **`src/dome-selection-tint.js`** | Dome rim height sampling, interior garden props, highlight when moving dome. |
| **`src/blob-character.js`** | Simple player “blob” mesh following terrain + camera-facing yaw. |
| **`src/camera-chase.js`** | Chase camera distance/height from pitch and blob–camera distance (speed scaling). |
| **`scripts/*.mjs`** | Tooling: dome generation / Blender import (not runtime). |

**Assets:** `src/assets/` — at minimum **`geodesic-dome.glb`** (see `package.json` scripts `import:dome` / `generate:dome`).

---

## Mental model

1. **App** = router + shell; **game** = one library entrypoint (`mountGame`).
2. **All 3D** is **Three.js** in **`libs/maia-game`**; **no** game logic inside `services/app` beyond mount/dispose and asset paths.
3. For **how** to write Three.js (buffers, lights, shaders), use **`.cursor/skills/three-js`**; for **where** to edit Maia city behavior, start with **`src/index.js`** and the table above.
