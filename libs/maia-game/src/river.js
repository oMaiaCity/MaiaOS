/**
 * River corridor in warped plane (wx, wy): centerline, width, bed elevation, channel height for carve.
 */
import * as THREE from 'three'
import { PLANE_HALF } from './game-constants.js'
import { fbm2 } from './noise.js'

const RIVER_WOBBLE_X = 0.00195
const RIVER_WOBBLE_AMP = 560
const RIVER_HALF_WIDTH_BASE = 1300
const RIVER_WIDTH_NOISE = 600
/** Rim height above bed inside the corridor (U cross-section); keep modest to avoid canal walls). */
const RIVER_BANK_HEIGHT = 105
/** Jagged corridor edge: high-frequency width noise amplitude. */
const RIVER_ROUGH_AMP = 120
/** Bed elevation at upstream corner in flow projection (lowered vs terrain so channel cuts in, not perches). */
const RIVER_ELEV_UPSTREAM = -120
/** Bed elevation at downstream corner. Same total drop as before, shifted down. */
const RIVER_ELEV_DOWNSTREAM = -520
/** Unit downstream in warped plane — same axis for bed, carve, and water (top-left → bottom-right). */
export const FLOW_DN_X = 0.6
export const FLOW_DN_Y = -0.8
/** Fraction of half-width (0–1) with flat bed — U floor. */
const RIVER_BED_FLAT_FRAC = 0.34
/** First bank segment [0, v1] completes this fraction of total rim rise. */
const RIVER_BANK_KNEE = 0.5
const RIVER_BANK_FIRST_DROP = 0.58
/** Water column height from bed to surface (surface = bed + WATER_DEPTH). */
export const WATER_DEPTH = 78
export const WATER_FLOW_SPEED = 0.06
export const WATER_SEGMENTS = 112

export { RIVER_BED_FLAT_FRAC }

export function riverCenterY(wx) {
	return Math.sin(wx * RIVER_WOBBLE_X) * RIVER_WOBBLE_AMP + fbm2(wx * 0.00058 + 1.12, 2.9) * 220
}

export function riverHalfWidth(wx, wy) {
	const w1 = fbm2(wx * 0.00145, wy * 0.00142)
	const w2 = fbm2(wx * 0.0042, wy * 0.004)
	const rough = fbm2(wx * 0.025, wy * 0.024) * RIVER_ROUGH_AMP
	return RIVER_HALF_WIDTH_BASE + w1 * RIVER_WIDTH_NOISE + w2 * (RIVER_WIDTH_NOISE * 0.45) + rough
}

/**
 * River bed height from planar flow in (wx, wy): strict downhill along FLOW_DN (not raw wx),
 * so a winding channel still sits on one continuous elevation field; subtractive ripple only.
 */
export function riverBedElevationFlow(wx, wy) {
	const len = Math.hypot(FLOW_DN_X, FLOW_DN_Y)
	const dnx = FLOW_DN_X / len
	const dny = FLOW_DN_Y / len
	const dot = wx * dnx + wy * dny
	const span = PLANE_HALF * (Math.abs(dnx) + Math.abs(dny))
	const t = THREE.MathUtils.clamp((dot + span) / (2 * span), 0, 1)
	const linear = THREE.MathUtils.lerp(RIVER_ELEV_UPSTREAM, RIVER_ELEV_DOWNSTREAM, t)
	const ripple =
		16 * (0.5 + 0.5 * Math.sin(wx * 0.0004 + wy * 0.00012)) +
		12 * (0.5 + 0.5 * Math.sin(wx * 0.00022 + wy * 0.00018 + 1.1))
	return linear - ripple
}

function smoothRange(t, a, b) {
	const x = THREE.MathUtils.clamp((t - a) / Math.max(b - a, 1e-6), 0, 1)
	return x * x * (3 - 2 * x)
}

/** U cross-section: 0 at centerline bed, RIVER_BANK_HEIGHT at corridor edge. */
function bankRiseFromCenter(u) {
	if (u <= RIVER_BED_FLAT_FRAC) {
		return 0
	}
	const v = (u - RIVER_BED_FLAT_FRAC) / (1 - RIVER_BED_FLAT_FRAC)
	if (v <= RIVER_BANK_KNEE) {
		const tt = smoothRange(v, 0, RIVER_BANK_KNEE)
		return tt * RIVER_BANK_FIRST_DROP * RIVER_BANK_HEIGHT
	}
	const tt = smoothRange(v, RIVER_BANK_KNEE, 1)
	const lo = RIVER_BANK_FIRST_DROP * RIVER_BANK_HEIGHT
	return lo + tt * (RIVER_BANK_HEIGHT - lo)
}

/**
 * Absolute channel surface height inside the river corridor; Infinity outside (no carve).
 */
export function riverChannelHeight(wx, wy) {
	const cy = riverCenterY(wx)
	const d = Math.abs(wy - cy)
	const hw = riverHalfWidth(wx, wy)
	if (d >= hw) {
		return Infinity
	}
	const u = d / hw
	return riverBedElevationFlow(wx, wy) + bankRiseFromCenter(u)
}
