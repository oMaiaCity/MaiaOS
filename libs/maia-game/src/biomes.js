/**
 * Height-based vertex colors, river corridor sand, underwater tint, global flood level.
 */
import * as THREE from 'three'
import { PLANE_HALF } from './game-constants.js'
import { fbm2 } from './noise.js'
import {
	FLOW_DN_X,
	FLOW_DN_Y,
	RIVER_BED_FLAT_FRAC,
	riverBedElevationFlow,
	riverCenterY,
	riverHalfWidth,
	WATER_DEPTH,
} from './river.js'

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

/** Sand (low) → earth → grass → snow only on the highest peaks; tn = normalized height [0,1]. */
export function heightBiomeRgb(tn) {
	const e0 = 0.34
	/** Slightly earlier grass than before — narrower earth band, more overall green. */
	const e1 = 0.64
	const grassBrightEnd = 0.87
	const snowBlendStart = 0.885
	const snowBlendEnd = 0.945
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

/**
 * Warmer lawn green under the dome garden annulus (plane lx, ly; world xz matches terrain sampling).
 */
export function domeGardenTurfRgb(lx, ly, baseRgb, centerX, centerZ, innerR, outerR) {
	const wx = lx
	const wz = -ly
	const dx = wx - centerX
	const dz = wz - centerZ
	const r = Math.hypot(dx, dz)
	const lawn = { r: 0.16, g: 0.5, b: 0.24 }
	const tIn = smoothRange(r, innerR - 12, innerR + 6)
	const tOut = 1 - smoothRange(r, outerR - 10, outerR + 22)
	const strength = tIn * tOut * 0.96
	if (strength <= 0) {
		return baseRgb
	}
	return lerpRgb(baseRgb, lawn, strength)
}

/**
 * River corridor: warm sand on banks; flat bed reads as stone/gravel (banks unchanged at high u).
 */
export function riverCorridorRgb(wx, wy, baseRgb) {
	const cy = riverCenterY(wx)
	const d = Math.abs(wy - cy)
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

/** Representative global water surface for flood tint + flood plane (upstream/downstream bed average + column). */
export function floodWaterLevel() {
	const len = Math.hypot(FLOW_DN_X, FLOW_DN_Y)
	const dnx = FLOW_DN_X / len
	const dny = FLOW_DN_Y / len
	const span = PLANE_HALF * (Math.abs(dnx) + Math.abs(dny))
	const wx0 = -dnx * span * 0.9
	const wy0 = -dny * span * 0.9
	const wx1 = dnx * span * 0.9
	const wy1 = dny * span * 0.9
	return (riverBedElevationFlow(wx0, wy0) + riverBedElevationFlow(wx1, wy1)) / 2 + WATER_DEPTH
}

/**
 * Tint terrain below water: river corridor uses centerline surface; elsewhere uses global flood level.
 * @param {number} floodLevel
 */
/** Same surface rule as underwater tint: river corridor vs global flood. */
export function waterSurfaceHeightAt(wx, wy, floodLevel) {
	const cy = riverCenterY(wx)
	const d = Math.abs(wy - cy)
	const hw = riverHalfWidth(wx, wy)
	if (d >= hw) {
		return floodLevel
	}
	return riverBedElevationFlow(wx, cy) + WATER_DEPTH
}

export function isRiverCorridor(wx, wy) {
	const cy = riverCenterY(wx)
	const d = Math.abs(wy - cy)
	const hw = riverHalfWidth(wx, wy)
	return d < hw
}

/** Normalized height band matching grass / high grass (excludes sand, snow, peaks). */
const TREE_BIOME_TN_MIN = 0.48
const TREE_BIOME_TN_MAX = 0.88

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
 * @param {number} floodLevel
 */
export function canPlaceTree(wx, wy, h, tn, floodLevel) {
	if (!isGrassBiomeForTrees(tn)) {
		return false
	}
	if (isRiverCorridor(wx, wy)) {
		return false
	}
	const surf = waterSurfaceHeightAt(wx, wy, floodLevel)
	return h >= surf
}

export function applyUnderwaterRiverTint(wx, wy, h, rgb, floodLevel) {
	const cy = riverCenterY(wx)
	const d = Math.abs(wy - cy)
	const hw = riverHalfWidth(wx, wy)
	const riverSurf = riverBedElevationFlow(wx, cy) + WATER_DEPTH
	const inCorridor = d < hw
	const surfaceH = inCorridor ? riverSurf : floodLevel
	if (h >= surfaceH) {
		return rgb
	}
	const depth = surfaceH - h
	const t = THREE.MathUtils.clamp(depth / 62, 0, 1)
	return lerpRgb(rgb, UNDERWATER_RGB, t * 0.88)
}
