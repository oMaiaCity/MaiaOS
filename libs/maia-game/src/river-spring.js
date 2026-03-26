/**
 * Rim + inner well wall at the river spring (pairs with spring pocket carve in river.js).
 */
import * as THREE from 'three'
import { inverseTerrainPlaneWarp, terrainPlaneWarp } from './plane-warp.js'
import {
	riverBedElevationFlow,
	riverCenterlinePointAtS,
	riverHalfWidthAtS,
	SPRING_WELL_DEPTH,
} from './river.js'

/**
 * @param {(lx: number, ly: number) => number} terrainHeightAtPlaneXY
 * @returns {{ group: import('three').Group, dispose: () => void }}
 */
export function createSpringMouthGroup(terrainHeightAtPlaneXY) {
	const pS = riverCenterlinePointAtS(0)
	const { lx, ly } = inverseTerrainPlaneWarp(pS.wx, pS.wy)
	const { wx, wy } = terrainPlaneWarp(lx, ly)
	const hw = riverHalfWidthAtS(0)
	const rimY = terrainHeightAtPlaneXY(lx, ly)
	const bedY = riverBedElevationFlow(wx, wy)

	const outerR = hw * 0.46
	const innerR = hw * 0.24
	const wellH = Math.min(68, SPRING_WELL_DEPTH * 1.05)

	const group = new THREE.Group()
	group.name = 'RiverSpringMouth'
	group.position.set(lx, rimY, -ly)

	const stoneMat = new THREE.MeshStandardMaterial({
		color: 0x5c4a38,
		roughness: 0.94,
		metalness: 0.02,
		envMapIntensity: 0.28,
	})
	const innerMat = new THREE.MeshStandardMaterial({
		color: 0x1e242c,
		roughness: 1,
		metalness: 0,
		side: THREE.DoubleSide,
	})

	const ringGeom = new THREE.RingGeometry(innerR, outerR, 40)
	const ring = new THREE.Mesh(ringGeom, stoneMat)
	ring.rotation.x = -Math.PI / 2
	ring.position.y = 0.35
	ring.receiveShadow = true
	ring.castShadow = true
	group.add(ring)

	const lipGeom = new THREE.TorusGeometry((innerR + outerR) * 0.5, (outerR - innerR) * 0.35, 10, 48)
	const lip = new THREE.Mesh(lipGeom, stoneMat)
	lip.rotation.x = Math.PI / 2
	lip.position.y = 0.42
	lip.receiveShadow = true
	lip.castShadow = true
	group.add(lip)

	const cylGeom = new THREE.CylinderGeometry(innerR * 0.97, innerR * 0.82, wellH, 28, 1, true)
	const cyl = new THREE.Mesh(cylGeom, innerMat)
	cyl.position.y = -wellH * 0.5 + 0.2
	cyl.receiveShadow = true
	cyl.castShadow = true
	group.add(cyl)

	const floorGeom = new THREE.CircleGeometry(innerR * 0.82, 24)
	const floor = new THREE.Mesh(floorGeom, innerMat)
	floor.rotation.x = -Math.PI / 2
	const floorLocalY = bedY - rimY + 0.04
	floor.position.y = THREE.MathUtils.clamp(floorLocalY, -wellH + 0.12, -0.12)
	floor.receiveShadow = true
	group.add(floor)

	function dispose() {
		ringGeom.dispose()
		lipGeom.dispose()
		cylGeom.dispose()
		floorGeom.dispose()
		stoneMat.dispose()
		innerMat.dispose()
	}

	return { group, dispose }
}
