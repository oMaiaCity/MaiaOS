/**
 * Dome rim height sampling for level seating on uneven terrain; door arc helpers.
 */

/**
 * Lowest terrain height under the dome rim circle (XZ circle at `radius`).
 * @param {number} centerX
 * @param {number} centerZ
 * @param {number} radius — horizontal rim radius in XZ
 * @param {(lx: number, ly: number) => number} terrainHeightAtPlaneXY
 * @param {number} [samples]
 */
export function minTerrainHeightUnderRim(
	centerX,
	centerZ,
	radius,
	terrainHeightAtPlaneXY,
	samples = 56,
) {
	let minH = Infinity
	for (let i = 0; i < samples; i++) {
		const a = (i / samples) * Math.PI * 2
		const lx = centerX + Math.cos(a) * radius
		const ly = -centerZ + Math.sin(a) * radius
		const h = terrainHeightAtPlaneXY(lx, ly)
		if (h < minH) {
			minH = h
		}
	}
	return minH
}

/**
 * Highest terrain height under the dome rim circle — use for `groundY` when the dome must sit above sloped ground so the entry (and rim) are not buried on the uphill side. Tradeoff: the downhill side may show a small gap under the shell.
 * @param {number} centerX
 * @param {number} centerZ
 * @param {number} radius
 * @param {(lx: number, ly: number) => number} terrainHeightAtPlaneXY
 * @param {number} [samples]
 */
export function maxTerrainHeightUnderRim(
	centerX,
	centerZ,
	radius,
	terrainHeightAtPlaneXY,
	samples = 56,
) {
	let maxH = -Infinity
	for (let i = 0; i < samples; i++) {
		const a = (i / samples) * Math.PI * 2
		const lx = centerX + Math.cos(a) * radius
		const ly = -centerZ + Math.sin(a) * radius
		const h = terrainHeightAtPlaneXY(lx, ly)
		if (h > maxH) {
			maxH = h
		}
	}
	return maxH
}

/**
 * Max terrain height along the door rim arc (world XZ angle `atan2(dx,dz)` matches collision).
 * Use with a small clearance for `groundY` so the entry stays above sloped ground.
 * @param {number} centerX
 * @param {number} centerZ
 * @param {number} radius
 * @param {number} doorCenterAngle — `Math.atan2(spawnX - cx, spawnZ - cz)` from dome center
 * @param {number} doorGapRadians
 * @param {(lx: number, ly: number) => number} terrainHeightAtPlaneXY
 * @param {number} [samples]
 */
export function maxTerrainHeightOnDoorArc(
	centerX,
	centerZ,
	radius,
	doorCenterAngle,
	doorGapRadians,
	terrainHeightAtPlaneXY,
	samples = 28,
) {
	const halfArc = doorGapRadians / 2 + 0.08
	let maxH = -Infinity
	for (let i = 0; i <= samples; i++) {
		const t = i / samples
		const theta = doorCenterAngle - halfArc + t * (2 * halfArc)
		const lx = centerX + Math.sin(theta) * radius
		const ly = -(centerZ + Math.cos(theta) * radius)
		const h = terrainHeightAtPlaneXY(lx, ly)
		if (h > maxH) {
			maxH = h
		}
	}
	return maxH
}

/**
 * @param {number} angle — atan2-style angle in XZ (same as player / door checks)
 * @param {number} center
 * @param {number} halfWidth — inclusive half-arc in radians
 */
export function angleWithinArc(angle, center, halfWidth) {
	const d = Math.atan2(Math.sin(angle - center), Math.cos(angle - center))
	return Math.abs(d) <= halfWidth + 1e-4
}
