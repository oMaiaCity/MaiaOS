/**
 * Single water surface: open sea is flat at the downstream mouth; in-river follows bed + column height.
 */
import {
	closestPointOnRiverPolyline,
	riverBedElevationFromClosest,
	riverHalfWidthAtS,
	riverMouthBedElevation,
	WATER_SURFACE_ABOVE_BED,
} from './river.js'

const _seaLevel = riverMouthBedElevation() + WATER_SURFACE_ABOVE_BED

export function seaLevel() {
	return _seaLevel
}

export function waterSurfaceHeightAt(wx, wy) {
	const c = closestPointOnRiverPolyline(wx, wy)
	const hw = riverHalfWidthAtS(c.sNorm)
	if (c.dist >= hw) {
		return _seaLevel
	}
	return riverBedElevationFromClosest(wx, wy, c) + WATER_SURFACE_ABOVE_BED
}
