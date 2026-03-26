/** Shared layout / movement / zoom (used by mount, camera, input). */

export const PLANE_SIZE = 8000
export const PLANE_HALF = PLANE_SIZE / 2
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
