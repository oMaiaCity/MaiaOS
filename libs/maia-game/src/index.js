/**
 * maia-game — procedural heightfield terrain, carved river, height-based vertex biomes, pointer-lock WASD, wheel zoom.
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import {
	applyUnderwaterRiverTint,
	domeGardenTurfRgb,
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
import { minTerrainHeightUnderRim } from './dome-placement.js'
import { applyDomeRimCollision } from './dome-player-collision.js'
import { setDomePlacementHighlight } from './dome-selection-tint.js'
import {
	EDGE_MARGIN,
	MOVE_ACCEL_TAU,
	MOVE_DECEL_TAU,
	MOVE_SPEED,
	PLANE_HALF,
	PLANE_SIZE,
	ZOOM_ABOVE_MAX,
	ZOOM_ABOVE_MIN,
	ZOOM_SMOOTH_TAU,
	ZOOM_WHEEL_SCALE,
} from './game-constants.js'
import { advanceTick, createTickState } from './game-tick.js'
import { DOME_BAKED_ENTRANCE_ATAN2, loadGeodesicDome } from './geodesic-dome.js'
import { noise2 } from './noise.js'
import { oppositeBankPlaneXY, oreDomePlaneXYDry } from './river-bank.js'
import { createSpringMouthGroup } from './river-spring.js'
import {
	findMountainTopSpawnPosition,
	terrainHeightAtPlaneXY,
	terrainPlaneWarp,
} from './terrain.js'
import { createForestInstancedMeshes, disposeForestResources } from './trees.js'
import { createRiverWaterMesh, createRiverWaterVolumeMesh } from './water-meshes.js'
import { seaLevel } from './water-surface.js'

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
	/** Movable wood dome (player placement). */
	let woodDome = null
	let oreDome = null
	let domeMovePending = false
	/** Which dome is being moved (`null` when not in placement mode). */
	let placementDomeKind = /** @type {null | 'wood' | 'ore'} */ (null)
	/** @type {{ kind: 'wood' | 'ore', cx: number, cz: number, doorAngleCenter: number, gy: number, rotY: number } | null} */
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

	/** Browsers reject re-lock immediately after Esc; defer + swallow promise rejections. */
	let pointerLockCooldownUntil = 0
	function onPointerLockChange() {
		if (!document.pointerLockElement) {
			pointerLockCooldownUntil = performance.now() + 450
		}
	}
	function onPointerLockError() {
		// Avoid noisy unhandled rejections when lock is not allowed.
	}
	document.addEventListener('pointerlockchange', onPointerLockChange)
	document.addEventListener('pointerlockerror', onPointerLockError)

	function swallowPointerLockRejection(e) {
		const r = e.reason
		const msg = r && typeof r.message === 'string' ? r.message : String(r)
		if (
			r &&
			(r.name === 'SecurityError' || msg.includes('Pointer lock') || msg.includes('pointer lock'))
		) {
			e.preventDefault()
		}
	}
	window.addEventListener('unhandledrejection', swallowPointerLockRejection)

	function tryPointerLock() {
		if (pointer.isLocked) {
			return
		}
		const run = () => {
			try {
				const p = pointer.lock()
				if (p != null && typeof p.then === 'function') {
					void p.catch(() => {})
				}
			} catch {
				// Sync SecurityError
			}
		}
		const now = performance.now()
		if (now < pointerLockCooldownUntil) {
			window.setTimeout(run, Math.max(0, pointerLockCooldownUntil - now + 80))
			return
		}
		run()
	}

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

	/** HUD compass: +X is world north; rose rotates so N tracks it. */
	const compassWrap = document.createElement('div')
	compassWrap.setAttribute('role', 'img')
	compassWrap.setAttribute('aria-label', 'Compass: N is world north (+X)')
	Object.assign(compassWrap.style, {
		position: 'absolute',
		top: '12px',
		right: '12px',
		width: '76px',
		height: '76px',
		borderRadius: '50%',
		border: '1px solid rgba(120, 180, 220, 0.45)',
		background: 'rgba(8, 22, 42, 0.88)',
		boxShadow: '0 4px 18px rgba(0, 0, 0, 0.25)',
		pointerEvents: 'none',
		userSelect: 'none',
		zIndex: '2',
	})
	const compassRose = document.createElement('div')
	Object.assign(compassRose.style, {
		position: 'absolute',
		inset: '0',
		transformOrigin: '50% 50%',
	})
	function addCompassLetter(ch, style) {
		const el = document.createElement('span')
		el.textContent = ch
		Object.assign(el.style, {
			position: 'absolute',
			fontFamily: 'system-ui, sans-serif',
			fontSize: '11px',
			fontWeight: '600',
			color: ch === 'N' ? '#ffcc66' : '#cfe8ff',
			textShadow: '0 0 6px rgba(0, 0, 0, 0.55)',
			...style,
		})
		compassRose.appendChild(el)
	}
	addCompassLetter('N', { top: '6px', left: '50%', transform: 'translateX(-50%)' })
	addCompassLetter('E', { right: '8px', top: '50%', transform: 'translateY(-50%)' })
	addCompassLetter('S', { bottom: '6px', left: '50%', transform: 'translateX(-50%)' })
	addCompassLetter('W', { left: '8px', top: '50%', transform: 'translateY(-50%)' })
	compassWrap.appendChild(compassRose)
	container.appendChild(compassWrap)

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
	let zoomTarget = 0

	function onWheel(e) {
		e.preventDefault()
		zoomTarget = THREE.MathUtils.clamp(
			zoomTarget + e.deltaY * ZOOM_WHEEL_SCALE,
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
		if (compassWrap.parentNode === container) container.removeChild(compassWrap)
		if (domeCoordLabel.parentNode) domeCoordLabel.parentNode.removeChild(domeCoordLabel)
	}

	await yieldToMain()
	if (isCancelled()) {
		cleanupEarlyPartial()
		return { dispose: () => {} }
	}

	const seaLevelValue = seaLevel()

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
	/** Default world placement (XZ + door facing + rim height). */
	const DEFAULT_DOME_CENTER_X = -53.22
	const DEFAULT_DOME_CENTER_Z = -1515.529
	const DEFAULT_DOME_GROUND_Y = 43.9439
	const DEFAULT_DOME_DOOR_ANGLE_CENTER = -1.51547
	let domeCx = DEFAULT_DOME_CENTER_X
	let domeCz = DEFAULT_DOME_CENTER_Z
	let doorAngleCenter = DEFAULT_DOME_DOOR_ANGLE_CENTER

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
			rgb = applyUnderwaterRiverTint(wx, wy, h, rgb)
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
			const rgb = domeGardenTurfRgb(lx, ly, baseRgb, domeCx, domeCz, innerR, outerR)
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
		spawnX: playerX,
		spawnZ: playerZ,
	})
	for (const m of forest.meshes) {
		scene.add(m)
	}

	const domeGroundY = DEFAULT_DOME_GROUND_Y
	const doorYaw = doorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2
	woodDome = await loadGeodesicDome({
		centerX: domeCx,
		centerZ: domeCz,
		groundY: domeGroundY,
		radius: DOME_RADIUS,
		doorGapRadians: DOME_DOOR_GAP,
		doorYaw,
	})
	scene.add(woodDome.group)

	const defaultPlaneLy = -DEFAULT_DOME_CENTER_Z
	const pickOrePlane =
		typeof oreDomePlaneXYDry === 'function' ? oreDomePlaneXYDry : oppositeBankPlaneXY
	const { lx: orePlaneLx, ly: orePlaneLy } = pickOrePlane(
		DEFAULT_DOME_CENTER_X,
		defaultPlaneLy,
		DOME_RADIUS + 10,
	)
	let oreCx = orePlaneLx
	let oreCz = -orePlaneLy
	let oreDoorAngleCenter = Math.atan2(spawn.playerX - oreCx, spawn.playerZ - oreCz)
	const oreGroundY =
		minTerrainHeightUnderRim(oreCx, oreCz, DOME_RADIUS, terrainHeightAtPlaneXY, 64) +
		DOME_RIM_ABOVE_TERRAIN
	const oreDoorYaw = oreDoorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2
	oreDome = await loadGeodesicDome({
		centerX: oreCx,
		centerZ: oreCz,
		groundY: oreGroundY,
		radius: DOME_RADIUS,
		doorGapRadians: DOME_DOOR_GAP,
		doorYaw: oreDoorYaw,
	})
	scene.add(oreDome.group)
	if (oreDome.gardenGroup) {
		updateDomeGardenPositions(oreDome.gardenGroup, {
			centerX: oreCx,
			centerZ: oreCz,
			groundY: oreDome.group.position.y,
			doorYaw: oreDoorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2,
			terrainHeightAtPlaneXY,
		})
	}

	const tickState = createTickState()
	const tickHud = document.createElement('div')
	Object.assign(tickHud.style, {
		position: 'absolute',
		top: '12px',
		left: '12px',
		zIndex: '2147483645',
		padding: '10px 14px',
		fontFamily: 'system-ui, sans-serif',
		fontSize: '14px',
		color: '#f0f8e8',
		background: 'rgba(14, 28, 18, 0.75)',
		borderRadius: '10px',
		display: 'flex',
		flexDirection: 'column',
		gap: '8px',
		alignItems: 'flex-start',
		pointerEvents: 'auto',
	})
	const tickLabelEl = document.createElement('div')
	const nextTickBtn = document.createElement('button')
	nextTickBtn.type = 'button'
	nextTickBtn.textContent = 'Next tick'
	Object.assign(nextTickBtn.style, {
		padding: '6px 12px',
		fontSize: '13px',
		cursor: 'pointer',
		borderRadius: '6px',
		border: '1px solid rgba(120, 180, 140, 0.6)',
		background: 'rgba(30, 56, 38, 0.95)',
		color: '#e8f4e0',
	})
	function refreshTickHud() {
		tickLabelEl.textContent = `Tick ${tickState.tick}`
	}
	/** @type {{ el: HTMLDivElement, getCount: () => number }[]} */
	const resourceSlotCountEls = []
	function refreshInventoryHud() {
		for (const { el, getCount } of resourceSlotCountEls) {
			el.textContent = String(getCount())
		}
	}
	function onNextTickClick() {
		advanceTick(tickState)
		refreshTickHud()
		refreshInventoryHud()
	}
	refreshTickHud()
	nextTickBtn.addEventListener('click', onNextTickClick)
	tickHud.appendChild(tickLabelEl)
	tickHud.appendChild(nextTickBtn)
	container.appendChild(tickHud)

	const inventoryHud = document.createElement('div')
	inventoryHud.setAttribute('role', 'status')
	inventoryHud.setAttribute('aria-label', 'City resources')
	Object.assign(inventoryHud.style, {
		position: 'absolute',
		left: '50%',
		bottom: '12px',
		transform: 'translateX(-50%)',
		zIndex: '2147483645',
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		padding: '8px 10px',
		background: 'rgba(8, 22, 42, 0.88)',
		borderRadius: '10px',
		border: '1px solid rgba(120, 180, 220, 0.45)',
		boxShadow: '0 4px 18px rgba(0, 0, 0, 0.25)',
		pointerEvents: 'none',
		userSelect: 'none',
	})
	const SLOT_PX = 48
	const resourceDefs = [
		{
			id: 'wood',
			title: 'Wood',
			getCount: () => tickState.wood,
			iconSvg:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="#5c4030" d="M5 6h14v12H5z"/><path fill="#8b6914" d="M7 8h10v8H7z"/><path fill="#4a3528" d="M8 9h1v6H8zm3 0h1v6h-1zm3 0h1v6h-1zm3 0h1v6h-1z"/></svg>',
		},
		{
			id: 'ore',
			title: 'Ore',
			getCount: () => tickState.ore,
			iconSvg:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="#6b7380" d="M12 3l7 4v10l-7 4-7-4V7z"/><path fill="#9aa3b8" d="M12 6.2L7.5 8.8v6.4L12 18l4.5-2.8V8.8z"/><path fill="#c8d0e0" d="M10 9h2v2h-2zm2 3h2v2h-2z"/></svg>',
		},
	]
	for (const def of resourceDefs) {
		const slot = document.createElement('div')
		slot.title = def.title
		Object.assign(slot.style, {
			position: 'relative',
			width: `${SLOT_PX}px`,
			height: `${SLOT_PX}px`,
			flexShrink: '0',
			borderRadius: '4px',
			border: '1px solid rgba(80, 120, 160, 0.55)',
			background: 'rgba(4, 14, 28, 0.65)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			boxSizing: 'border-box',
		})
		const iconWrap = document.createElement('div')
		iconWrap.innerHTML = def.iconSvg
		const svg = iconWrap.firstElementChild
		if (svg) {
			svg.style.display = 'block'
			svg.style.opacity = '0.95'
		}
		slot.appendChild(iconWrap)
		const countEl = document.createElement('div')
		Object.assign(countEl.style, {
			position: 'absolute',
			right: '3px',
			bottom: '1px',
			fontFamily: 'ui-monospace, monospace, system-ui, sans-serif',
			fontSize: '12px',
			fontWeight: '700',
			color: '#ffffff',
			textShadow: '1px 1px 0 #1a1a1a, -1px -1px 0 #1a1a1a, 1px -1px 0 #1a1a1a, -1px 1px 0 #1a1a1a',
			lineHeight: '1',
			pointerEvents: 'none',
		})
		countEl.textContent = '0'
		slot.appendChild(countEl)
		resourceSlotCountEls.push({ el: countEl, getCount: def.getCount })
		inventoryHud.appendChild(slot)
	}
	refreshInventoryHud()
	container.appendChild(inventoryHud)

	const labelWood = document.createElement('div')
	const labelOre = document.createElement('div')
	for (const el of [labelWood, labelOre]) {
		Object.assign(el.style, {
			position: 'fixed',
			pointerEvents: 'none',
			userSelect: 'none',
			padding: '6px 10px',
			fontFamily: 'system-ui, sans-serif',
			fontSize: '12px',
			color: '#e8f4e0',
			background: 'rgba(12, 28, 14, 0.72)',
			borderRadius: '8px',
			zIndex: '2147483644',
			display: 'block',
		})
	}
	labelWood.textContent = `+${tickState.woodPerTick} wood/tick`
	labelOre.textContent = `+${tickState.orePerTick} ore/tick`
	document.body.appendChild(labelWood)
	document.body.appendChild(labelOre)

	const domeLabelScratch = new THREE.Vector3()

	function placeDomeLabelScreen(labelEl, worldX, topY, worldZ) {
		domeLabelScratch.set(worldX, topY, worldZ)
		domeLabelScratch.project(camera)
		if (domeLabelScratch.z > 1) {
			labelEl.style.display = 'none'
			return
		}
		const rect = renderer.domElement.getBoundingClientRect()
		const x = (domeLabelScratch.x * 0.5 + 0.5) * rect.width + rect.left
		const y = (-domeLabelScratch.y * 0.5 + 0.5) * rect.height + rect.top
		labelEl.style.display = 'block'
		labelEl.style.left = `${x}px`
		labelEl.style.top = `${y}px`
		labelEl.style.transform = 'translate(-50%, -110%)'
	}

	let domeLegitInterior = false
	let oreLegitInterior = false

	function syncWoodDomeGarden() {
		if (!woodDome?.gardenGroup) {
			return
		}
		updateDomeGardenPositions(woodDome.gardenGroup, {
			centerX: domeCx,
			centerZ: domeCz,
			groundY: woodDome.group.position.y,
			doorYaw: doorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2,
			terrainHeightAtPlaneXY,
		})
	}

	function syncOreDomeGarden() {
		if (!oreDome?.gardenGroup) {
			return
		}
		updateDomeGardenPositions(oreDome.gardenGroup, {
			centerX: oreCx,
			centerZ: oreCz,
			groundY: oreDome.group.position.y,
			doorYaw: oreDoorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2,
			terrainHeightAtPlaneXY,
		})
	}

	function updateDomeCoordLabel() {
		if (!domeMovePending || !placementDomeKind) {
			domeCoordLabel.style.display = 'none'
			return
		}
		const g =
			placementDomeKind === 'wood'
				? { cx: domeCx, cz: domeCz, group: woodDome?.group }
				: { cx: oreCx, cz: oreCz, group: oreDome?.group }
		if (!g.group) {
			domeCoordLabel.style.display = 'none'
			return
		}
		const gy = g.group.position.y
		const rotY = g.group.rotation.y
		domeCoordLabel.style.display = 'block'
		domeCoordLabel.textContent = [
			`${placementDomeKind} dome`,
			`centerX   ${g.cx.toFixed(3)}`,
			`centerZ   ${g.cz.toFixed(3)}`,
			`groundY   ${gy.toFixed(4)}`,
			`rotationY ${rotY.toFixed(6)}`,
		].join('\n')
	}

	function saveDomePlacementSnapshot(kind) {
		placementDomeKind = kind
		if (kind === 'wood' && woodDome) {
			domePlacementSnapshot = {
				kind: 'wood',
				cx: domeCx,
				cz: domeCz,
				doorAngleCenter,
				gy: woodDome.group.position.y,
				rotY: woodDome.group.rotation.y,
			}
			return
		}
		if (kind === 'ore' && oreDome) {
			domePlacementSnapshot = {
				kind: 'ore',
				cx: oreCx,
				cz: oreCz,
				doorAngleCenter: oreDoorAngleCenter,
				gy: oreDome.group.position.y,
				rotY: oreDome.group.rotation.y,
			}
		}
	}

	function cancelDomePlacement() {
		const snap = domePlacementSnapshot
		if (snap?.kind === 'wood' && woodDome) {
			domeCx = snap.cx
			domeCz = snap.cz
			doorAngleCenter = snap.doorAngleCenter
			woodDome.group.position.set(snap.cx, snap.gy, snap.cz)
			woodDome.group.rotation.y = snap.rotY
			setDomePlacementHighlight(woodDome.group, false)
			syncWoodDomeGarden()
			scheduleTerrainTint()
		} else if (snap?.kind === 'ore' && oreDome) {
			oreCx = snap.cx
			oreCz = snap.cz
			oreDoorAngleCenter = snap.doorAngleCenter
			oreDome.group.position.set(snap.cx, snap.gy, snap.cz)
			oreDome.group.rotation.y = snap.rotY
			setDomePlacementHighlight(oreDome.group, false)
			syncOreDomeGarden()
		} else {
			if (woodDome) {
				setDomePlacementHighlight(woodDome.group, false)
			}
			if (oreDome) {
				setDomePlacementHighlight(oreDome.group, false)
			}
		}
		domePlacementSnapshot = null
		domeMovePending = false
		placementDomeKind = null
		hint.textContent = DEFAULT_HINT
		updateDomeCoordLabel()
	}

	function applyDomePreview(newX, newZ) {
		const lim = PLANE_HALF - EDGE_MARGIN
		const nx = THREE.MathUtils.clamp(newX, -lim, lim)
		const nz = THREE.MathUtils.clamp(newZ, -lim, lim)
		if (placementDomeKind === 'wood' && woodDome) {
			domeCx = nx
			domeCz = nz
			doorAngleCenter = Math.atan2(spawn.playerX - domeCx, spawn.playerZ - domeCz)
			const gy =
				minTerrainHeightUnderRim(domeCx, domeCz, DOME_RADIUS, terrainHeightAtPlaneXY, 64) +
				DOME_RIM_ABOVE_TERRAIN
			woodDome.group.position.set(domeCx, gy, domeCz)
			woodDome.group.rotation.y = doorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2
			syncWoodDomeGarden()
			scheduleTerrainTint()
			updateDomeCoordLabel()
			return
		}
		if (placementDomeKind === 'ore' && oreDome) {
			oreCx = nx
			oreCz = nz
			oreDoorAngleCenter = Math.atan2(spawn.playerX - oreCx, spawn.playerZ - oreCz)
			const gy =
				minTerrainHeightUnderRim(oreCx, oreCz, DOME_RADIUS, terrainHeightAtPlaneXY, 64) +
				DOME_RIM_ABOVE_TERRAIN
			oreDome.group.position.set(oreCx, gy, oreCz)
			oreDome.group.rotation.y = oreDoorAngleCenter - DOME_BAKED_ENTRANCE_ATAN2
			syncOreDomeGarden()
			updateDomeCoordLabel()
		}
	}

	function applyDomePlacement(newX, newZ) {
		applyDomePreview(newX, newZ)
		if (placementDomeKind === 'wood') {
			domeLegitInterior = false
		} else if (placementDomeKind === 'ore') {
			oreLegitInterior = false
		}
		const placedKind = placementDomeKind
		domeMovePending = false
		domePlacementSnapshot = null
		placementDomeKind = null
		if (placedKind === 'wood' && woodDome) {
			setDomePlacementHighlight(woodDome.group, false)
		} else if (placedKind === 'ore' && oreDome) {
			setDomePlacementHighlight(oreDome.group, false)
		}
		hint.textContent = DEFAULT_HINT
		updateDomeCoordLabel()
	}

	const raycaster = new THREE.Raycaster()
	function onCanvasMoveDomePlace(e) {
		if (!domeMovePending || !placementDomeKind || pointer.isLocked) {
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
		if (domeMovePending && placementDomeKind) {
			const gHits = raycaster.intersectObject(ground, false)
			if (gHits.length > 0) {
				applyDomePlacement(gHits[0].point.x, gHits[0].point.z)
				return
			}
			cancelDomePlacement()
			return
		}
		let best = /** @type {{ dist: number, kind: 'wood' | 'ore' } | null} */ (null)
		if (woodDome) {
			const h = raycaster.intersectObject(woodDome.group, true)
			if (h.length > 0) {
				best = { dist: h[0].distance, kind: 'wood' }
			}
		}
		if (oreDome) {
			const h = raycaster.intersectObject(oreDome.group, true)
			if (h.length > 0 && (!best || h[0].distance < best.dist)) {
				best = { dist: h[0].distance, kind: 'ore' }
			}
		}
		if (best) {
			saveDomePlacementSnapshot(best.kind)
			setDomePlacementHighlight(best.kind === 'wood' ? woodDome.group : oreDome.group, true)
			domeMovePending = true
			hint.textContent = 'Move mouse to preview · click terrain to place · Esc to cancel'
			updateDomeCoordLabel()
			return
		}
		tryPointerLock()
	}
	renderer.domElement.addEventListener('mousemove', onCanvasMoveDomePlace)
	renderer.domElement.addEventListener('click', onCanvasClickDomePlace)

	const floodGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 1, 1)
	const floodPos = floodGeo.attributes.position
	for (let i = 0; i < floodPos.count; i++) {
		floodPos.setZ(i, seaLevelValue)
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

	const springMouth = createSpringMouthGroup(terrainHeightAtPlaneXY)
	scene.add(springMouth.group)

	/** Max depth below surface when wading (river bed can be deeper). */
	const WADE_MAX_DEPTH = 5.2
	/** Near-surface cap so the blob stays visibly in the water column when shallow. */
	const WADE_NEAR_SURFACE = 0.05

	function sampleGroundYAt(px, pz) {
		const lx = px
		const ly = -pz
		const { wx, wy } = terrainPlaneWarp(lx, ly)
		const terrain = terrainHeightAtPlaneXY(lx, ly)
		const surf = waterSurfaceHeightAt(wx, wy)
		if (terrain >= surf) {
			return terrain
		}
		const yBelow = surf - WADE_MAX_DEPTH
		const yAbove = surf - WADE_NEAR_SURFACE
		return Math.max(yBelow, Math.min(yAbove, terrain))
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
	/** World XZ velocity (units/s); smoothed for ease-in / ease-out on WASD. */
	let velX = 0
	let velZ = 0
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

		{
			const aZ = 1 - Math.exp(-delta / ZOOM_SMOOTH_TAU)
			zoomAboveGround += (zoomTarget - zoomAboveGround) * aZ
		}

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
		{
			let targetVelX = 0
			let targetVelZ = 0
			if (move.lengthSq() > 0) {
				const gyMove = sampleGroundYAt(playerX, playerZ)
				blobAt.set(playerX, gyMove, playerZ)
				const distCamBlob = camera.position.distanceTo(blobAt)
				const moveScale = moveSpeedScaleFromCameraBlobDist(distCamBlob)
				move.normalize()
				const sp = MOVE_SPEED * moveScale
				targetVelX = move.x * sp
				targetVelZ = move.z * sp
			}
			const tau = targetVelX === 0 && targetVelZ === 0 ? MOVE_DECEL_TAU : MOVE_ACCEL_TAU
			const a = 1 - Math.exp(-delta / tau)
			velX += (targetVelX - velX) * a
			velZ += (targetVelZ - velZ) * a
			const v2 = velX * velX + velZ * velZ
			if (v2 < 4) {
				velX = 0
				velZ = 0
			}
		}

		if (velX !== 0 || velZ !== 0) {
			const prevX = playerX
			const prevZ = playerZ
			playerX += velX * delta
			playerZ += velZ * delta
			clampPlayerXZ()
			let r = applyDomeRimCollision({
				playerX,
				playerZ,
				prevX,
				prevZ,
				domeCx,
				domeCz,
				doorAngleCenter,
				domeLegitInterior,
				domeRadius: DOME_RADIUS,
				domeDoorGap: DOME_DOOR_GAP,
			})
			playerX = r.playerX
			playerZ = r.playerZ
			domeLegitInterior = r.domeLegitInterior
			r = applyDomeRimCollision({
				playerX,
				playerZ,
				prevX,
				prevZ,
				domeCx: oreCx,
				domeCz: oreCz,
				doorAngleCenter: oreDoorAngleCenter,
				domeLegitInterior: oreLegitInterior,
				domeRadius: DOME_RADIUS,
				domeDoorGap: DOME_DOOR_GAP,
			})
			playerX = r.playerX
			playerZ = r.playerZ
			oreLegitInterior = r.domeLegitInterior
			clampPlayerXZ()
		}

		updateChaseCamera()

		{
			camera.getWorldDirection(forward)
			forward.y = 0
			if (forward.lengthSq() > 1e-6) {
				forward.normalize()
			} else {
				forward.set(0, 0, -1)
			}
			const yawDeg = (Math.atan2(forward.x, forward.z) - Math.PI / 2) * (180 / Math.PI)
			compassRose.style.transform = `rotate(${yawDeg}deg)`
		}

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

		const domeTopY = DOME_RADIUS * 0.92
		if (woodDome?.group) {
			placeDomeLabelScreen(
				labelWood,
				woodDome.group.position.x,
				woodDome.group.position.y + domeTopY,
				woodDome.group.position.z,
			)
		}
		if (oreDome?.group) {
			placeDomeLabelScreen(
				labelOre,
				oreDome.group.position.x,
				oreDome.group.position.y + domeTopY,
				oreDome.group.position.z,
			)
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
		window.removeEventListener('unhandledrejection', swallowPointerLockRejection)
		document.removeEventListener('pointerlockchange', onPointerLockChange)
		document.removeEventListener('pointerlockerror', onPointerLockError)
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
		nextTickBtn.removeEventListener('click', onNextTickClick)
		if (tickHud.parentNode) {
			container.removeChild(tickHud)
		}
		if (inventoryHud.parentNode) {
			container.removeChild(inventoryHud)
		}
		if (labelWood.parentNode) {
			document.body.removeChild(labelWood)
		}
		if (labelOre.parentNode) {
			document.body.removeChild(labelOre)
		}
		if (woodDome) {
			scene.remove(woodDome.group)
			woodDome.dispose()
		}
		if (oreDome) {
			scene.remove(oreDome.group)
			oreDome.dispose()
		}
		scene.remove(springMouth.group)
		springMouth.dispose()
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
		if (compassWrap.parentNode === container) {
			container.removeChild(compassWrap)
		}
		if (domeCoordLabel.parentNode) {
			domeCoordLabel.parentNode.removeChild(domeCoordLabel)
		}
	}

	return { dispose }
}
