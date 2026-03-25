/**
 * Geodesic dome: baked .glb (see scripts/import-blender-dome.mjs), unit horizontal radius at ground, scaled at runtime.
 */
import * as THREE from 'three'
import { createDomeGardenGroup, disposeDomeGardenGroup } from './dome-garden.js'
import { disposeGLTF, loadGLTFScene, traverseMeshes } from './load-gltf.js'
import { terrainHeightAtPlaneXY } from './terrain.js'

/** Local horizontal angle `atan2(x,z)` where the entrance faces in the GLB (+Z forward = 0). Tune if the door misaligns. */
export const DOME_BAKED_ENTRANCE_ATAN2 = 0

export function domeLocalGapCenterAtan2XZ(doorGapRadians) {
	const phi = Math.PI * 2 - doorGapRadians / 2
	const theta = Math.PI / 2
	const x = -Math.cos(phi) * Math.sin(theta)
	const z = Math.sin(phi) * Math.sin(theta)
	return Math.atan2(x, z)
}

/** Same-origin path; dev-server and production build serve [libs/maia-game/src/assets]/geodesic-dome.glb as /game-assets/geodesic-dome.glb */
export const GEODESIC_DOME_GLB_PATH = '/game-assets/geodesic-dome.glb'

/**
 * @param {object} opts
 * @param {number} opts.centerX
 * @param {number} opts.centerZ
 * @param {number} opts.groundY
 * @param {number} [opts.radius]
 * @param {number} [_opts.doorGapRadians] — baked into the asset; kept for API compatibility
 * @param {number} [opts.doorYaw]
 * @param {string} [opts.glbUrl] — override URL (e.g. tests)
 * @returns {Promise<{ group: import('three').Group, gardenGroup: import('three').Group, dispose: () => void }>}
 */
export async function loadGeodesicDome({
	centerX,
	centerZ,
	groundY,
	radius = 92,
	doorYaw = 0,
	glbUrl = GEODESIC_DOME_GLB_PATH,
}) {
	const url =
		typeof window !== 'undefined' && glbUrl.startsWith('/')
			? new URL(glbUrl, window.location.origin).href
			: glbUrl

	const { scene: domeRoot, gltf } = await loadGLTFScene(url)

	const group = new THREE.Group()
	group.position.set(centerX, groundY, centerZ)
	group.rotation.y = doorYaw

	domeRoot.scale.setScalar(radius)
	group.add(domeRoot)

	const gardenGroup = createDomeGardenGroup({
		domeRadius: radius,
		centerX,
		centerZ,
		groundY,
		doorYaw,
		terrainHeightAtPlaneXY,
	})
	group.add(gardenGroup)

	traverseMeshes(group, (mesh) => {
		if (mesh.name === 'DomeGardenWalkPath') {
			mesh.receiveShadow = true
			mesh.castShadow = false
			return
		}
		mesh.castShadow = true
		mesh.receiveShadow = true
	})

	function dispose() {
		group.remove(domeRoot)
		disposeGLTF(gltf)
		disposeDomeGardenGroup(gardenGroup)
		group.remove(gardenGroup)
	}

	return { group, gardenGroup, dispose }
}
