/**
 * Land height from warped plane coords **before** river carve or water clamp.
 * Shared by `terrain.js` and `river.js` (no import cycle with river carve).
 */
import { fbm2, ridgedFbm2 } from './noise.js'

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

/**
 * @param {number} wx
 * @param {number} wy
 * @returns {number}
 */
export function rawLandHeightFromWarp(wx, wy) {
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
	return sharpenSignedHeight(raw)
}
