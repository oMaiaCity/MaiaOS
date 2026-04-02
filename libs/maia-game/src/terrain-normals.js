/**
 * Fast heightfield normals for Three.js PlaneGeometry (XY plane, height in Z).
 * Avoids BufferGeometry.computeVertexNormals() on dense terrain grids.
 */
import * as THREE from 'three'

/**
 * @param {THREE.BufferGeometry} geometry
 * @param {number} seg - widthSegments / heightSegments used to build the plane
 */
export function computeHeightfieldNormalsForPlaneGrid(geometry, seg) {
	const pos = geometry.attributes.position
	const grid = seg + 1
	const count = pos.count
	if (count !== grid * grid) {
		throw new Error(
			`computeHeightfieldNormalsForPlaneGrid: expected ${grid * grid} vertices, got ${count}`,
		)
	}

	const cellX = Math.abs(pos.getX(1) - pos.getX(0)) || 1e-6
	const cellY = Math.abs(pos.getY(grid) - pos.getY(0)) || 1e-6

	let normalAttr = geometry.attributes.normal
	if (!normalAttr || normalAttr.count !== count) {
		const n = new Float32Array(count * 3)
		geometry.setAttribute('normal', new THREE.BufferAttribute(n, 3))
		normalAttr = geometry.attributes.normal
	}
	const nArr = /** @type {Float32Array} */ (normalAttr.array)

	const tmp = new THREE.Vector3()

	for (let iy = 0; iy < grid; iy++) {
		for (let ix = 0; ix < grid; ix++) {
			const i = iy * grid + ix

			let dhdx
			if (ix > 0 && ix < seg) {
				dhdx = (pos.getZ(i + 1) - pos.getZ(i - 1)) / (2 * cellX)
			} else if (ix === 0) {
				dhdx = (pos.getZ(i + 1) - pos.getZ(i)) / cellX
			} else {
				dhdx = (pos.getZ(i) - pos.getZ(i - 1)) / cellX
			}

			let dhdy
			if (iy > 0 && iy < seg) {
				dhdy = (pos.getZ(i + grid) - pos.getZ(i - grid)) / (2 * cellY)
			} else if (iy === 0) {
				dhdy = (pos.getZ(i + grid) - pos.getZ(i)) / cellY
			} else {
				dhdy = (pos.getZ(i) - pos.getZ(i - grid)) / cellY
			}

			tmp.set(-dhdx, -dhdy, 1).normalize()
			const o = i * 3
			nArr[o] = tmp.x
			nArr[o + 1] = tmp.y
			nArr[o + 2] = tmp.z
		}
	}

	normalAttr.needsUpdate = true
}
