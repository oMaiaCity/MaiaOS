/**
 * Plane (lx, ly) → warped world (wx, wy). Shared so river spring anchoring matches terrain sampling.
 */
import { fbm2 } from './noise.js'

export function terrainPlaneWarp(lx, ly) {
	return {
		wx: lx + fbm2(lx * 0.0018 + 2.1, ly * 0.0017 - 1.4) * 75,
		wy: ly + fbm2(lx * 0.0016 + 8.7, ly * 0.0019 + 3.2) * 75,
	}
}

/**
 * Inverse of `terrainPlaneWarp`: plane (lx, ly) such that warp(lx,ly) ≈ (wxTarget, wyTarget).
 * Terrain mesh vertices live in **plane** space; the river uses warped coords for height/carve —
 * water meshes must convert back to (lx, ly) so ribbons align with the ground plane.
 */
export function inverseTerrainPlaneWarp(wxTarget, wyTarget) {
	let lx = wxTarget
	let ly = wyTarget
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
