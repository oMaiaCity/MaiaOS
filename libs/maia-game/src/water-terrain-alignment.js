/**
 * Aligns river water geometry to the same heightfield the ground mesh uses.
 *
 * Invariant: at every water vertex in plane space (lx, ly), the rendered surface height
 * must not exceed terrainHeightAtPlaneXY(lx, ly). Otherwise the water plane can float above
 * banks (especially uneven rims) while the terrain mesh stays below.
 *
 * Intended surface = river bed at that warped sample + column height; then clamp to terrain.
 */
import { terrainHeightAtPlaneXY } from './terrain.js'

const SURFACE_BELOW_TERRAIN = 0.4

/**
 * @param {number} lx
 * @param {number} ly
 * @param {number} intendedSurfaceY — bed + water column at this sample
 * @param {number} bedElevationY — river bed at this sample (floor of water column)
 * @returns {number}
 */
export function clampRiverSurfaceToTerrain(lx, ly, intendedSurfaceY, bedElevationY) {
	const th = terrainHeightAtPlaneXY(lx, ly)
	const capped = Math.min(intendedSurfaceY, th - SURFACE_BELOW_TERRAIN)
	return Math.max(bedElevationY + 0.06, capped)
}
