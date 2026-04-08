/** Shared layout / movement / zoom (used by mount, camera, input). */

/** Core island half-extent (playable square). Terrain is authoritative inside this box. */
export const CORE_PRESERVE_HALF = 4000
/** World mesh / player bounds half-extent (ocean ring around core). */
export const WORLD_PLANE_HALF = CORE_PRESERVE_HALF * 2
/** Full terrain / flood plane size (world). */
export const PLANE_SIZE = WORLD_PLANE_HALF * 2
/** Same as `WORLD_PLANE_HALF` — mesh half-extent and movement clamp. */
export const PLANE_HALF = WORLD_PLANE_HALF
/** River flow length scale — decoupled from world size (aligned to core half-extent). */
export const RIVER_REFERENCE_HALF = CORE_PRESERVE_HALF
/** Downstream mouth / shore in plane space (world X = lx, Z = -ly). */
export const RIVER_END_PLANE_LX = 3024
export const RIVER_END_PLANE_LY = -2280
/** Corridor half-width at spring (narrow) and at mouth (wide). */
export const RIVER_HALF_WIDTH_START = 310
export const RIVER_HALF_WIDTH_END = 1280
/** Perpendicular meander amplitude in warped plane units (scaled inside river.js). */
export const RIVER_MEANDER_AMP = 480
/** Minimum plane distance spring → end so the path stays meaningful. */
export const RIVER_MIN_CHORD_TO_END_PLANE = 2100
/** Polyline resolution for arc-length and bed samples. */
/** Lower count = faster terrain (closest-point per vertex); 128 is enough for smooth river. */
export const RIVER_POLY_SEGMENTS = 128
export const EDGE_MARGIN = 8
export const MOVE_SPEED = 2800
/** Seconds to ramp WASD speed up when input is active (ease-in). */
export const MOVE_ACCEL_TAU = 0.14
/** Seconds to ramp WASD speed down when input stops (ease-out). */
export const MOVE_DECEL_TAU = 0.22
/** Seconds for wheel zoom height to follow its target (ease-in/out). */
export const ZOOM_SMOOTH_TAU = 0.1
export const EYE_HEIGHT = 2.2
/** World scale for lathe blob (~2× previous size on ground). */
export const BLOB_GROUND_SCALE = 3.8

export const ZOOM_ABOVE_MIN = 0
export const ZOOM_ABOVE_MAX = 1960
export const ZOOM_WHEEL_SCALE = 0.17
