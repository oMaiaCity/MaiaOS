/**
 * Generic GLTF/GLB loader for @MaiaOS/game (single shared loader instance).
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()

/**
 * @param {string} url — absolute or same-origin path to .glb / .gltf
 * @returns {Promise<unknown>}
 */
export function loadGLTF(url) {
	return new Promise((resolve, reject) => {
		loader.load(url, resolve, undefined, reject)
	})
}

/**
 * @param {string} url
 * @returns {Promise<{ scene: import('three').Object3D, gltf: unknown }>}
 */
export async function loadGLTFScene(url) {
	const gltf = await loadGLTF(url)
	return { scene: gltf.scene, gltf }
}

/**
 * @param {THREE.Object3D} root
 * @param {(mesh: THREE.Mesh) => void} fn
 */
export function traverseMeshes(root, fn) {
	root.traverse((obj) => {
		if (obj.isMesh) {
			fn(obj)
		}
	})
}

/**
 * Dispose GPU resources from a loaded GLTF (geometries + materials).
 * @param {{ scene: import('three').Object3D }} gltf
 */
export function disposeGLTF(gltf) {
	gltf.scene.traverse((obj) => {
		if (obj.isMesh) {
			obj.geometry?.dispose()
			const mats = obj.material
			if (Array.isArray(mats)) {
				for (const m of mats) m.dispose()
			} else if (mats) {
				mats.dispose()
			}
		}
	})
}
