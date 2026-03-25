/**
 * Procedural low-poly trees (trunk + stacked cones), placed in grass biomes via instancing.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { canPlaceTree } from './biomes.js'
import { EDGE_MARGIN, PLANE_HALF } from './game-constants.js'
import { terrainHeightAtPlaneXY, terrainPlaneWarp } from './terrain.js'

const TREE_VARIANTS = 16
const DEFAULT_TREE_COUNT = 2200
const MAX_PLACE_ATTEMPTS = 220000
const SPAWN_CLEAR_RADIUS = 520

function mulberry32(seed) {
	let a = seed >>> 0
	return () => {
		a += 0x6d2b79f5
		let t = Math.imul(a ^ (a >>> 15), a | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

function setVertexColor(geom, r, g, b) {
	const n = geom.attributes.position.count
	const colors = new Float32Array(n * 3)
	for (let i = 0; i < n; i++) {
		colors[i * 3] = r
		colors[i * 3 + 1] = g
		colors[i * 3 + 2] = b
	}
	geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

/**
 * Single merged tree: trunk + 2–3 cones; origin at ground contact, Y up.
 * @param {number} seed
 */
export function createTreeGeometry(seed) {
	const rng = mulberry32(seed)
	const trunkH = 6 + rng() * 14
	const trunkR0 = 0.55 + rng() * 0.55
	const trunkR1 = trunkR0 * (0.55 + rng() * 0.2)
	const segs = 7

	const trunk = new THREE.CylinderGeometry(trunkR1, trunkR0, trunkH, segs, 1, false)
	trunk.translate(0, trunkH * 0.5, 0)
	setVertexColor(trunk, 0.32 + rng() * 0.08, 0.2 + rng() * 0.06, 0.12)

	const parts = [trunk]
	let y = trunkH * 0.92
	const layers = 2 + (rng() > 0.35 ? 1 : 0)
	for (let i = 0; i < layers; i++) {
		const coneH = 5 + rng() * 9
		const coneR = 2.2 + rng() * 3.8
		const cone = new THREE.ConeGeometry(coneR, coneH, segs, 1, false)
		cone.translate(0, y + coneH * 0.5, 0)
		const g = 0.28 + rng() * 0.14
		const gr = 0.12 + rng() * 0.1
		const gb = 0.1 + rng() * 0.08
		setVertexColor(cone, gr, g, gb)
		parts.push(cone)
		y += coneH * 0.38 + rng() * 1.2
	}

	const merged = mergeGeometries(parts, false)
	for (const p of parts) {
		p.dispose()
	}
	merged.computeVertexNormals()
	return merged
}

const dummy = new THREE.Object3D()

/**
 * @param {object} opts
 * @param {number} opts.vHMin
 * @param {number} opts.vHSpan
 * @param {number} opts.floodLevel
 * @param {number} [opts.treeCount]
 * @param {number} [opts.seed]
 * @param {number} [opts.spawnX]
 * @param {number} [opts.spawnZ]
 */
export function createForestInstancedMeshes(opts) {
	const {
		vHMin,
		vHSpan,
		floodLevel,
		treeCount = DEFAULT_TREE_COUNT,
		seed = 0x2f6e3a91,
		spawnX = 0,
		spawnZ = 0,
	} = opts

	const geoms = []
	for (let v = 0; v < TREE_VARIANTS; v++) {
		geoms.push(createTreeGeometry(seed + v * 9973))
	}

	const mat = new THREE.MeshStandardMaterial({
		vertexColors: true,
		roughness: 0.88,
		metalness: 0.02,
		envMapIntensity: 0.35,
	})

	const buckets = Array.from({ length: TREE_VARIANTS }, () => [])
	const rngPlace = mulberry32(seed ^ 0xdeadbeef)
	const lim = PLANE_HALF - EDGE_MARGIN
	const spawnLy = -spawnZ

	let placed = 0
	let attempt = 0
	while (placed < treeCount && attempt < MAX_PLACE_ATTEMPTS) {
		attempt++
		const lx = (rngPlace() * 2 - 1) * lim
		const ly = (rngPlace() * 2 - 1) * lim
		const h = terrainHeightAtPlaneXY(lx, ly)
		const tn = vHSpan > 1e-5 ? (h - vHMin) / vHSpan : 0.5
		const { wx, wy } = terrainPlaneWarp(lx, ly)
		if (!canPlaceTree(wx, wy, h, tn, floodLevel)) {
			continue
		}
		if (Math.hypot(lx - spawnX, ly - spawnLy) < SPAWN_CLEAR_RADIUS) {
			continue
		}

		const variant = Math.floor(rngPlace() * TREE_VARIANTS)
		const rotY = rngPlace() * Math.PI * 2
		const sc = 0.78 + rngPlace() * 0.52
		buckets[variant].push({ lx, ly, h, rotY, sc })
		placed++
	}

	const meshes = []
	for (let v = 0; v < TREE_VARIANTS; v++) {
		const list = buckets[v]
		if (list.length === 0) {
			geoms[v].dispose()
			continue
		}
		const im = new THREE.InstancedMesh(geoms[v], mat, list.length)
		im.castShadow = true
		im.receiveShadow = true
		for (let i = 0; i < list.length; i++) {
			const { lx, ly, h, rotY, sc } = list[i]
			dummy.position.set(lx, h, -ly)
			dummy.rotation.set(0, rotY, 0)
			dummy.scale.setScalar(sc)
			dummy.updateMatrix()
			im.setMatrixAt(i, dummy.matrix)
		}
		im.instanceMatrix.needsUpdate = true
		meshes.push(im)
	}

	return { meshes, material: mat }
}

export function disposeForestResources(forest) {
	if (!forest) {
		return
	}
	const { meshes, material } = forest
	for (const m of meshes) {
		m.geometry.dispose()
	}
	material.dispose()
}
