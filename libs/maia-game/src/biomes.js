/**
 * Height-based vertex colors, river corridor sand, underwater tint.
 */
import * as THREE from 'three'
import { fbm2 } from './noise.js'
import {
	closestPointOnRiverPolyline,
	isRiverCorridor,
	RIVER_BED_FLAT_FRAC,
	riverHalfWidth,
} from './river.js'
import { distanceIntoCoastalRingPlane } from './terrain.js'
import { seaLevel, waterSurfaceHeightAt } from './water-surface.js'

export { isRiverCorridor, seaLevel, waterSurfaceHeightAt }

function smoothRange(t, a, b) {
	const x = THREE.MathUtils.clamp((t - a) / Math.max(b - a, 1e-6), 0, 1)
	return x * x * (3 - 2 * x)
}

function lerpRgb(a, b, t) {
	const k = THREE.MathUtils.clamp(t, 0, 1)
	return {
		r: a.r + (b.r - a.r) * k,
		g: a.g + (b.g - a.g) * k,
		b: a.b + (b.b - a.b) * k,
	}
}

const EARTH_RGB = { r: 0.48, g: 0.34, b: 0.24 }
const UNDERWATER_RGB = { r: 0.1, g: 0.36, b: 0.48 }

/** Sand (low) → earth → grass → snow on high ground; tn = normalized height [0,1]. */
export function heightBiomeRgb(tn) {
	const e0 = 0.34
	/** Slightly earlier grass than before — narrower earth band, more overall green. */
	const e1 = 0.64
	const grassBrightEnd = 0.77
	const snowBlendStart = 0.795
	const snowBlendEnd = 0.865
	const sand = { r: 0.86, g: 0.76, b: 0.58 }
	const grass = { r: 0.26, g: 0.44, b: 0.2 }
	const grassHigh = { r: 0.28, g: 0.48, b: 0.22 }
	const snow = { r: 0.96, g: 0.97, b: 1 }
	const t = THREE.MathUtils.clamp(tn, 0, 1)
	if (t < e0) {
		return lerpRgb(sand, EARTH_RGB, smoothRange(t, 0.06, e0))
	}
	if (t < e1) {
		return lerpRgb(EARTH_RGB, grass, smoothRange(t, e0 * 0.95, e1))
	}
	if (t < grassBrightEnd) {
		return lerpRgb(grass, grassHigh, smoothRange(t, e1, grassBrightEnd))
	}
	if (t < snowBlendStart) {
		return grassHigh
	}
	if (t < snowBlendEnd) {
		return lerpRgb(grassHigh, snow, smoothRange(t, snowBlendStart, snowBlendEnd))
	}
	return snow
}

const DOME_GARDEN_LAWN_RGB = { r: 0.16, g: 0.5, b: 0.24 }

function domeGardenTurfStrength(lx, ly, centerX, centerZ, innerR, outerR) {
	const wx = lx
	const wz = -ly
	const dx = wx - centerX
	const dz = wz - centerZ
	const r = Math.hypot(dx, dz)
	const tIn = smoothRange(r, innerR - 12, innerR + 6)
	const tOut = 1 - smoothRange(r, outerR - 10, outerR + 22)
	return tIn * tOut * 0.96
}

/**
 * Warmer lawn green under the dome garden annulus (plane lx, ly; world xz matches terrain sampling).
 */
export function domeGardenTurfRgb(lx, ly, baseRgb, centerX, centerZ, innerR, outerR) {
	const strength = domeGardenTurfStrength(lx, ly, centerX, centerZ, innerR, outerR)
	if (strength <= 0) {
		return baseRgb
	}
	return lerpRgb(baseRgb, DOME_GARDEN_LAWN_RGB, strength)
}

/**
 * Strongest lawn blend among several dome centers (multiple garden rings).
 * @param {Array<{ centerX: number, centerZ: number }>} centers
 */
export function domeGardenTurfRgbMax(lx, ly, baseRgb, centers, innerR, outerR) {
	let best = 0
	for (const c of centers) {
		const s = domeGardenTurfStrength(lx, ly, c.centerX, c.centerZ, innerR, outerR)
		if (s > best) {
			best = s
		}
	}
	if (best <= 0) {
		return baseRgb
	}
	return lerpRgb(baseRgb, DOME_GARDEN_LAWN_RGB, best)
}

const BEACH_SAND_RGB = { r: 0.82, g: 0.74, b: 0.55 }

/**
 * Warm beach / littoral tint along the organic shore (low elevation near the land–sea transition).
 * Wide smooth ramps avoid hard cutoffs and noisy dither at grass ↔ sand.
 */
export function littoralTerrainRgb(lx, ly, wx, wy, baseRgb, tn) {
	const dRing = distanceIntoCoastalRingPlane(lx, ly, wx, wy)
	if (dRing > 680) {
		return baseRgb
	}
	const inBand = smoothRange(dRing, -980, 560)
	const outDeep = 1 - smoothRange(dRing, 420, 760)
	const ringEntry = inBand * outDeep
	const lowElev = 1 - smoothRange(tn, 0.14, 0.55)
	const sandNoise = fbm2(wx * 0.00038 + 0.2, wy * 0.00036 - 0.11) * 0.08
	const strength = THREE.MathUtils.clamp(ringEntry * lowElev * 0.31 + sandNoise, 0, 1)
	return lerpRgb(baseRgb, BEACH_SAND_RGB, strength)
}

/**
 * River corridor: warm sand on banks; flat bed reads as stone/gravel (banks unchanged at high u).
 */
export function riverCorridorRgb(wx, wy, baseRgb) {
	const c = closestPointOnRiverPolyline(wx, wy)
	const d = c.dist
	const hw = riverHalfWidth(wx, wy)
	if (d >= hw) {
		return baseRgb
	}
	const u = d / hw
	const edgeBlend = 1 - smoothRange(u, 0.78, 1)
	const bankSand = { r: 0.9, g: 0.8, b: 0.62 }
	/** Channel floor — grey stone/gravel (underwater tint still applies). */
	const bedGravel = { r: 0.44, g: 0.45, b: 0.47 }
	const bedCore = 1 - smoothRange(u, 0, RIVER_BED_FLAT_FRAC * 0.95)
	const sandTarget = lerpRgb(bankSand, bedGravel, bedCore)
	const bedSandMask = 1 - smoothRange(u, 0.18, 0.48)
	const sandStrength = 0.88 * edgeBlend * (0.32 + 0.68 * bedSandMask)
	return lerpRgb(baseRgb, sandTarget, sandStrength)
}

/** Normalized height band matching grass / high grass (excludes sand, snow, peaks). */
const TREE_BIOME_TN_MIN = 0.48
const TREE_BIOME_TN_MAX = 0.79

export function isGrassBiomeForTrees(tn) {
	return tn >= TREE_BIOME_TN_MIN && tn < TREE_BIOME_TN_MAX
}

/**
 * Fractal noise in warped world (wx, wy): ~symmetric around 0, so fbm>0 covers ~half the plane.
 * Scale **down** coordinates before FBM to stretch the field → fewer, larger colocated forest
 * masses instead of many small islands (do not use tiny scales here — that flattens the field).
 */
const DENSE_PATCH_FBM_WORLD_SCALE = 0.24

/**
 * Irregular forest patches — trees/bushes only where this is true (~50% of grass area).
 */
export function isDenseForestPatch(wx, wy) {
	const sx = wx * DENSE_PATCH_FBM_WORLD_SCALE
	const sy = wy * DENSE_PATCH_FBM_WORLD_SCALE
	return fbm2(sx, sy) > 0
}

const OPEN_GRASS_SUB_RGB = { r: 0.34, g: 0.54, b: 0.26 }
/** Dark forest-floor green (under canopy). */
const DENSE_FOREST_SUB_RGB = { r: 0.08, g: 0.32, b: 0.11 }

/**
 * Open meadow vs denser canopy floor — only where trees can grow and not in the river strip.
 * Call after heightBiomeRgb, before riverCorridorRgb.
 */
export function grassSubBiomeTerrainRgb(rgb, tn, wx, wy) {
	if (!isGrassBiomeForTrees(tn) || isRiverCorridor(wx, wy)) {
		return rgb
	}
	const wOpen = 0.2
	const wDense = 0.32
	if (isDenseForestPatch(wx, wy)) {
		return lerpRgb(rgb, DENSE_FOREST_SUB_RGB, wDense)
	}
	return lerpRgb(rgb, OPEN_GRASS_SUB_RGB, wOpen)
}

/**
 * @param {number} tn
 * @param {number} h
 * @param {number} [lx] — plane X (optional; excludes sparse trees on low coastal fringes)
 * @param {number} [ly] — plane Y
 */
export function canPlaceTree(wx, wy, h, tn, lx, ly) {
	if (!isGrassBiomeForTrees(tn)) {
		return false
	}
	if (isRiverCorridor(wx, wy)) {
		return false
	}
	const surf = waterSurfaceHeightAt(wx, wy)
	if (h < surf) {
		return false
	}
	if (lx !== undefined && ly !== undefined) {
		const dRing = distanceIntoCoastalRingPlane(lx, ly, wx, wy)
		if (dRing > -420 && dRing < 880 && tn < 0.52) {
			return false
		}
	}
	return true
}

export function applyUnderwaterRiverTint(wx, wy, h, rgb) {
	const surfaceH = waterSurfaceHeightAt(wx, wy)
	if (h >= surfaceH) {
		return rgb
	}
	const depth = surfaceH - h
	const t = THREE.MathUtils.clamp(depth / 62, 0, 1)
	return lerpRgb(rgb, UNDERWATER_RGB, t * 0.88)
}
