/**
 * Procedural heightfield: warp, sharpen, continent + ridged peaks + river carve.
 */
import { CORE_PRESERVE_HALF, EDGE_MARGIN, WORLD_PLANE_HALF } from './game-constants.js'
import { fbm2 } from './noise.js'
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

/**
 * Mean shoreline radius targeting ~3/5 land vs 2/5 sea in the square map:
 * π R² ≈ 0.6 × (2×WORLD_PLANE_HALF)²  →  R ≈ WORLD_PLANE_HALF × sqrt(0.6×4/π).
 */
const R_ISLAND_BASE = WORLD_PLANE_HALF * Math.sqrt((0.6 * 4) / Math.PI)
/** Blend land ↔ ocean across signed distance (m). Wider = gentler coast (critical at river mouth). */
const SHORE_BLEND_METERS = 920
/** Max rise per meter inland from the shoreline (gentle slopes toward the beach). */
const LAND_TOWARD_SHORE_SLOPE = 0.11
/** Meters inland from shore until full raw mountain height; must stay ≪ island radius or most land stays capped flat. */
const INLAND_RELIEF_RANGE = 2200
const SEABED_ROUGHNESS = 20

/**
 * Irregular island outline: multi-scale fbm + angular terms for pronounced bays and peninsulas
 * (not a smooth circle), without collapsing back to a thin “starfish”.
 */
function islandBoundaryRadius(wx, wy) {
	const a = Math.atan2(wy, wx)
	return (
		R_ISLAND_BASE +
		fbm2(wx * 0.000125 + 1.15, wy * 0.000118 - 0.62) * 620 +
		fbm2(wx * 0.00031 + 0.42, wy * 0.000295 + 1.05) * 340 +
		fbm2(wx * 0.00072 + 2.8, wy * 0.00068 - 1.4) * 155 +
		fbm2(wx * 0.000052 + 4.1, wy * 0.00005 - 2.6) * 210 +
		fbm2(wx * 0.000018 + 0.9, wy * 0.000016 - 1.1) * 420 +
		fbm2(wx * 0.00022 + 0.33, wy * 0.000205 - 0.71) * 195 +
		Math.sin(a * 4 + fbm2(wx * 0.000075, wy * 0.000071) * 2.8) * 168 +
		Math.sin(a * 7 + 1.05) * 102 +
		Math.sin(a * 11 + fbm2(wx * 0.0001, wy * 0.000095) * 1.9) * 72 +
		Math.sin(a * 16 + 0.4) * 38 +
		Math.sin(a * 5 + fbm2(wx * 0.000046, wy * 0.000044) * 1.4) * 132 +
		Math.sin(a * 9 + 2.1) * 92 +
		Math.sin(a * 13 + fbm2(wx * 0.00013, wy * 0.00012) * 0.8) * 58
	)
}

/**
 * Positive = open ocean outside the island; negative = land inside (approximate radial sdf).
 */
export function signedDistanceToOcean(lx, ly, wx, wy) {
	const r = Math.hypot(lx, ly)
	return r - islandBoundaryRadius(wx, wy)
}

/**
 * Same as {@link signedDistanceToOcean} — positive = ocean (biomes / trees).
 */
export function distanceIntoCoastalRingPlane(lx, ly, wx, wy) {
	return signedDistanceToOcean(lx, ly, wx, wy)
}

function smoothstep01(t) {
	const x = Math.max(0, Math.min(1, t))
	return x * x * (3 - 2 * x)
}

function landHeightTowardShore(hCore, dIn, wx, wy) {
	const capH =
		seaLevel() +
		105 +
		fbm2(wx * 0.00022 + 0.4, wy * 0.000205 - 0.18) * 95 +
		dIn * LAND_TOWARD_SHORE_SLOPE
	const hSoft = Math.min(hCore, capH)
	const blend = smoothstep01(dIn / INLAND_RELIEF_RANGE)
	return hSoft + (hCore - hSoft) * blend
}

function oceanBedHeight(wx, wy, sd) {
	const s = Math.max(0, sd)
	const rough = fbm2(wx * 0.00048 + 0.15, wy * 0.00045 - 0.22) * SEABED_ROUGHNESS
	const tDeep = smoothstep01(Math.min(1, s / 1300))
	const deepH = seaLevel() - 52 - tDeep * 405 + rough
	/** Shallow near shore so hLand→hOcean blend is not hundreds of meters over one grid cell. */
	const shallowH = seaLevel() - 20 + rough * 0.35
	const blend = smoothstep01(s / 480)
	return shallowH * (1 - blend) + deepH * blend
}

export { terrainPlaneWarp }

/**
 * Core pipeline: raw land + river carve + dry-floor clamp (no coastal band).
 */
function terrainHeightCoreOnly(wx, wy) {
	const terrainH = rawLandHeightFromWarp(wx, wy)
	const { h, inRiverCorridor } = applyRiverTerrainCarve(wx, wy, terrainH)
	if (!inRiverCorridor) {
		return Math.max(h, seaLevel() + LAND_MIN_ABOVE_WATER_SURFACE)
	}
	return h
}

/**
 * Single height for mesh + texture: raw land + river carve, then irregular island shore + ocean.
 * @param {number} lx
 * @param {number} ly
 */
export function terrainHeightAtPlaneXY(lx, ly) {
	const { wx, wy } = terrainPlaneWarp(lx, ly)
	const hCore = terrainHeightCoreOnly(wx, wy)
	const sd = signedDistanceToOcean(lx, ly, wx, wy)

	if (isRiverCorridor(wx, wy)) {
		if (sd > 0) {
			const seabed = oceanBedHeight(wx, wy, sd)
			const t = smoothstep01(sd / 1400)
			return hCore * (1 - t) + seabed * t
		}
		return hCore
	}

	const dIn = Math.max(0, -sd)
	const hLand = landHeightTowardShore(hCore, dIn, wx, wy)
	const hOcean = oceanBedHeight(wx, wy, Math.max(0, sd))
	const w = smoothstep01((sd + SHORE_BLEND_METERS) / (2 * SHORE_BLEND_METERS))
	return hLand + (hOcean - hLand) * w
}

/** Minimum distance from origin so spawn is not at map center. */
const SPAWN_RING_MIN_R = 900

/**
 * Pick a high-elevation point on a ring away from center (ridge / peak sample grid).
 * `playerZ` matches mount convention: terrain uses `ly = -playerZ`.
 * @returns {{ playerX: number, playerZ: number }}
 */
export function findMountainTopSpawnPosition() {
	const lim = Math.min(CORE_PRESERVE_HALF - EDGE_MARGIN, R_ISLAND_BASE * 0.82)
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
			const { wx, wy } = terrainPlaneWarp(lx, ly)
			if (signedDistanceToOcean(lx, ly, wx, wy) > -40) {
				continue
			}
			const h = terrainHeightAtPlaneXY(lx, ly)
			if (h > bestH) {
				bestH = h
				bestLx = lx
				bestLy = ly
			}
		}
	}
	if (bestH === -Infinity) {
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

	const lim = WORLD_PLANE_HALF - EDGE_MARGIN

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
