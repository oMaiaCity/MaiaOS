/**
 * Temporary rose/violet placement highlight on loaded GLB meshes (emissive).
 */
import * as THREE from 'three'
import { traverseMeshes } from './load-gltf.js'

const PLACEMENT_TINT = new THREE.Color(0xc45a9a)

/**
 * @param {import('three').Object3D} root
 * @param {boolean} enabled
 */
export function setDomePlacementHighlight(root, enabled) {
	traverseMeshes(root, (mesh) => {
		const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
		for (const mat of mats) {
			if (!mat || typeof mat !== 'object') {
				continue
			}
			if (enabled) {
				if (!mat.userData.maiaPlacementBackup) {
					mat.userData.maiaPlacementBackup = {
						emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0),
						emissiveIntensity: mat.emissiveIntensity ?? 0,
					}
				}
				if (mat.emissive) {
					mat.emissive.copy(PLACEMENT_TINT)
				}
				mat.emissiveIntensity = 0.52
			} else {
				const b = mat.userData.maiaPlacementBackup
				if (b) {
					if (mat.emissive) {
						mat.emissive.copy(b.emissive)
					}
					mat.emissiveIntensity = b.emissiveIntensity
					delete mat.userData.maiaPlacementBackup
				}
			}
		}
	})
}
