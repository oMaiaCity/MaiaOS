/**
 * Third-person chase: distance and height from view pitch; min clearance above local terrain.
 */
import * as THREE from 'three'
import { EYE_HEIGHT } from './game-constants.js'

const CHASE_R_BASE = 42
const CHASE_H_BASE = EYE_HEIGHT * 0.48
const CHASE_R_MULT_MAX = 10
const CHASE_H_EXTRA_MAX = 220
const CHASE_PITCH_DOWN_FULL = 0.88
const CHASE_MIN_ABOVE_TERRAIN = EYE_HEIGHT * 1.1

/** 0 at level look, 1 at `CHASE_PITCH_DOWN_FULL` downward pitch (smoothstep). */
function chaseTiltT(pitchUpRad) {
	const pitchDown = Math.max(0, -pitchUpRad)
	const raw = THREE.MathUtils.clamp(pitchDown / CHASE_PITCH_DOWN_FULL, 0, 1)
	return raw * raw * (3 - 2 * raw)
}

export function chaseHorizontalDistance(pitchUpRad) {
	const t = chaseTiltT(pitchUpRad)
	return CHASE_R_BASE * (1 + t * (CHASE_R_MULT_MAX - 1))
}

export function chaseHeightAbovePlayer(pitchUpRad) {
	const t = chaseTiltT(pitchUpRad)
	return CHASE_H_BASE + t * CHASE_H_EXTRA_MAX
}

/** Below this camera–blob distance, WASD uses ~`MOVE_SCALE_AT_CLOSE` of base speed. */
const MOVE_SCALE_DIST_NEAR = 140
/** From here upward, WASD uses full `MOVE_SPEED`. */
const MOVE_SCALE_DIST_FAR = 1680
/** At/below near distance: 8× slower than baseline (within 5–8× range). */
const MOVE_SCALE_AT_CLOSE = 1 / 8

/**
 * Multiplier for horizontal move speed from camera distance to blob (world units).
 * Close = slow (fine control); far = full speed.
 */
export function moveSpeedScaleFromCameraBlobDist(dist) {
	const t = THREE.MathUtils.smoothstep(dist, MOVE_SCALE_DIST_NEAR, MOVE_SCALE_DIST_FAR)
	return MOVE_SCALE_AT_CLOSE + t * (1 - MOVE_SCALE_AT_CLOSE)
}

export { CHASE_MIN_ABOVE_TERRAIN }
