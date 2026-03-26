/**
 * River corridor: explicit start (high terrain) → meandering polyline → mouth at shore.
 * Bed follows raw terrain with monotone gravity envelope; width trends start→end with wobble.
 */
import * as THREE from 'three'
import {
	EDGE_MARGIN,
	PLANE_HALF,
	RIVER_END_PLANE_LX,
	RIVER_END_PLANE_LY,
	RIVER_HALF_WIDTH_END,
	RIVER_HALF_WIDTH_START,
	RIVER_MEANDER_AMP,
	RIVER_MIN_CHORD_TO_END_PLANE,
	RIVER_POLY_SEGMENTS,
} from './game-constants.js'
import { fbm2 } from './noise.js'
import { terrainPlaneWarp } from './plane-warp.js'
import { rawLandHeightFromWarp } from './terrain-raw.js'

/** Rim height above bed inside the corridor (U cross-section). */
const RIVER_BANK_HEIGHT = 105
/** Wider blend past corridor edge reduces stair-step canyon walls on the heightfield. */
const RIVER_FEATHER_OUTER = 118
/** Ease for gravity envelope along normalized path (steep early drop). */
const RIVER_BED_GRAVITY_EASE = 2.35
/** Clearance below raw terrain when following valley floor. */
const BED_CLEARANCE_BELOW_RAW = 12
/** Monotone step: bed must drop at least this per vertex (world units). */
const BED_MONOTONE_DROP_PER_VERTEX = 0.35
const RIVER_BED_FLAT_FRAC = 0.34
const RIVER_BANK_KNEE = 0.5
const RIVER_BANK_FIRST_DROP = 0.58

export const WATER_DEPTH = 78
/** Keeps the visible water surface below carved bank tops (freeboard). */
export const WATER_FREEBOARD_BELOW_BANK = 38
/** River surface height above bed (ribbon, physics, sea mouth). */
export const WATER_SURFACE_ABOVE_BED = WATER_DEPTH - WATER_FREEBOARD_BELOW_BANK
/** Ribbon / volume lateral extent as a fraction of corridor half-width (stay inside carved banks). */
export const WATER_MESH_HALF_WIDTH_SCALE = 0.68
export const WATER_FLOW_SPEED = 0.06
export const WATER_SEGMENTS = 112

/** Spring pocket carve depth (world units); fades with arc s and lateral distance. */
export const SPRING_WELL_DEPTH = 52
/** Normalized arc length: only s below this gets a pocket (head of the river). */
const SPRING_POCKET_S_NORM = 0.072

export { RIVER_BED_FLAT_FRAC }

/** Legacy flow axis (opposite-bank stepping); unit downstream in warped plane. */
export const FLOW_DN_X = 0.6
export const FLOW_DN_Y = -0.8
const FLOW_LEN = Math.hypot(FLOW_DN_X, FLOW_DN_Y)
export const FLOW_DNX = FLOW_DN_X / FLOW_LEN
export const FLOW_DNY = FLOW_DN_Y / FLOW_LEN
export const FLOW_SPAN = PLANE_HALF * (Math.abs(FLOW_DNX) + Math.abs(FLOW_DNY))

const N = RIVER_POLY_SEGMENTS
const margin = EDGE_MARGIN + 120

/** @type {Float64Array} */
let polyWx
/** @type {Float64Array} */
let polyWy
/** @type {Float64Array} */
let polyArcLen
let totalArcLen = 1
/** Monotone bed height at polyline vertices (same vertical space as terrain). */
/** @type {Float64Array} */
let polyBedZ
/** Expanded AABB for fast reject before polyline distance (terrain ~400k vertices). */
let queryAabbMinX = 0
let queryAabbMaxX = 0
let queryAabbMinY = 0
let queryAabbMaxY = 0

function smoothstep01(t) {
	const x = THREE.MathUtils.clamp(t, 0, 1)
	return x * x * (3 - 2 * x)
}

function smoothRange(t, a, b) {
	const x = THREE.MathUtils.clamp((t - a) / Math.max(b - a, 1e-6), 0, 1)
	return x * x * (3 - 2 * x)
}

/**
 * Pick warped start near maximum raw height with enough chord to mouth (plane space).
 * Tie-break: prefer points farther from end if heights are close (stable ridge picks).
 */
function computeRiverStartWarped() {
	const lim = PLANE_HALF - EDGE_MARGIN
	const endLx = RIVER_END_PLANE_LX
	const endLy = RIVER_END_PLANE_LY
	let bestH = -Infinity
	let bestLx = -2200
	let bestLy = 2600

	const radii = [1000, 1400, 1800, 2200, 2600, 3000, 3400, 3800]
	const angles = 72
	for (const r of radii) {
		if (r < 800 || r > lim) continue
		for (let i = 0; i < angles; i++) {
			const a = (i / angles) * Math.PI * 2
			const lx = Math.cos(a) * r
			const ly = Math.sin(a) * r
			if (Math.abs(lx) > lim || Math.abs(ly) > lim) continue
			const chord = Math.hypot(lx - endLx, ly - endLy)
			if (chord < RIVER_MIN_CHORD_TO_END_PLANE) continue
			const { wx, wy } = terrainPlaneWarp(lx, ly)
			const h = rawLandHeightFromWarp(wx, wy)
			if (h > bestH) {
				bestH = h
				bestLx = lx
				bestLy = ly
			}
		}
	}

	if (bestH === -Infinity) {
		for (let gx = -lim; gx <= lim; gx += 520) {
			for (let gy = -lim; gy <= lim; gy += 520) {
				const chord = Math.hypot(gx - endLx, gy - endLy)
				if (chord < RIVER_MIN_CHORD_TO_END_PLANE) continue
				const { wx, wy } = terrainPlaneWarp(gx, gy)
				const h = rawLandHeightFromWarp(wx, wy)
				if (h > bestH) {
					bestH = h
					bestLx = gx
					bestLy = gy
				}
			}
		}
	}

	return terrainPlaneWarp(bestLx, bestLy)
}

function meanderOffset01(u) {
	const m =
		fbm2(u * 6.15 + 0.41, 2.08) * 0.52 +
		fbm2(u * 13.8 + 1.02, 2.94) * 0.28 +
		Math.sin(u * Math.PI * 2 * 3.07 + 0.6) * 0.12 +
		Math.sin(u * Math.PI * 2 * 7.15) * 0.08
	return THREE.MathUtils.clamp(m, -1, 1)
}

/** Smallest t>0 where (wx,wy)+t*(dx,dy) hits the square border |x|<=lim, |y|<=lim from inside. */
function rayExitFromInsideSquare(wx, wy, dx, dy, lim) {
	let tMax = Infinity
	if (dx > 1e-9) {
		const t = (lim - wx) / dx
		if (t > 0) {
			const ny = wy + t * dy
			if (ny >= -lim && ny <= lim) {
				tMax = Math.min(tMax, t)
			}
		}
	}
	if (dx < -1e-9) {
		const t = (-lim - wx) / dx
		if (t > 0) {
			const ny = wy + t * dy
			if (ny >= -lim && ny <= lim) {
				tMax = Math.min(tMax, t)
			}
		}
	}
	if (dy > 1e-9) {
		const t = (lim - wy) / dy
		if (t > 0) {
			const nx = wx + t * dx
			if (nx >= -lim && nx <= lim) {
				tMax = Math.min(tMax, t)
			}
		}
	}
	if (dy < -1e-9) {
		const t = (-lim - wy) / dy
		if (t > 0) {
			const nx = wx + t * dx
			if (nx >= -lim && nx <= lim) {
				tMax = Math.min(tMax, t)
			}
		}
	}
	return tMax
}

/** Push mouth past RIVER_END_* so the channel reaches the map edge (full exit, not an inland bay). */
function mouthWarpedOnMapEdge(S) {
	const E0 = terrainPlaneWarp(RIVER_END_PLANE_LX, RIVER_END_PLANE_LY)
	const ddx = E0.wx - S.wx
	const ddy = E0.wy - S.wy
	const L = Math.hypot(ddx, ddy) || 1
	const ux = ddx / L
	const uy = ddy / L
	const lim = PLANE_HALF - margin
	const tExit = rayExitFromInsideSquare(S.wx, S.wy, ux, uy, lim)
	if (!Number.isFinite(tExit) || tExit <= 0) {
		return E0
	}
	return { wx: S.wx + ux * tExit, wy: S.wy + uy * tExit }
}

function buildPolyline() {
	const S = computeRiverStartWarped()
	const E = mouthWarpedOnMapEdge(S)
	const dx = E.wx - S.wx
	const dy = E.wy - S.wy
	const chordLen = Math.hypot(dx, dy) || 1
	const px = -dy / chordLen
	const py = dx / chordLen

	polyWx = new Float64Array(N)
	polyWy = new Float64Array(N)
	polyArcLen = new Float64Array(N)

	for (let i = 0; i < N; i++) {
		const u = i / (N - 1)
		const mx = S.wx + dx * u + px * meanderOffset01(u) * RIVER_MEANDER_AMP
		const my = S.wy + dy * u + py * meanderOffset01(u + 0.31) * RIVER_MEANDER_AMP
		polyWx[i] = THREE.MathUtils.clamp(mx, -PLANE_HALF + margin, PLANE_HALF - margin)
		polyWy[i] = THREE.MathUtils.clamp(my, -PLANE_HALF + margin, PLANE_HALF - margin)
	}

	polyArcLen[0] = 0
	for (let i = 1; i < N; i++) {
		const ddx = polyWx[i] - polyWx[i - 1]
		const ddy = polyWy[i] - polyWy[i - 1]
		polyArcLen[i] = polyArcLen[i - 1] + Math.hypot(ddx, ddy)
	}
	totalArcLen = polyArcLen[N - 1] || 1
	const pad = RIVER_HALF_WIDTH_END + RIVER_FEATHER_OUTER + RIVER_MEANDER_AMP + 220
	let minX = polyWx[0]
	let maxX = polyWx[0]
	let minY = polyWy[0]
	let maxY = polyWy[0]
	for (let i = 1; i < N; i++) {
		const x = polyWx[i]
		const y = polyWy[i]
		if (x < minX) minX = x
		if (x > maxX) maxX = x
		if (y < minY) minY = y
		if (y > maxY) maxY = y
	}
	queryAabbMinX = minX - pad
	queryAabbMaxX = maxX + pad
	queryAabbMinY = minY - pad
	queryAabbMaxY = maxY + pad
}

function buildMonotoneBed() {
	const hRaw = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		hRaw[i] = rawLandHeightFromWarp(polyWx[i], polyWy[i])
	}

	const hStart = hRaw[0]
	const hEnd = hRaw[N - 1]
	polyBedZ = new Float64Array(N)
	const bedCand = new Float64Array(N)

	for (let i = 0; i < N; i++) {
		const u = i / (N - 1)
		const tEnv = 1 - (1 - u) ** RIVER_BED_GRAVITY_EASE
		const hEnv = THREE.MathUtils.lerp(hStart, hEnd, tEnv)
		bedCand[i] = Math.min(hRaw[i] - WATER_DEPTH - BED_CLEARANCE_BELOW_RAW, hEnv - WATER_DEPTH * 0.35)
	}

	polyBedZ[0] = bedCand[0]
	for (let i = 1; i < N; i++) {
		polyBedZ[i] = Math.min(bedCand[i], polyBedZ[i - 1] - BED_MONOTONE_DROP_PER_VERTEX)
	}
}

buildPolyline()
buildMonotoneBed()

export function riverTotalArcLength() {
	return totalArcLen
}

/** Bed elevation at normalized arc position s ∈ [0,1]. */
export function riverBedElevationAtS(s) {
	const t = THREE.MathUtils.clamp(s, 0, 1) * (N - 1)
	const i0 = Math.floor(t)
	const i1 = Math.min(i0 + 1, N - 1)
	const f = t - i0
	return THREE.MathUtils.lerp(polyBedZ[i0], polyBedZ[i1], f)
}

function bedRipple(wx, wy) {
	return (
		14 * (0.5 + 0.5 * Math.sin(wx * 0.0004 + wy * 0.00012)) +
		10 * (0.5 + 0.5 * Math.sin(wx * 0.00022 + wy * 0.00018 + 1.1))
	)
}

/**
 * @param {number} sNorm
 * @returns {number}
 */
export function riverHalfWidthAtS(sNorm) {
	const s = THREE.MathUtils.clamp(sNorm, 0, 1)
	let base = THREE.MathUtils.lerp(RIVER_HALF_WIDTH_START, RIVER_HALF_WIDTH_END, smoothstep01(s))
	/** Last ~12% toward mouth: widen so the outflow meets the map edge at full width (no pinched bay). */
	if (s > 0.88) {
		const u = (s - 0.88) / 0.12
		base *= 1 + u * 0.42
	}
	const wobble =
		fbm2(s * 8.35 + 0.18, 1.42) * 165 +
		fbm2(s * 19.2 + 2.9, 3.1) * 72 +
		Math.sin(s * Math.PI * 2 * 4.18) * 88 +
		Math.sin(s * Math.PI * 2 * 9.1 + 0.7) * 44
	return Math.max(RIVER_HALF_WIDTH_START * 0.42, base + wobble)
}

/**
 * Closest point on polyline to (wx, wy). AABB reject skips ~most of the map; full scan of N−1 segments otherwise.
 * @returns {{ sNorm: number, dist: number, px: number, py: number, seg: number }}
 */
export function closestPointOnRiverPolyline(wx, wy) {
	const best = {
		sNorm: 0,
		dist: 0,
		px: polyWx[0],
		py: polyWy[0],
		seg: 0,
	}
	if (wx < queryAabbMinX || wx > queryAabbMaxX || wy < queryAabbMinY || wy > queryAabbMaxY) {
		best.dist = 1e15
		return best
	}

	let bestD2 = Infinity
	for (let i = 0; i < N - 1; i++) {
		const ax = polyWx[i]
		const ay = polyWy[i]
		const bx = polyWx[i + 1]
		const by = polyWy[i + 1]
		const abx = bx - ax
		const aby = by - ay
		const len2 = abx * abx + aby * aby
		let tt = 0
		if (len2 > 1e-12) {
			tt = ((wx - ax) * abx + (wy - ay) * aby) / len2
			tt = THREE.MathUtils.clamp(tt, 0, 1)
		}
		const px = ax + tt * abx
		const py = ay + tt * aby
		const d2 = (wx - px) ** 2 + (wy - py) ** 2
		if (d2 < bestD2) {
			bestD2 = d2
			const arc = polyArcLen[i] + tt * (polyArcLen[i + 1] - polyArcLen[i])
			best.sNorm = arc / totalArcLen
			best.dist = Math.sqrt(d2)
			best.px = px
			best.py = py
			best.seg = i
		}
	}
	return best
}

/**
 * @param {number} wx
 * @param {number} wy
 * @returns {{ sNorm: number, dist: number } | null} null if off active river (should not happen inside corridor)
 */
export function sAlongRiver(wx, wy) {
	const c = closestPointOnRiverPolyline(wx, wy)
	return { sNorm: c.sNorm, dist: c.dist }
}

/**
 * @param {number} sNorm
 * @returns {{ wx: number, wy: number }}
 */
export function riverCenterlinePointAtS(sNorm) {
	const s = THREE.MathUtils.clamp(sNorm, 0, 1) * (N - 1)
	const i0 = Math.floor(s)
	const i1 = Math.min(i0 + 1, N - 1)
	const f = s - i0
	return {
		wx: THREE.MathUtils.lerp(polyWx[i0], polyWx[i1], f),
		wy: THREE.MathUtils.lerp(polyWy[i0], polyWy[i1], f),
	}
}

/**
 * Unit tangent at s (downstream), for bank offsets.
 * @param {number} sNorm
 */
export function riverTangentAtS(sNorm) {
	const s = THREE.MathUtils.clamp(sNorm, 0, 1) * (N - 1)
	const i0 = Math.min(Math.floor(s), N - 2)
	const i1 = i0 + 1
	const dx = polyWx[i1] - polyWx[i0]
	const dy = polyWy[i1] - polyWy[i0]
	const len = Math.hypot(dx, dy) || 1
	return { tx: dx / len, ty: dy / len }
}

/** Legacy name: centerline Y for a given wx by finding polyline point with nearest wx (approximate). */
export function riverCenterY(wx) {
	let best = 0
	let bestDx = Infinity
	for (let i = 0; i < N; i++) {
		const d = Math.abs(polyWx[i] - wx)
		if (d < bestDx) {
			bestDx = d
			best = i
		}
	}
	return polyWy[best]
}

/**
 * Downstream progress [0, 1] — planar projection (legacy helpers / tint).
 * @param {number} wx
 * @param {number} wy
 */
export function riverFlowAlongT(wx, wy) {
	const dot = wx * FLOW_DNX + wy * FLOW_DNY
	return THREE.MathUtils.clamp((dot + FLOW_SPAN) / (2 * FLOW_SPAN), 0, 1)
}

/** @deprecated Use riverCenterlinePointAtS + arc length; kept for narrow ribbon resampling. */
export function centerlineWxForFlowT(t) {
	const p = riverCenterlinePointAtS(THREE.MathUtils.clamp(t, 0, 1))
	return p.wx
}

export function isRiverCorridor(wx, wy) {
	const c = closestPointOnRiverPolyline(wx, wy)
	return c.dist < riverHalfWidthAtS(c.sNorm)
}

export function riverHalfWidth(wx, wy) {
	const c = closestPointOnRiverPolyline(wx, wy)
	return riverHalfWidthAtS(c.sNorm)
}

/** Bed + ripple using one closest-point sample (hot path for terrain). */
export function riverBedElevationFromClosest(wx, wy, c) {
	return riverBedElevationAtS(c.sNorm) - bedRipple(wx, wy)
}

export function riverBedElevationFlow(wx, wy) {
	const c = closestPointOnRiverPolyline(wx, wy)
	return riverBedElevationFromClosest(wx, wy, c)
}

/** Bed at downstream mouth — no extra closest-point query. */
export function riverMouthBedElevation() {
	const p = riverCenterlinePointAtS(1)
	return riverBedElevationAtS(1) - bedRipple(p.wx, p.wy)
}

/**
 * Extra depth carved at the spring so water emerges from a well-like pocket (fades downstream & toward banks).
 * @param {number} sNorm
 * @param {number} lateral
 * @param {number} hw
 */
function springPocketDepthAt(sNorm, lateral, hw) {
	if (sNorm > SPRING_POCKET_S_NORM || hw < 1e-6) {
		return 0
	}
	const alongFall = 1 - THREE.MathUtils.smoothstep(sNorm, 0, SPRING_POCKET_S_NORM)
	const lateralFall = 1 - THREE.MathUtils.smoothstep(lateral, hw * 0.1, hw * 0.94)
	return alongFall * lateralFall * SPRING_WELL_DEPTH
}

/**
 * Single closest-point query for carve + corridor flag (terrain calls this per heightfield vertex).
 * @returns {{ h: number, inRiverCorridor: boolean }}
 */
export function applyRiverTerrainCarve(wx, wy, terrainH) {
	const c = closestPointOnRiverPolyline(wx, wy)
	const hw = riverHalfWidthAtS(c.sNorm)
	const lateral = c.dist
	if (lateral >= hw + RIVER_FEATHER_OUTER) {
		return { h: terrainH, inRiverCorridor: false }
	}
	const pocket = springPocketDepthAt(c.sNorm, lateral, hw)
	const bedBase = riverBedElevationFromClosest(wx, wy, c) - pocket
	let h
	if (lateral < hw) {
		const u = lateral / hw
		const riverH = bedBase + bankRiseFromCenter(u)
		h = Math.min(terrainH, riverH)
	} else {
		const rimH = bedBase + bankRiseFromCenter(1)
		const carvedAtRim = Math.min(terrainH, rimH)
		const tt = smoothRange(lateral, hw, hw + RIVER_FEATHER_OUTER)
		/** Smooth twice to soften stair-step canyon walls between heightfield samples. */
		const tt2 = tt * tt * (3 - 2 * tt)
		h = carvedAtRim + (terrainH - carvedAtRim) * tt2
	}
	const inRiverCorridor = lateral < hw
	return { h, inRiverCorridor }
}

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

export function riverChannelHeight(wx, wy) {
	const c = closestPointOnRiverPolyline(wx, wy)
	const hw = riverHalfWidthAtS(c.sNorm)
	if (c.dist >= hw) {
		return Infinity
	}
	const u = hw > 1e-6 ? c.dist / hw : 1
	const pocket = springPocketDepthAt(c.sNorm, c.dist, hw)
	return riverBedElevationFromClosest(wx, wy, c) - pocket + bankRiseFromCenter(u)
}

export function riverTerrainBlend(wx, wy, terrainH) {
	return applyRiverTerrainCarve(wx, wy, terrainH).h
}
