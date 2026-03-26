/**
 * Procedural heightfield: warp, sharpen, continent + ridged peaks + river carve.
 */
import { EDGE_MARGIN, PLANE_HALF } from './game-constants.js'
import { terrainPlaneWarp } from './plane-warp.js'
import {
	applyRiverTerrainCarve,
	FLOW_DN_X,
	FLOW_DN_Y,
	isRiverCorridor,
	riverCenterlinePointAtS,
	riverHalfWidth,
	sAlongRiver,
} from './river.js'
import { rawLandHeightFromWarp } from './terrain-raw.js'
import { seaLevel } from './water-surface.js'

/** World units: dry land (outside carved channel) stays above local water surface — stops low-tn sand “lakes”. */
const LAND_MIN_ABOVE_WATER_SURFACE = 3

export { terrainPlaneWarp }

/**
 * Single height for mesh + texture: continents, ridged peaks, deep valleys, high-freq roughness.
 * @param {number} lx
 * @param {number} ly
 */
export function terrainHeightAtPlaneXY(lx, ly) {
	const { wx, wy } = terrainPlaneWarp(lx, ly)

	const terrainH = rawLandHeightFromWarp(wx, wy)
	const { h, inRiverCorridor } = applyRiverTerrainCarve(wx, wy, terrainH)
	if (!inRiverCorridor) {
		return Math.max(h, seaLevel() + LAND_MIN_ABOVE_WATER_SURFACE)
	}
	return h
}

/** Minimum distance from origin so spawn is not at map center. */
const SPAWN_RING_MIN_R = 900

/**
 * Pick a high-elevation point on a ring away from center (ridge / peak sample grid).
 * `playerZ` matches mount convention: terrain uses `ly = -playerZ`.
 * @returns {{ playerX: number, playerZ: number }}
 */
export function findMountainTopSpawnPosition() {
	const lim = PLANE_HALF - EDGE_MARGIN
	const radii = [1100, 1500, 1900, 2300, 2700, 3100, 3500]
	const angles = 48
	let bestH = -Infinity
	let bestLx = 0
	let bestLy = 0
	for (const r of radii) {
		if (r < SPAWN_RING_MIN_R || r > lim) continue
		for (let i = 0; i < angles; i++) {
			const a = (i / angles) * Math.PI * 2
			const lx = Math.cos(a) * r
			const ly = Math.sin(a) * r
			if (Math.abs(lx) > lim || Math.abs(ly) > lim) continue
			const h = terrainHeightAtPlaneXY(lx, ly)
			if (h > bestH) {
				bestH = h
				bestLx = lx
				bestLy = ly
			}
		}
	}
	return { playerX: bestLx, playerZ: -bestLy }
}

const EARTH_TN_MIN = 0.34
const EARTH_TN_MAX = 0.62
const OPP_BANK_FLOW_STEPS = 9
const OPP_BANK_FLOW_STEP_PLANE = 185

/**
 * Fixed-point iteration: find plane (lx, ly) whose warped coords approach a target (wx, wy).
 */
function convergePlaneToWarpTarget(wxTarget, wyTarget, lxSeed, lySeed) {
	let lx = lxSeed
	let ly = lySeed
	for (let i = 0; i < 28; i++) {
		const w = terrainPlaneWarp(lx, ly)
		const ex = wxTarget - w.wx
		const ey = wyTarget - w.wy
		if (ex * ex + ey * ey < 9) {
			break
		}
		lx += ex
		ly += ey
	}
	return { lx, ly }
}

/**
 * Suggest plane coordinates for a second dome on the opposite river bank, dry land, earth height band.
 * @param {number} lxRef — plane X matching primary dome centerX
 * @param {number} lyRef — plane Y matching -primaryDomeCenterZ
 * @param {number} vHMin
 * @param {number} vHSpan
 * @returns {{ lx: number, ly: number } | null}
 */
export function suggestOppositeBankDomePlaneXY(lxRef, lyRef, vHMin, vHSpan) {
	const w0 = terrainPlaneWarp(lxRef, lyRef)
	const s0 = sAlongRiver(w0.wx, w0.wy).sNorm
	const p0 = riverCenterlinePointAtS(s0)
	const cy = p0.wy
	let lat = w0.wy - cy
	if (Math.abs(lat) < 8) {
		lat = 220
	}
	const hw = riverHalfWidth(w0.wx, w0.wy)
	const bankPush = hw + 310
	const targetLat = -lat - Math.sign(lat) * bankPush
	const wxTarget = w0.wx
	const wyTarget = cy + targetLat

	const flowLen = Math.hypot(FLOW_DN_X, FLOW_DN_Y) || 1
	const plx = (FLOW_DN_X / flowLen) * OPP_BANK_FLOW_STEP_PLANE
	const ply = (FLOW_DN_Y / flowLen) * OPP_BANK_FLOW_STEP_PLANE

	const lim = PLANE_HALF - EDGE_MARGIN

	for (let s = -OPP_BANK_FLOW_STEPS; s <= OPP_BANK_FLOW_STEPS; s++) {
		const lxSeed = wxTarget + plx * s
		const lySeed = wyTarget + ply * s
		const { lx, ly } = convergePlaneToWarpTarget(wxTarget, wyTarget, lxSeed, lySeed)
		if (Math.abs(lx) > lim || Math.abs(ly) > lim) {
			continue
		}
		const { wx: wxP, wy: wyP } = terrainPlaneWarp(lx, ly)
		if (isRiverCorridor(wxP, wyP)) {
			continue
		}
		const h = terrainHeightAtPlaneXY(lx, ly)
		const tn = vHSpan > 1e-5 ? (h - vHMin) / vHSpan : 0.5
		if (tn < EARTH_TN_MIN || tn > EARTH_TN_MAX) {
			continue
		}
		return { lx, ly }
	}

	return null
}
