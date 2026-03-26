/**
 * maia-game — procedural heightfield terrain, carved river, height-based vertex biomes, pointer-lock WASD, wheel zoom.
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import {
	applyUnderwaterRiverTint,
	domeGardenTurfRgbMax,
	floodWaterLevel,
	grassSubBiomeTerrainRgb,
	heightBiomeRgb,
	riverCorridorRgb,
	waterSurfaceHeightAt,
} from './biomes.js'
import { createBlobCharacter } from './blob-character.js'
import {
	CHASE_MIN_ABOVE_TERRAIN,
	chaseHeightAbovePlayer,
	chaseHorizontalDistance,
	moveSpeedScaleFromCameraBlobDist,
} from './camera-chase.js'
import { updateDomeGardenPositions } from './dome-garden.js'
import { minTerrainHeightUnderRim, stepSingleDomePlayerBarrier } from './dome-placement.js'
import { setDomePlacementHighlight } from './dome-selection-tint.js'
import {
	EDGE_MARGIN,
	MOVE_SPEED,
	PLANE_HALF,
	PLANE_SIZE,
	ZOOM_ABOVE_MAX,
	ZOOM_ABOVE_MIN,
	ZOOM_WHEEL_SCALE,
} from './game-constants.js'
import { DOME_BAKED_ENTRANCE_ATAN2, loadGeodesicDome } from './geodesic-dome.js'
import { noise2 } from './noise.js'
import {
	clampPlayerToBridgeSides,
	createRiverWoodBridgeGroup,
	getBridgeWorldFootprint,
	isInBridgeCrossingWaterExemptZone,
	sampleBridgeGroundY,
} from './river-bridge.js'
import {
	findMountainTopSpawnPosition,
	terrainHeightAtPlaneXY,
	terrainPlaneWarp,
} from './terrain.js'
import { createForestInstancedMeshes, disposeForestResources } from './trees.js'
import { createRiverWaterMesh, createRiverWaterVolumeMesh } from './water-meshes.js'

const seg = 640

/** Yield so the event loop can run (navigation, input) while terrain builds. */
function yieldToMain() {
	return new Promise((resolve) => setTimeout(resolve, 0))
}

const TERRAIN_BATCH = 65536

/**
 * @param {HTMLElement} container
 * @param {{ isCancelled?: () => boolean }} [options]
 * @returns {Promise<{ dispose: () => void }>}
 */
export async function mountGame(container, { isCancelled = () => false } = {}) {
	const scene = new THREE.Scene()
	let geodesicDome = null
	let geodesicDome2 = null
	let domeMovePending = false
	/** @type {1 | 2 | null} which dome is being moved */
	let activePlacementDome = null
	/** @type {{ cx: number, cz: number, doorAngleCenter: number, gy: number, rotY: number } | null} */
	let domePlacementSnapshot = null
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

	const DEFAULT_HINT =
		'Scroll: zoom · Click look · WASD (works unlocked) · Esc unlock · Unlocked: click dome, then ground to move'

	const hint = document.createElement('div')
	hint.textContent = DEFAULT_HINT
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

	const domeCoordLabel = document.createElement('div')
	domeCoordLabel.setAttribute('aria-hidden', 'true')
	domeCoordLabel.style.display = 'none'
	Object.assign(domeCoordLabel.style, {
		position: 'fixed',
		left: '50%',
		top: '52px',
		pointerEvents: 'none',
		userSelect: 'none',
		transform: 'translateX(-50%)',
		padding: '8px 14px',
		fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
		fontSize: '12px',
		lineHeight: 1.45,
		color: '#eaf8ff',
		background: 'rgba(8, 22, 42, 0.88)',
		borderRadius: '8px',
		border: '1px solid rgba(120, 180, 220, 0.45)',
		whiteSpace: 'pre',
		boxShadow: '0 4px 18px rgba(0, 0, 0, 0.35)',
		zIndex: '2147483646',
	})
	document.body.appendChild(domeCoordLabel)

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
		if (e.code === 'Escape' && domeMovePending) {
			cancelDomePlacement()
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

	function cleanupEarlyPartial() {
		window.removeEventListener('keydown', onKeyDown)
		window.removeEventListener('keyup', onKeyUp)
		renderer.domElement.removeEventListener('wheel', onWheel)
		pointer.dispose()
		renderer.dispose()
		container.removeChild(renderer.domElement)
		if (hint.parentNode === container) container.removeChild(hint)
		if (domeCoordLabel.parentNode) domeCoordLabel.parentNode.removeChild(domeCoordLabel)
	}

	await yieldToMain()
	if (isCancelled()) {
		cleanupEarlyPartial()
		return { dispose: () => {} }
	}

	const floodLevel = floodWaterLevel()

	let terrainHeightWorker = null
	try {
		terrainHeightWorker = new Worker(new URL('./terrain-height-worker.mjs', import.meta.url), {
			type: 'module',
		})
	} catch {
		terrainHeightWorker = null
	}
	let terrainWorkerMsgId = 0

	function terminateTerrainWorker() {
		if (terrainHeightWorker) {
			terrainHeightWorker.terminate()
			terrainHeightWorker = null
		}
	}

	const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, seg, seg)
	const pos = planeGeo.attributes.position

	async function fillHeightBatch(batchStart, batchEnd) {
		if (terrainHeightWorker) {
			const n = batchEnd - batchStart
			const xs = new Float32Array(n)
			const ys = new Float32Array(n)
			for (let i = batchStart; i < batchEnd; i++) {
				const o = i - batchStart
				xs[o] = pos.getX(i)
				ys[o] = pos.getY(i)
			}
			const id = ++terrainWorkerMsgId
			const w = terrainHeightWorker
			const out = await new Promise((resolve) => {
				function onMsg(e) {
					if (e.data.id !== id) {
						return
					}
					w.removeEventListener('message', onMsg)
					resolve(e.data.out)
				}
				w.addEventListener('message', onMsg)
				w.postMessage({ id, start: batchStart, end: batchEnd, xs, ys })
			})
			for (let i = batchStart; i < batchEnd; i++) {
				pos.setZ(i, out[i - batchStart])
			}
		} else {
			for (let i = batchStart; i < batchEnd; i++) {
				const lx = pos.getX(i)
				const ly = pos.getY(i)
				pos.setZ(i, terrainHeightAtPlaneXY(lx, ly))
			}
		}
	}

	for (let start = 0; start < pos.count; start += TERRAIN_BATCH) {
		await yieldToMain()
		if (isCancelled()) {
			terminateTerrainWorker()
			cleanupEarlyPartial()
			planeGeo.dispose()
			return { dispose: () => {} }
		}
		const end = Math.min(start + TERRAIN_BATCH, pos.count)
		try {
			await fillHeightBatch(start, end)
		} catch {
			terminateTerrainWorker()
			terrainHeightWorker = null
			await fillHeightBatch(start, end)
		}
	}
	terminateTerrainWorker()
	planeGeo.computeVertexNormals()

	let vHMin = Infinity
	let vHMax = -Infinity
	for (let start = 0; start < pos.count; start += TERRAIN_BATCH) {
		await yieldToMain()
		if (isCancelled()) {
			terminateTerrainWorker()
			cleanupEarlyPartial()
			planeGeo.dispose()
			return { dispose: () => {} }
		}
		const end = Math.min(start + TERRAIN_BATCH, pos.count)
		for (let i = start; i < end; i++) {
			const h = pos.getZ(i)
			if (h < vHMin) {
				vHMin = h
			}
			if (h > vHMax) {
				vHMax = h
			}
		}
	}
	const vHSpan = vHMax - vHMin

	const DOME_RADIUS = 92
	const DOME_DOOR_GAP = 0.92
	const DOME_RIM_ABOVE_TERRAIN = 0.12
	/** Default world placement (XZ + door facing); groundY follows terrain at rim. */
	const DEFAULT_DOME_CENTER_X = -1877.615
	const DEFAULT_DOME_CENTER_Z = -1952.463
	const DEFAULT_DOME_DOOR_ANGLE_CENTER = -1.146173
	/** East-side dome: fixed default (earth plateau across the river). Ground Y still follows rim under terrain. */
	const DEFAULT_DOME2_CENTER_X = -215.89
	const DEFAULT_DOME2_CENTER_Z = 1873.222
	const DEFAULT_DOME2_DOOR_ANGLE_CENTER = -2.387471
	let domeCx = DEFAULT_DOME_CENTER_X
	let domeCz = DEFAULT_DOME_CENTER_Z
	let doorAngleCenter = DEFAULT_DOME_DOOR_ANGLE_CENTER

	let dome2Cx = DEFAULT_DOME2_CENTER_X
	let dome2Cz = DEFAULT_DOME2_CENTER_Z
	let dome2DoorAngleCenter = DEFAULT_DOME2_DOOR_ANGLE_CENTER

	const baseTerrainColors = new Float32Array(pos.count * 3)
	for (let start = 0; start < pos.count; start += TERRAIN_BATCH) {
		await yieldToMain()
		if (isCancelled()) {
			terminateTerrainWorker()
			cleanupEarlyPartial()
			planeGeo.dispose()
			return { dispose: () => {} }
		}
		const end = Math.min(start + TERRAIN_BATCH, pos.count)
		for (let i = start; i < end; i++) {
			const lx = pos.getX(i)
			const ly = pos.getY(i)
			const h = pos.getZ(i)
			const tn = vHSpan > 1e-5 ? (h - vHMin) / vHSpan : 0.5
			const { wx, wy } = terrainPlaneWarp(lx, ly)
			let rgb = heightBiomeRgb(tn)
			rgb = grassSubBiomeTerrainRgb(rgb, tn, wx, wy)
			rgb = riverCorridorRgb(wx, wy, rgb)
			rgb = applyUnderwaterRiverTint(wx, wy, h, rgb, floodLevel)
			baseTerrainColors[i * 3] = rgb.r
			baseTerrainColors[i * 3 + 1] = rgb.g
			baseTerrainColors[i * 3 + 2] = rgb.b
		}
	}
	const colors = new Float32Array(pos.count * 3)
	planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

	function refreshDomeTerrainTint() {
		const colorAttr = planeGeo.attributes.color
		const out = colorAttr.array
		const posAttr = planeGeo.attributes.position
		const innerR = DOME_RADIUS + 12
		const outerR = DOME_RADIUS + 168
		for (let i = 0; i < posAttr.count; i++) {
			const lx = posAttr.getX(i)
			const ly = posAttr.getY(i)
			const baseRgb = {
				r: baseTerrainColors[i * 3],
				g: baseTerrainColors[i * 3 + 1],
				b: baseTerrainColors[i * 3 + 2],
			}
			const rgb = domeGardenTurfRgbMax(
				lx,
				ly,
				baseRgb,
				[
					{ centerX: domeCx, centerZ: domeCz },
					{ centerX: dome2Cx, centerZ: dome2Cz },
				],
				innerR,
				outerR,
			)
			const micro = noise2(lx * 0.012, ly * 0.011) * 0.028
			out[i * 3] = THREE.MathUtils.clamp(rgb.r + micro, 0, 1)
			out[i * 3 + 1] = THREE.MathUtils.clamp(rgb.g + micro, 0, 1)
			out[i * 3 + 2] = THREE.MathUtils.clamp(rgb.b + micro * 0.75, 0, 1)
		}
		colorAttr.needsUpdate = true
	}

	let terrainTintRaf = 0
	function scheduleTerrainTint() {
		if (terrainTintRaf !== 0) {
			return
		}
		terrainTintRaf = requestAnimationFrame(() => {
			terrainTintRaf = 0
			refreshDomeTerrainTint()
		})
	}

	refreshDomeTerrainTint()

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

	const forest = createForestInstancedMeshes({
		vHMin,
		vHSpan,
		floodLevel,
		spawnX: playerX,
		spawnZ: playerZ,
	})
	for (const m of forest.meshes) {
		scene.add(m)
	}

	/** Horizontal base: lowest terrain height around the full rim avoids air gaps on slopes (uphill may intersect terrain slightly). */
	const domeGroundY =
		minTerrainHeightUnderRim(domeCx, domeCz, DOME_RADIUS, terrainHeightAtPlaneXY, 64) +
		DOME_RIM_ABOVE_TERRAIN
	const doorYaw = doorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2
	geodesicDome = await loadGeodesicDome({
		centerX: domeCx,
		centerZ: domeCz,
		groundY: domeGroundY,
		radius: DOME_RADIUS,
		doorGapRadians: DOME_DOOR_GAP,
		doorYaw,
	})
	scene.add(geodesicDome.group)

	const dome2GroundY =
		minTerrainHeightUnderRim(dome2Cx, dome2Cz, DOME_RADIUS, terrainHeightAtPlaneXY, 64) +
		DOME_RIM_ABOVE_TERRAIN
	const dome2DoorYaw = dome2DoorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2
	geodesicDome2 = await loadGeodesicDome({
		centerX: dome2Cx,
		centerZ: dome2Cz,
		groundY: dome2GroundY,
		radius: DOME_RADIUS,
		doorGapRadians: DOME_DOOR_GAP,
		doorYaw: dome2DoorYaw,
	})
	scene.add(geodesicDome2.group)

	let domeLegitInterior = false
	let dome2LegitInterior = false

	function syncDomeGarden() {
		if (!geodesicDome?.gardenGroup) {
			return
		}
		updateDomeGardenPositions(geodesicDome.gardenGroup, {
			centerX: domeCx,
			centerZ: domeCz,
			groundY: geodesicDome.group.position.y,
			doorYaw: doorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2,
			terrainHeightAtPlaneXY,
		})
	}

	function syncDomeGarden2() {
		if (!geodesicDome2?.gardenGroup) {
			return
		}
		updateDomeGardenPositions(geodesicDome2.gardenGroup, {
			centerX: dome2Cx,
			centerZ: dome2Cz,
			groundY: geodesicDome2.group.position.y,
			doorYaw: dome2DoorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2,
			terrainHeightAtPlaneXY,
		})
	}

	function updateDomeCoordLabel() {
		if (!domeMovePending) {
			domeCoordLabel.style.display = 'none'
			return
		}
		if (activePlacementDome === 1 && geodesicDome) {
			const gy = geodesicDome.group.position.y
			const rotY = geodesicDome.group.rotation.y
			domeCoordLabel.style.display = 'block'
			domeCoordLabel.textContent = [
				`dome 1`,
				`centerX   ${domeCx.toFixed(3)}`,
				`centerZ   ${domeCz.toFixed(3)}`,
				`groundY   ${gy.toFixed(4)}`,
				`rotationY ${rotY.toFixed(6)}`,
			].join('\n')
			return
		}
		if (activePlacementDome === 2 && geodesicDome2) {
			const gy = geodesicDome2.group.position.y
			const rotY = geodesicDome2.group.rotation.y
			domeCoordLabel.style.display = 'block'
			domeCoordLabel.textContent = [
				`dome 2`,
				`centerX   ${dome2Cx.toFixed(3)}`,
				`centerZ   ${dome2Cz.toFixed(3)}`,
				`groundY   ${gy.toFixed(4)}`,
				`rotationY ${rotY.toFixed(6)}`,
			].join('\n')
			return
		}
		domeCoordLabel.style.display = 'none'
	}

	/**
	 * @param {1 | 2} which
	 */
	function saveDomePlacementSnapshot(which) {
		activePlacementDome = which
		if (which === 1 && geodesicDome) {
			domePlacementSnapshot = {
				cx: domeCx,
				cz: domeCz,
				doorAngleCenter,
				gy: geodesicDome.group.position.y,
				rotY: geodesicDome.group.rotation.y,
			}
		} else if (which === 2 && geodesicDome2) {
			domePlacementSnapshot = {
				cx: dome2Cx,
				cz: dome2Cz,
				doorAngleCenter: dome2DoorAngleCenter,
				gy: geodesicDome2.group.position.y,
				rotY: geodesicDome2.group.rotation.y,
			}
		}
	}

	function cancelDomePlacement() {
		if (domePlacementSnapshot && activePlacementDome === 1 && geodesicDome) {
			domeCx = domePlacementSnapshot.cx
			domeCz = domePlacementSnapshot.cz
			doorAngleCenter = domePlacementSnapshot.doorAngleCenter
			geodesicDome.group.position.set(domeCx, domePlacementSnapshot.gy, domeCz)
			geodesicDome.group.rotation.y = domePlacementSnapshot.rotY
			syncDomeGarden()
		} else if (domePlacementSnapshot && activePlacementDome === 2 && geodesicDome2) {
			dome2Cx = domePlacementSnapshot.cx
			dome2Cz = domePlacementSnapshot.cz
			dome2DoorAngleCenter = domePlacementSnapshot.doorAngleCenter
			geodesicDome2.group.position.set(dome2Cx, domePlacementSnapshot.gy, dome2Cz)
			geodesicDome2.group.rotation.y = domePlacementSnapshot.rotY
			syncDomeGarden2()
		}
		domePlacementSnapshot = null
		activePlacementDome = null
		domeMovePending = false
		if (geodesicDome) {
			setDomePlacementHighlight(geodesicDome.group, false)
		}
		if (geodesicDome2) {
			setDomePlacementHighlight(geodesicDome2.group, false)
		}
		hint.textContent = DEFAULT_HINT
		scheduleTerrainTint()
		updateDomeCoordLabel()
	}

	function applyDomePreview(newX, newZ) {
		const lim = PLANE_HALF - EDGE_MARGIN
		const nx = THREE.MathUtils.clamp(newX, -lim, lim)
		const nz = THREE.MathUtils.clamp(newZ, -lim, lim)
		if (activePlacementDome === 1 && geodesicDome) {
			domeCx = nx
			domeCz = nz
			doorAngleCenter = Math.atan2(spawn.playerX - domeCx, spawn.playerZ - domeCz)
			const gy =
				minTerrainHeightUnderRim(domeCx, domeCz, DOME_RADIUS, terrainHeightAtPlaneXY, 64) +
				DOME_RIM_ABOVE_TERRAIN
			geodesicDome.group.position.set(domeCx, gy, domeCz)
			geodesicDome.group.rotation.y = doorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2
			syncDomeGarden()
		} else if (activePlacementDome === 2 && geodesicDome2) {
			dome2Cx = nx
			dome2Cz = nz
			dome2DoorAngleCenter = Math.atan2(spawn.playerX - dome2Cx, spawn.playerZ - dome2Cz)
			const gy =
				minTerrainHeightUnderRim(dome2Cx, dome2Cz, DOME_RADIUS, terrainHeightAtPlaneXY, 64) +
				DOME_RIM_ABOVE_TERRAIN
			geodesicDome2.group.position.set(dome2Cx, gy, dome2Cz)
			geodesicDome2.group.rotation.y = dome2DoorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2
			syncDomeGarden2()
		} else {
			return
		}
		scheduleTerrainTint()
		updateDomeCoordLabel()
	}

	function applyDomePlacement(newX, newZ) {
		applyDomePreview(newX, newZ)
		if (activePlacementDome === 1) {
			domeLegitInterior = false
		} else if (activePlacementDome === 2) {
			dome2LegitInterior = false
		}
		domeMovePending = false
		domePlacementSnapshot = null
		activePlacementDome = null
		if (geodesicDome) {
			setDomePlacementHighlight(geodesicDome.group, false)
		}
		if (geodesicDome2) {
			setDomePlacementHighlight(geodesicDome2.group, false)
		}
		hint.textContent = DEFAULT_HINT
		updateDomeCoordLabel()
	}

	function raycastHitWhichDome(hitObject) {
		let o = hitObject
		while (o) {
			if (geodesicDome && o === geodesicDome.group) {
				return 1
			}
			if (geodesicDome2 && o === geodesicDome2.group) {
				return 2
			}
			o = o.parent
		}
		return null
	}

	function requestPointerLockDeferred() {
		requestAnimationFrame(() => {
			const ret = pointer.lock()
			if (ret != null && typeof ret.then === 'function') {
				ret.catch(() => {})
			}
		})
	}

	const raycaster = new THREE.Raycaster()
	function onCanvasMoveDomePlace(e) {
		if (!domeMovePending || pointer.isLocked) {
			return
		}
		if (activePlacementDome === 1 && !geodesicDome) {
			return
		}
		if (activePlacementDome === 2 && !geodesicDome2) {
			return
		}
		const rect = renderer.domElement.getBoundingClientRect()
		const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
		const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
		raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
		const gHits = raycaster.intersectObject(ground, false)
		if (gHits.length > 0) {
			applyDomePreview(gHits[0].point.x, gHits[0].point.z)
		}
	}
	function onCanvasClickDomePlace(e) {
		if (pointer.isLocked) {
			return
		}
		const rect = renderer.domElement.getBoundingClientRect()
		const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
		const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
		raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
		if (domeMovePending) {
			const gHits = raycaster.intersectObject(ground, false)
			if (gHits.length > 0) {
				applyDomePlacement(gHits[0].point.x, gHits[0].point.z)
				return
			}
			cancelDomePlacement()
			return
		}
		const domeRoots = []
		if (geodesicDome) {
			domeRoots.push(geodesicDome.group)
		}
		if (geodesicDome2) {
			domeRoots.push(geodesicDome2.group)
		}
		if (domeRoots.length > 0) {
			const dHits = raycaster.intersectObjects(domeRoots, true)
			if (dHits.length > 0) {
				const which = raycastHitWhichDome(dHits[0].object)
				if (which === 1 || which === 2) {
					saveDomePlacementSnapshot(which)
					domeMovePending = true
					if (geodesicDome) {
						setDomePlacementHighlight(geodesicDome.group, which === 1)
					}
					if (geodesicDome2) {
						setDomePlacementHighlight(geodesicDome2.group, which === 2)
					}
					hint.textContent = 'Move mouse to preview · click terrain to place · Esc to cancel'
					updateDomeCoordLabel()
					return
				}
			}
		}
		requestPointerLockDeferred()
	}
	renderer.domElement.addEventListener('mousemove', onCanvasMoveDomePlace)
	renderer.domElement.addEventListener('click', onCanvasClickDomePlace)

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

	const woodBridge = createRiverWoodBridgeGroup()
	scene.add(woodBridge.group)

	const bridgeFp = getBridgeWorldFootprint()

	function sampleGroundYAt(px, pz) {
		return sampleBridgeGroundY(px, pz, bridgeFp)
	}

	function isMovementBlockedByWater(px, pz) {
		if (isInBridgeCrossingWaterExemptZone(px, pz, bridgeFp)) {
			return false
		}
		const lx = px
		const ly = -pz
		const { wx, wy } = terrainPlaneWarp(lx, ly)
		const h = terrainHeightAtPlaneXY(lx, ly)
		if (h >= waterSurfaceHeightAt(wx, wy, floodLevel)) {
			return false
		}
		return true
	}

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
	const blobAt = new THREE.Vector3()
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
		const playerGroundY = sampleGroundYAt(playerX, playerZ)
		const yDesired = playerGroundY + hAbovePlayer + zoomAboveGround
		const camGroundY = sampleGroundYAt(camera.position.x, camera.position.z)
		camera.position.y = Math.max(yDesired, camGroundY + CHASE_MIN_ABOVE_TERRAIN)
	}

	function animate() {
		requestId = requestAnimationFrame(animate)
		const delta = Math.min(clock.getDelta(), 0.05)

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
			const prevX = playerX
			const prevZ = playerZ
			const gyMove = sampleGroundYAt(playerX, playerZ)
			blobAt.set(playerX, gyMove, playerZ)
			const distCamBlob = camera.position.distanceTo(blobAt)
			const moveScale = moveSpeedScaleFromCameraBlobDist(distCamBlob)
			move.normalize().multiplyScalar(MOVE_SPEED * delta * moveScale)
			playerX += move.x
			playerZ += move.z
			clampPlayerXZ()
			const a1 = stepSingleDomePlayerBarrier(
				prevX,
				prevZ,
				playerX,
				playerZ,
				domeCx,
				domeCz,
				doorAngleCenter,
				domeLegitInterior,
				DOME_RADIUS,
				DOME_DOOR_GAP,
			)
			playerX = a1.x
			playerZ = a1.z
			domeLegitInterior = a1.legitInterior
			const a2 = stepSingleDomePlayerBarrier(
				prevX,
				prevZ,
				playerX,
				playerZ,
				dome2Cx,
				dome2Cz,
				dome2DoorAngleCenter,
				dome2LegitInterior,
				DOME_RADIUS,
				DOME_DOOR_GAP,
			)
			playerX = a2.x
			playerZ = a2.z
			dome2LegitInterior = a2.legitInterior
			clampPlayerXZ()
			{
				const b = clampPlayerToBridgeSides(playerX, playerZ, bridgeFp)
				playerX = b.x
				playerZ = b.z
			}
			if (isMovementBlockedByWater(playerX, playerZ)) {
				playerX = prevX
				playerZ = prevZ
			}
		}

		updateChaseCamera()

		const el = clock.getElapsedTime()
		waterMat.uniforms.uTime.value = el

		{
			const gy = sampleGroundYAt(playerX, playerZ)
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
		if (terrainTintRaf !== 0) {
			cancelAnimationFrame(terrainTintRaf)
			terrainTintRaf = 0
		}
		terminateTerrainWorker()
		cancelAnimationFrame(requestId)
		resizeObserver.disconnect()
		window.removeEventListener('keydown', onKeyDown)
		window.removeEventListener('keyup', onKeyUp)
		renderer.domElement.removeEventListener('wheel', onWheel)
		renderer.domElement.removeEventListener('mousemove', onCanvasMoveDomePlace)
		renderer.domElement.removeEventListener('click', onCanvasClickDomePlace)
		pointer.dispose()
		for (const m of forest.meshes) {
			scene.remove(m)
		}
		disposeForestResources(forest)
		if (geodesicDome) {
			scene.remove(geodesicDome.group)
			geodesicDome.dispose()
		}
		if (geodesicDome2) {
			scene.remove(geodesicDome2.group)
			geodesicDome2.dispose()
		}
		planeGeo.dispose()
		ground.material.dispose()
		floodGeo.dispose()
		floodMat.dispose()
		waterVolGeo.dispose()
		waterVolMat.dispose()
		waterGeo.dispose()
		waterMat.dispose()
		scene.remove(woodBridge.group)
		woodBridge.dispose()
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
		if (domeCoordLabel.parentNode) {
			domeCoordLabel.parentNode.removeChild(domeCoordLabel)
		}
	}

	return { dispose }
}
