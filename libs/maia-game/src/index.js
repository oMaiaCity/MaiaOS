/**
 * maia-game — procedural heightfield terrain, carved river, height-based vertex biomes, pointer-lock WASD, wheel zoom.
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import {
	applyUnderwaterRiverTint,
	floodWaterLevel,
	heightBiomeRgb,
	riverCorridorRgb,
} from './biomes.js'
import { createBlobCharacter } from './blob-character.js'
import {
	CHASE_MIN_ABOVE_TERRAIN,
	chaseHeightAbovePlayer,
	chaseHorizontalDistance,
} from './camera-chase.js'
import {
	EDGE_MARGIN,
	MOVE_SPEED,
	PLANE_HALF,
	PLANE_SIZE,
	ZOOM_ABOVE_MAX,
	ZOOM_ABOVE_MIN,
	ZOOM_WHEEL_SCALE,
} from './game-constants.js'
import { noise2 } from './noise.js'
import {
	findMountainTopSpawnPosition,
	terrainHeightAtPlaneXY,
	terrainPlaneWarp,
} from './terrain.js'
import { createRiverWaterMesh, createRiverWaterVolumeMesh } from './water-meshes.js'

const seg = 768

/**
 * @param {HTMLElement} container
 * @returns {{ dispose: () => void }}
 */
export function mountGame(container) {
	const scene = new THREE.Scene()
	scene.background = new THREE.Color(0x9ec8e8)
	scene.fog = new THREE.Fog(0xa8d0e8, 2400, 10400)

	const camera = new THREE.PerspectiveCamera(
		50,
		container.clientWidth / Math.max(container.clientHeight, 1),
		0.5,
		16000,
	)
	const spawn = findMountainTopSpawnPosition()
	let playerX = spawn.playerX
	let playerZ = spawn.playerZ

	const renderer = new THREE.WebGLRenderer({ antialias: true })
	renderer.setSize(container.clientWidth, container.clientHeight)
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
	renderer.outputColorSpace = THREE.SRGBColorSpace
	renderer.toneMapping = THREE.ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.08
	renderer.shadowMap.enabled = true
	renderer.shadowMap.type = THREE.PCFShadowMap
	container.appendChild(renderer.domElement)

	const pointer = new PointerLockControls(camera, renderer.domElement)

	const hint = document.createElement('div')
	hint.textContent = 'Scroll: zoom view · Click look · WASD · Esc unlock'
	Object.assign(hint.style, {
		position: 'absolute',
		left: '12px',
		bottom: '12px',
		padding: '8px 12px',
		fontFamily: 'system-ui, sans-serif',
		fontSize: '13px',
		color: '#e8f4e0',
		background: 'rgba(12, 28, 14, 0.55)',
		borderRadius: '8px',
		pointerEvents: 'none',
		userSelect: 'none',
	})
	container.style.position = 'relative'
	container.appendChild(hint)

	renderer.domElement.addEventListener('click', () => {
		if (!pointer.isLocked) {
			const ret = pointer.lock()
			if (ret != null && typeof ret.then === 'function') {
				ret.catch(() => {})
			}
		}
	})

	pointer.addEventListener('lock', () => {
		hint.style.opacity = '0.35'
	})
	pointer.addEventListener('unlock', () => {
		hint.style.opacity = '1'
	})

	const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false }
	function onKeyDown(e) {
		if (e.code in keys) {
			keys[e.code] = true
		}
	}
	function onKeyUp(e) {
		if (e.code in keys) {
			keys[e.code] = false
		}
	}
	window.addEventListener('keydown', onKeyDown)
	window.addEventListener('keyup', onKeyUp)

	let zoomAboveGround = 0

	function onWheel(e) {
		e.preventDefault()
		zoomAboveGround = THREE.MathUtils.clamp(
			zoomAboveGround + e.deltaY * ZOOM_WHEEL_SCALE,
			ZOOM_ABOVE_MIN,
			ZOOM_ABOVE_MAX,
		)
	}
	renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

	const floodLevel = floodWaterLevel()

	const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, seg, seg)
	const pos = planeGeo.attributes.position
	for (let i = 0; i < pos.count; i++) {
		const lx = pos.getX(i)
		const ly = pos.getY(i)
		const h = terrainHeightAtPlaneXY(lx, ly)
		pos.setZ(i, h)
	}
	planeGeo.computeVertexNormals()

	let vHMin = Infinity
	let vHMax = -Infinity
	for (let i = 0; i < pos.count; i++) {
		const h = pos.getZ(i)
		if (h < vHMin) {
			vHMin = h
		}
		if (h > vHMax) {
			vHMax = h
		}
	}
	const hSpan = vHMax - vHMin
	const colors = new Float32Array(pos.count * 3)
	for (let i = 0; i < pos.count; i++) {
		const lx = pos.getX(i)
		const ly = pos.getY(i)
		const h = pos.getZ(i)
		const tn = hSpan > 1e-5 ? (h - vHMin) / hSpan : 0.5
		const { wx, wy } = terrainPlaneWarp(lx, ly)
		let rgb = heightBiomeRgb(tn)
		rgb = riverCorridorRgb(wx, wy, rgb)
		rgb = applyUnderwaterRiverTint(wx, wy, h, rgb, floodLevel)
		const micro = noise2(lx * 0.012, ly * 0.011) * 0.028
		colors[i * 3] = THREE.MathUtils.clamp(rgb.r + micro, 0, 1)
		colors[i * 3 + 1] = THREE.MathUtils.clamp(rgb.g + micro, 0, 1)
		colors[i * 3 + 2] = THREE.MathUtils.clamp(rgb.b + micro * 0.75, 0, 1)
	}
	planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

	const ground = new THREE.Mesh(
		planeGeo,
		new THREE.MeshStandardMaterial({
			vertexColors: true,
			roughness: 0.82,
			metalness: 0,
			envMapIntensity: 0.4,
			side: THREE.FrontSide,
		}),
	)
	ground.rotation.x = -Math.PI / 2
	ground.receiveShadow = true
	ground.castShadow = true
	scene.add(ground)

	const floodGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 1, 1)
	const floodPos = floodGeo.attributes.position
	for (let i = 0; i < floodPos.count; i++) {
		floodPos.setZ(i, floodLevel)
	}
	floodGeo.computeVertexNormals()
	const floodMat = new THREE.MeshPhysicalMaterial({
		color: 0x0a5a6e,
		transparent: true,
		opacity: 0.48,
		roughness: 0.45,
		metalness: 0,
		side: THREE.DoubleSide,
		depthWrite: false,
		fog: true,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 2,
	})
	const floodMesh = new THREE.Mesh(floodGeo, floodMat)
	floodMesh.rotation.x = -Math.PI / 2
	floodMesh.renderOrder = 0
	scene.add(floodMesh)

	const { mesh: waterVolMesh, geo: waterVolGeo, mat: waterVolMat } = createRiverWaterVolumeMesh()
	scene.add(waterVolMesh)

	const { mesh: waterMesh, geo: waterGeo, mat: waterMat } = createRiverWaterMesh(scene.fog)
	scene.add(waterMesh)

	const blobParts = createBlobCharacter()
	scene.add(blobParts.group)

	const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5c3a, 0.55)
	scene.add(hemi)
	const amb = new THREE.AmbientLight(0xe8f2ff, 0.38)
	scene.add(amb)
	const sun = new THREE.DirectionalLight(0xfff5e6, 1.45)
	sun.position.set(520, 1100, 380)
	sun.castShadow = true
	sun.shadow.mapSize.set(2048, 2048)
	sun.shadow.bias = -0.0002
	sun.shadow.camera.near = 10
	sun.shadow.camera.far = 16000
	const sc = 4200
	sun.shadow.camera.left = -sc
	sun.shadow.camera.right = sc
	sun.shadow.camera.top = sc
	sun.shadow.camera.bottom = -sc
	scene.add(sun)

	const forward = new THREE.Vector3()
	const right = new THREE.Vector3()
	const move = new THREE.Vector3()
	const clock = new THREE.Clock()

	let requestId = 0

	function clampPlayerXZ() {
		const lim = PLANE_HALF - EDGE_MARGIN
		playerX = THREE.MathUtils.clamp(playerX, -lim, lim)
		playerZ = THREE.MathUtils.clamp(playerZ, -lim, lim)
	}

	function updateChaseCamera() {
		camera.getWorldDirection(forward)
		const horizontal = Math.hypot(forward.x, forward.z)
		const pitchUp = horizontal > 1e-8 ? Math.atan2(forward.y, horizontal) : 0
		const r = chaseHorizontalDistance(pitchUp)
		const hAbovePlayer = chaseHeightAbovePlayer(pitchUp)
		forward.y = 0
		if (forward.lengthSq() > 1e-6) {
			forward.normalize()
		} else {
			forward.set(0, 0, -1)
		}
		camera.position.x = playerX + forward.x * -r
		camera.position.z = playerZ + forward.z * -r
		const playerGroundY = terrainHeightAtPlaneXY(playerX, -playerZ)
		const yDesired = playerGroundY + hAbovePlayer + zoomAboveGround
		const camGroundY = terrainHeightAtPlaneXY(camera.position.x, -camera.position.z)
		camera.position.y = Math.max(yDesired, camGroundY + CHASE_MIN_ABOVE_TERRAIN)
	}

	function animate() {
		requestId = requestAnimationFrame(animate)
		const delta = Math.min(clock.getDelta(), 0.05)

		if (pointer.isLocked) {
			camera.getWorldDirection(forward)
			forward.y = 0
			if (forward.lengthSq() > 1e-6) {
				forward.normalize()
			} else {
				forward.set(0, 0, -1)
			}
			right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

			move.set(0, 0, 0)
			if (keys.KeyW) move.add(forward)
			if (keys.KeyS) move.sub(forward)
			if (keys.KeyD) move.add(right)
			if (keys.KeyA) move.sub(right)
			if (move.lengthSq() > 0) {
				move.normalize().multiplyScalar(MOVE_SPEED * delta)
				playerX += move.x
				playerZ += move.z
				clampPlayerXZ()
			}
		}

		updateChaseCamera()

		const el = clock.getElapsedTime()
		waterMat.uniforms.uTime.value = el

		{
			const lx = playerX
			const ly = -playerZ
			const gy = terrainHeightAtPlaneXY(lx, ly)
			blobParts.group.position.set(playerX, gy, playerZ)
			camera.getWorldDirection(forward)
			forward.y = 0
			if (forward.lengthSq() > 1e-6) {
				forward.normalize()
			} else {
				forward.set(0, 0, -1)
			}
			blobParts.group.rotation.y = Math.atan2(forward.x, forward.z)
			const wobble = Math.sin(el * 3) * 0.02
			blobParts.body.scale.set(
				1.15 * (1 - wobble * 0.5),
				1.15 * (1 + wobble),
				1.15 * (1 - wobble * 0.5),
			)
			blobParts.group.rotation.x = wobble * 0.35
		}

		renderer.render(scene, camera)
	}
	updateChaseCamera()
	animate()

	function onResize() {
		const w = container.clientWidth
		const h = Math.max(container.clientHeight, 1)
		camera.aspect = w / h
		camera.updateProjectionMatrix()
		renderer.setSize(w, h)
	}

	const resizeObserver = new ResizeObserver(onResize)
	resizeObserver.observe(container)

	function dispose() {
		cancelAnimationFrame(requestId)
		resizeObserver.disconnect()
		window.removeEventListener('keydown', onKeyDown)
		window.removeEventListener('keyup', onKeyUp)
		renderer.domElement.removeEventListener('wheel', onWheel)
		pointer.dispose()
		planeGeo.dispose()
		ground.material.dispose()
		floodGeo.dispose()
		floodMat.dispose()
		waterVolGeo.dispose()
		waterVolMat.dispose()
		waterGeo.dispose()
		waterMat.dispose()
		scene.remove(blobParts.group)
		blobParts.bodyGeo.dispose()
		blobParts.bodyMat.dispose()
		blobParts.eyeGeo.dispose()
		blobParts.eyeMat.dispose()
		renderer.dispose()
		container.removeChild(renderer.domElement)
		if (hint.parentNode === container) {
			container.removeChild(hint)
		}
	}

	return { dispose }
}
