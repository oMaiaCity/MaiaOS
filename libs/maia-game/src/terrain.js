/**
 * Procedural heightfield: warp, sharpen, continent + ridged peaks + river carve.
 */
import { EDGE_MARGIN, PLANE_HALF } from './game-constants.js'
import { fbm2, ridgedFbm2 } from './noise.js'
import { riverTerrainBlend } from './river.js'

/** Final vertical scale (after sharpen). */
const TERRAIN_AMPLITUDE = 3.55
/** Signed curve: exponent >1 pulls mass toward peaks/valleys (less mushy mid-slopes). */
const HEIGHT_SHARPEN_S = 520
const HEIGHT_SHARPEN_EXP = 1.22

function sharpenSignedHeight(raw) {
	const a = Math.abs(raw)
	const s = HEIGHT_SHARPEN_S
	const t = Math.min(a / s, 2.4)
	const curved = t ** HEIGHT_SHARPEN_EXP * s
	return Math.sign(raw) * curved
}

/** Must match height sampling: terrain noise lives in warped plane coordinates. */
export function terrainPlaneWarp(lx, ly) {
	return {
		wx: lx + fbm2(lx * 0.0018 + 2.1, ly * 0.0017 - 1.4) * 75,
		wy: ly + fbm2(lx * 0.0016 + 8.7, ly * 0.0019 + 3.2) * 75,
	}
}

/**
 * Single height for mesh + texture: continents, ridged peaks, deep valleys, high-freq roughness.
 * @param {number} lx
 * @param {number} ly
 */
export function terrainHeightAtPlaneXY(lx, ly) {
	const { wx, wy } = terrainPlaneWarp(lx, ly)

	const n = fbm2(wx * 0.004, wy * 0.004)
	const continent = fbm2(wx * 0.00135, wy * 0.00132) * 38
	const hills = fbm2(wx * 0.0046, wy * 0.0044) * 14
	const ridges = Math.sin(wx * 0.00175 + n * 2.2) * Math.cos(wy * 0.00155 - n * 1.5) * 44

	const r1 = ridgedFbm2(wx * 0.0036, wy * 0.0035)
	const r2 = ridgedFbm2(wx * 0.0062, wy * 0.006)
	const r3 = ridgedFbm2(wx * 0.011, wy * 0.0105)
	const peaks = r1 * 148 + r2 * 92 + Math.max(0, r2) ** 2.4 * 48
	const spikes = Math.max(0.04, r1) ** 2.85 * 78

	const v = fbm2(wx * 0.002 + 10, wy * 0.00195 - 3) * 0.5 + 0.5
	const v2 = fbm2(wx * 0.0034 - 2, wy * 0.0031 + 6) * 0.5 + 0.5
	const valleys = -(v ** 3.6) * 195 - v2 ** 4.2 * 125

	const detail = fbm2(wx * 0.028, wy * 0.027) * 34
	const grit = fbm2(wx * 0.072, wy * 0.069) * 16

	const raw =
		(continent + hills + ridges + peaks + spikes + r3 * 22 + valleys + detail + grit) *
		TERRAIN_AMPLITUDE
	const terrainH = sharpenSignedHeight(raw)
	return riverTerrainBlend(wx, wy, terrainH)
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
