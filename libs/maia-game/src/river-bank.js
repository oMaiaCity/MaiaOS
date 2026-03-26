/**
 * River bank classification in warped plane space (matches terrain / river carve).
 */
import { closestPointOnRiverPolyline, riverHalfWidth, riverTangentAtS } from './river.js'
import { terrainPlaneWarp } from './terrain.js'

/** Must match river carve feather in `river.js` — stay past this to be on dry bank. */
const RIVER_FEATHER_OUTER = 118
/** Extra clearance so dome rim sits on sand, not in water mesh. */
const DOME_BANK_CLEARANCE = 620

/**
 * @param {number} lx — plane X (world X)
 * @param {number} ly — plane Y (world −Z)
 * @returns {0 | 1} arbitrary stable label for “which bank”
 */
export function bankIdFromPlaneXY(lx, ly) {
	const { wx, wy } = terrainPlaneWarp(lx, ly)
	const c = closestPointOnRiverPolyline(wx, wy)
	const { tx, ty } = riverTangentAtS(c.sNorm)
	const rx = wx - c.px
	const ry = wy - c.py
	const cross = rx * ty - ry * tx
	return cross >= 0 ? 0 : 1
}

/**
 * Find a plane point on the opposite bank from `(lx, ly)` by stepping along `ly`.
 * Requires distance from river centerline ≥ corridor half-width + feather + clearance
 * so the dome sits on dry sand, not in the water volume (first sign-flip alone can be mid-channel).
 * @param {number} lx
 * @param {number} ly
 * @returns {{ lx: number, ly: number }}
 */
export function oppositeBankPlaneXY(lx, ly) {
	const { wx, wy } = terrainPlaneWarp(lx, ly)
	const c0 = closestPointOnRiverPolyline(wx, wy)
	const startSign = Math.sign(wy - c0.py) || 1
	for (let d = 400; d <= 12000; d += 200) {
		for (const s of [-1, 1]) {
			const ly2 = ly + s * d
			const w = terrainPlaneWarp(lx, ly2)
			const c2 = closestPointOnRiverPolyline(w.wx, w.wy)
			const hw = riverHalfWidth(w.wx, w.wy)
			const dist = c2.dist
			const minDry = hw + RIVER_FEATHER_OUTER + DOME_BANK_CLEARANCE
			const newSign = Math.sign(w.wy - c2.py) || 1
			if (newSign !== startSign && dist >= minDry) {
				return { lx, ly: ly2 }
			}
		}
	}
	return { lx, ly: ly + 4000 }
}

/** World XZ radius (meters) — dome ~92; sample full rim in world space (warp makes plane circles wrong). */
const ORE_DOME_WORLD_FOOTPRINT_R = 102

/**
 * True when warped point is far enough from the river centerline to be on dry bank
 * (matches carve + feather + margin used for opposite-bank search).
 * @param {number} wx
 * @param {number} wy
 */
function warpedPointDryEnough(wx, wy) {
	const c = closestPointOnRiverPolyline(wx, wy)
	const hw = riverHalfWidth(wx, wy)
	return c.dist >= hw + RIVER_FEATHER_OUTER + DOME_BANK_CLEARANCE
}

/**
 * @param {number} cx — world X
 * @param {number} cz — world Z
 * @param {number} worldR
 */
function domeFootprintDryWorld(cx, cz, worldR) {
	const samples = 12
	for (let i = 0; i < samples; i++) {
		const a = (i / samples) * Math.PI * 2
		const px = cx + Math.cos(a) * worldR
		const pz = cz + Math.sin(a) * worldR
		const w = terrainPlaneWarp(px, -pz)
		if (!warpedPointDryEnough(w.wx, w.wy)) {
			return false
		}
	}
	const wC = terrainPlaneWarp(cx, -cz)
	return warpedPointDryEnough(wC.wx, wC.wy)
}

/**
 * Opposite-bank seed, then search in world XZ until the full dome footprint clears the river.
 * @param {number} woodLx
 * @param {number} woodLy
 * @param {number} [worldR]
 * @returns {{ lx: number, ly: number }}
 */
export function oreDomePlaneXYDry(woodLx, woodLy, worldR = ORE_DOME_WORLD_FOOTPRINT_R) {
	const seed = oppositeBankPlaneXY(woodLx, woodLy)
	const cx = seed.lx
	const cz = -seed.ly
	if (domeFootprintDryWorld(cx, cz, worldR)) {
		return { lx: cx, ly: -cz }
	}
	for (let d = 200; d <= 16000; d += 200) {
		for (const s of [-1, 1]) {
			const cx2 = cx + s * d
			if (domeFootprintDryWorld(cx2, cz, worldR)) {
				return { lx: cx2, ly: -cz }
			}
			const cz2 = cz + s * d
			if (domeFootprintDryWorld(cx, cz2, worldR)) {
				return { lx: cx, ly: -cz2 }
			}
			const cx3 = cx + s * d
			const cz3 = cz + s * d
			if (domeFootprintDryWorld(cx3, cz3, worldR)) {
				return { lx: cx3, ly: -cz3 }
			}
		}
	}
	return { lx: seed.lx, ly: seed.ly }
}
