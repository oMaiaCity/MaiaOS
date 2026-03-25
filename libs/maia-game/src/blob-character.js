/**
 * Pear-shaped wobbly blob + dot eyes (Lathe + spheres).
 */
import * as THREE from 'three'
import { BLOB_GROUND_SCALE } from './game-constants.js'

/**
 * @returns {{ group: THREE.Group, body: THREE.Mesh, bodyGeo: THREE.BufferGeometry, bodyMat: THREE.Material, eyeGeo: THREE.BufferGeometry, eyeMat: THREE.Material }}
 */
export function createBlobCharacter() {
	const profile = [
		new THREE.Vector2(0.35, 0),
		new THREE.Vector2(0.39, 0.28),
		new THREE.Vector2(0.36, 0.52),
		new THREE.Vector2(0.3, 0.7),
		new THREE.Vector2(0.27, 0.84),
		new THREE.Vector2(0.25, 0.93),
		new THREE.Vector2(0.23, 1.0),
		new THREE.Vector2(0.2, 1.05),
		new THREE.Vector2(0.14, 1.09),
		new THREE.Vector2(0.0, 1.1),
	]
	const bodyGeo = new THREE.LatheGeometry(profile, 32)
	const bodyMat = new THREE.MeshStandardMaterial({
		color: 0x6b7d3a,
		roughness: 0.85,
		metalness: 0,
	})
	const body = new THREE.Mesh(bodyGeo, bodyMat)
	body.castShadow = true
	body.scale.setScalar(1.15)

	const eyeGeo = new THREE.SphereGeometry(0.03, 12, 12)
	const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0 })
	const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
	const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
	eyeL.position.set(-0.08, 0.68, 0.33)
	eyeR.position.set(0.08, 0.68, 0.33)

	const group = new THREE.Group()
	group.add(body)
	body.add(eyeL)
	body.add(eyeR)
	group.scale.setScalar(BLOB_GROUND_SCALE)

	return { group, body, bodyGeo, bodyMat, eyeGeo, eyeMat }
}
