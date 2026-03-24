/**
 * maia-game — grass terrain + pointer-lock WASD (clamped on plane, eye above ground).
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

const PLANE_SIZE = 4000
const PLANE_HALF = PLANE_SIZE / 2
const EDGE_MARGIN = 8
const MOVE_SPEED = 140
const EYE_HEIGHT = 2.2
const RAY_UP = 4000

/** Deterministic 0–1 hash for float coords (smooth-ish when interpolated). */
function hash2(ix, iy) {
	const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123
	return n - Math.floor(n)
}

/** Value noise with smooth interpolation (macro terrain / texture). */
function noise2(x, y) {
	const x0 = Math.floor(x)
	const y0 = Math.floor(y)
	const fx = x - x0
	const fy = y - y0
	const u = fx * fx * (3 - 2 * fx)
	const v = fy * fy * (3 - 2 * fy)
	const a = hash2(x0, y0)
	const b = hash2(x0 + 1, y0)
	const c = hash2(x0, y0 + 1)
	const d = hash2(x0 + 1, y0 + 1)
	const i1 = a + (b - a) * u
	const i2 = c + (d - c) * u
	return i1 + (i2 - i1) * v
}

/** ~FBM: several octaves of value noise. */
function fbm2(x, y) {
	let sum = 0
	let amp = 0.55
	let freq = 0.012
	let norm = 0
	for (let o = 0; o < 6; o++) {
		sum += amp * (noise2(x * freq, y * freq) - 0.5) * 2
		norm += amp
		amp *= 0.48
		freq *= 2.05
	}
	return sum / Math.max(norm, 1e-6)
}

/** World-space terrain height (matches mesh displacement; plane lies in local XY, then rotated). */
function terrainHeightAtPlaneXY(lx, ly) {
	const n = fbm2(lx * 0.004, ly * 0.004)
	const ridges = Math.sin(lx * 0.0018 + n * 2.1) * Math.cos(ly * 0.0016 - n * 1.4) * 4.2
	return n * 22 + ridges
}

/**
 * Albedo + roughness from shared height field (no external assets).
 * Normal maps are omitted: procedural tangents rarely match Three’s TBN and wrong colorSpace breaks lighting (black terrain).
 * @param {number} size
 */
function makeTerrainTextures(size) {
	const color = document.createElement('canvas')
	color.width = size
	color.height = size
	const rough = document.createElement('canvas')
	rough.width = size
	rough.height = size

	const cctx = color.getContext('2d')
	const rctx = rough.getContext('2d')
	if (!cctx || !rctx) {
		return { color, rough }
	}

	const heights = new Float32Array(size * size)

	for (let py = 0; py < size; py++) {
		for (let px = 0; px < size; px++) {
			const u = px / (size - 1)
			const v = py / (size - 1)
			const wx = (u - 0.5) * 2
			const wy = (v - 0.5) * 2
			const lx = wx * 120
			const ly = wy * 120
			const h = terrainHeightAtPlaneXY(lx, ly)
			heights[py * size + px] = h
		}
	}

	const imgC = cctx.createImageData(size, size)
	const imgR = rctx.createImageData(size, size)

	const du = 1
	const dv = 1

	for (let py = 0; py < size; py++) {
		for (let px = 0; px < size; px++) {
			const idx = py * size + px
			const h = heights[idx]
			const hx1 = heights[py * size + Math.min(px + du, size - 1)]
			const hx0 = heights[py * size + Math.max(px - du, 0)]
			const hy1 = heights[Math.min(py + dv, size - 1) * size + px]
			const hy0 = heights[Math.max(py - dv, 0) * size + px]
			const dhx = (hx1 - hx0) * 0.5
			const dhy = (hy1 - hy0) * 0.5

			const slope = Math.min(1, Math.sqrt(dhx * dhx + dhy * dhy) * 0.08)
			const wet = Math.max(0, -h * 0.015 + slope * 0.4)

			const grassDark = { r: 0.12, g: 0.28, b: 0.08 }
			const grassMid = { r: 0.18, g: 0.42, b: 0.14 }
			const grassLight = { r: 0.32, g: 0.55, b: 0.22 }
			const soil = { r: 0.22, g: 0.16, b: 0.1 }

			const t = h * 0.018 + 0.5
			const g1 = Math.max(0, Math.min(1, t))
			let rCol = grassDark.r + (grassMid.r - grassDark.r) * g1
			let gCol = grassDark.g + (grassMid.g - grassDark.g) * g1
			let bCol = grassDark.b + (grassMid.b - grassDark.b) * g1
			const lift = Math.max(0, h * 0.008)
			rCol += (grassLight.r - grassMid.r) * lift * 0.35
			gCol += (grassLight.g - grassMid.g) * lift * 0.35
			bCol += (grassLight.b - grassMid.b) * lift * 0.35

			const soilMix = slope * 0.55 + wet * 0.35
			rCol = rCol * (1 - soilMix) + soil.r * soilMix
			gCol = gCol * (1 - soilMix) + soil.g * soilMix
			bCol = bCol * (1 - soilMix) + soil.b * soilMix

			const micro = noise2(px * 0.2, py * 0.2) * 0.06
			rCol += micro
			gCol += micro
			bCol += micro * 0.5

			const i = idx * 4
			imgC.data[i] = Math.floor(THREE.MathUtils.clamp(rCol, 0, 1) * 255)
			imgC.data[i + 1] = Math.floor(THREE.MathUtils.clamp(gCol, 0, 1) * 255)
			imgC.data[i + 2] = Math.floor(THREE.MathUtils.clamp(bCol, 0, 1) * 255)
			imgC.data[i + 3] = 255

			const roughV = THREE.MathUtils.clamp(0.72 + slope * 0.22 - wet * 0.12, 0.35, 1)
			const rv = Math.floor(roughV * 255)
			imgR.data[i] = rv
			imgR.data[i + 1] = rv
			imgR.data[i + 2] = rv
			imgR.data[i + 3] = 255
		}
	}

	cctx.putImageData(imgC, 0, 0)
	rctx.putImageData(imgR, 0, 0)

	return { color, rough }
}

/**
 * @param {HTMLElement} container
 * @returns {{ dispose: () => void }}
 */
export function mountGame(container) {
	const scene = new THREE.Scene()
	scene.background = new THREE.Color(0x9ec8e8)
	scene.fog = new THREE.Fog(0xa8d0e8, 1200, 5200)

	const camera = new THREE.PerspectiveCamera(
		50,
		container.clientWidth / Math.max(container.clientHeight, 1),
		0.1,
		12000,
	)
	camera.position.set(0, EYE_HEIGHT + 1.5, 12)

	const renderer = new THREE.WebGLRenderer({ antialias: true })
	renderer.setSize(container.clientWidth, container.clientHeight)
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
	renderer.outputColorSpace = THREE.SRGBColorSpace
	renderer.toneMapping = THREE.ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.08
	renderer.shadowMap.enabled = true
	renderer.shadowMap.type = THREE.PCFSoftShadowMap
	container.appendChild(renderer.domElement)

	const pointer = new PointerLockControls(camera, renderer.domElement)

	const hint = document.createElement('div')
	hint.textContent = 'Click — look · WASD move · Esc unlock'
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

	const seg = 192
	const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, seg, seg)
	const pos = planeGeo.attributes.position
	for (let i = 0; i < pos.count; i++) {
		const lx = pos.getX(i)
		const ly = pos.getY(i)
		const h = terrainHeightAtPlaneXY(lx, ly)
		pos.setZ(i, -h)
	}
	planeGeo.computeVertexNormals()

	const TEX = 512
	const { color: grassColorCanvas, rough: grassRoughCanvas } = makeTerrainTextures(TEX)

	const grassTex = new THREE.CanvasTexture(grassColorCanvas)
	grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping
	grassTex.repeat.set(28, 28)
	grassTex.colorSpace = THREE.SRGBColorSpace
	grassTex.anisotropy = renderer.capabilities.getMaxAnisotropy()
	grassTex.needsUpdate = true

	const roughTex = new THREE.CanvasTexture(grassRoughCanvas)
	roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping
	roughTex.repeat.copy(grassTex.repeat)
	roughTex.colorSpace = THREE.NoColorSpace
	roughTex.needsUpdate = true

	const ground = new THREE.Mesh(
		planeGeo,
		new THREE.MeshStandardMaterial({
			map: grassTex,
			roughnessMap: roughTex,
			roughness: 1,
			metalness: 0,
			envMapIntensity: 0.4,
			side: THREE.DoubleSide,
		}),
	)
	ground.rotation.x = -Math.PI / 2
	ground.receiveShadow = true
	scene.add(ground)

	const raycaster = new THREE.Raycaster()
	const rayOrigin = new THREE.Vector3()
	const down = new THREE.Vector3(0, -1, 0)

	const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5c3a, 0.55)
	scene.add(hemi)
	const amb = new THREE.AmbientLight(0xe8f2ff, 0.42)
	scene.add(amb)
	const sun = new THREE.DirectionalLight(0xfff5e6, 1.35)
	sun.position.set(520, 1100, 380)
	sun.castShadow = true
	sun.shadow.mapSize.set(4096, 4096)
	sun.shadow.bias = -0.00015
	sun.shadow.camera.near = 10
	sun.shadow.camera.far = 4500
	const sc = 2200
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

	function clampXZ(v) {
		const lim = PLANE_HALF - EDGE_MARGIN
		v.x = THREE.MathUtils.clamp(v.x, -lim, lim)
		v.z = THREE.MathUtils.clamp(v.z, -lim, lim)
	}

	function snapEyeToGround() {
		rayOrigin.set(camera.position.x, RAY_UP, camera.position.z)
		raycaster.set(rayOrigin, down)
		const hits = raycaster.intersectObject(ground, false)
		const y = hits.length > 0 ? hits[0].point.y + EYE_HEIGHT : EYE_HEIGHT
		camera.position.y = y
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
				camera.position.add(move)
				clampXZ(camera.position)
			}
		}

		snapEyeToGround()

		renderer.render(scene, camera)
	}
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
		pointer.dispose()
		grassTex.dispose()
		roughTex.dispose()
		planeGeo.dispose()
		ground.material.dispose()
		renderer.dispose()
		container.removeChild(renderer.domElement)
		if (hint.parentNode === container) {
			container.removeChild(hint)
		}
	}

	return { dispose }
}
