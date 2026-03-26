/**
 * Procedural low-poly trees (trunk + stacked cones) and bushes, grass biomes via instancing.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { canPlaceTree, isDenseForestPatch } from './biomes.js'
import { EDGE_MARGIN, PLANE_HALF } from './game-constants.js'
import { terrainHeightAtPlaneXY, terrainPlaneWarp } from './terrain.js'

const TREE_VARIANTS = 48
const BUSH_TYPES = 3
const BUSH_VARIANTS_PER_TYPE = 16
const TOTAL_BUSH_VARIANTS = BUSH_TYPES * BUSH_VARIANTS_PER_TYPE

const DEFAULT_TREE_COUNT = 5600
const DEFAULT_BUSH_COUNT = 5600
/** World-space scale multiplier for bush instances (geometry is authored small). */
const BUSH_INSTANCE_SCALE = 3
const MAX_PLACE_ATTEMPTS = 5_000_000
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

/**
 * @param {0 | 1 | 2} type — stacked cones | wide mound | sphere cluster
 * @param {number} seed
 */
function createBushGeometry(type, seed) {
	const rng = mulberry32(seed)
	const segs = 6
	const parts = []
	const gr = 0.1 + rng() * 0.1
	const gg = 0.26 + rng() * 0.16
	const gb = 0.1 + rng() * 0.1

	if (type === 0) {
		let y = 0
		const layers = 2 + (rng() > 0.4 ? 1 : 0)
		for (let i = 0; i < layers; i++) {
			const h = 1.1 + rng() * 1.6
			const r = 1.4 + rng() * 2.0 - i * 0.28
			const cone = new THREE.ConeGeometry(Math.max(0.5, r), h, segs, 1, false)
			cone.translate(0, y + h * 0.5, 0)
			setVertexColor(cone, gr + rng() * 0.06, gg + rng() * 0.05, gb + rng() * 0.04)
			parts.push(cone)
			y += h * 0.32 + rng() * 0.35
		}
	} else if (type === 1) {
		const r = 2.2 + rng() * 3.2
		const h = 1.0 + rng() * 1.6
		const cone = new THREE.ConeGeometry(r, h, segs, 1, false)
		cone.translate(0, h * 0.5, 0)
		setVertexColor(cone, gr + rng() * 0.08, gg + rng() * 0.06, gb + rng() * 0.05)
		parts.push(cone)
	} else {
		const n = 2 + (rng() > 0.42 ? 1 : 0)
		for (let i = 0; i < n; i++) {
			const sx = (rng() - 0.5) * 2.4
			const sz = (rng() - 0.5) * 2.4
			const sr = 1.0 + rng() * 1.35
			const sph = new THREE.SphereGeometry(sr, 5, 4)
			sph.translate(sx, sr * 0.85, sz)
			setVertexColor(sph, gr + rng() * 0.07, gg + rng() * 0.06, gb + rng() * 0.05)
			parts.push(sph)
		}
	}

	const merged = mergeGeometries(parts, false)
	for (const p of parts) {
		p.dispose()
	}
	merged.computeVertexNormals()
	return merged
}

const dummy = new THREE.Object3D()

function buildInstancedMeshes(geoms, buckets, mat) {
	const meshes = []
	for (let v = 0; v < geoms.length; v++) {
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
	return meshes
}

/**
 * @param {object} opts
 * @param {number} opts.vHMin
 * @param {number} opts.vHSpan
 * @param {number} [opts.treeCount]
 * @param {number} [opts.bushCount]
 * @param {number} [opts.seed]
 * @param {number} [opts.spawnX]
 * @param {number} [opts.spawnZ]
 */
export function createForestInstancedMeshes(opts) {
	const {
		vHMin,
		vHSpan,
		treeCount = DEFAULT_TREE_COUNT,
		bushCount = DEFAULT_BUSH_COUNT,
		seed = 0x2f6e3a91,
		spawnX = 0,
		spawnZ = 0,
	} = opts

	const treeGeoms = []
	for (let v = 0; v < TREE_VARIANTS; v++) {
		treeGeoms.push(createTreeGeometry(seed + v * 9973))
	}

	const bushGeoms = []
	for (let v = 0; v < TOTAL_BUSH_VARIANTS; v++) {
		const type = Math.floor(v / BUSH_VARIANTS_PER_TYPE)
		const sub = v % BUSH_VARIANTS_PER_TYPE
		bushGeoms.push(createBushGeometry(type, seed + 0x51a7 * (v + 1) + sub * 131))
	}

	const mat = new THREE.MeshStandardMaterial({
		vertexColors: true,
		roughness: 0.88,
		metalness: 0.02,
		envMapIntensity: 0.35,
	})

	const treeBuckets = Array.from({ length: TREE_VARIANTS }, () => [])
	const bushBuckets = Array.from({ length: TOTAL_BUSH_VARIANTS }, () => [])
	const rngTrees = mulberry32(seed ^ 0xdeadbeef)
	const rngBushes = mulberry32(seed ^ 0xbeefcafe)
	const lim = PLANE_HALF - EDGE_MARGIN
	const spawnLy = -spawnZ

	let placedTrees = 0
	let attemptT = 0
	while (placedTrees < treeCount && attemptT < MAX_PLACE_ATTEMPTS) {
		attemptT++
		const lx = (rngTrees() * 2 - 1) * lim
		const ly = (rngTrees() * 2 - 1) * lim
		const h = terrainHeightAtPlaneXY(lx, ly)
		const tn = vHSpan > 1e-5 ? (h - vHMin) / vHSpan : 0.5
		const { wx, wy } = terrainPlaneWarp(lx, ly)
		if (!canPlaceTree(wx, wy, h, tn)) {
			continue
		}
		if (!isDenseForestPatch(wx, wy)) {
			continue
		}
		if (Math.hypot(lx - spawnX, ly - spawnLy) < SPAWN_CLEAR_RADIUS) {
			continue
		}

		const variant = Math.floor(rngTrees() * TREE_VARIANTS)
		const rotY = rngTrees() * Math.PI * 2
		const sc = 0.78 + rngTrees() * 0.52
		treeBuckets[variant].push({ lx, ly, h, rotY, sc })
		placedTrees++
	}

	let placedBushes = 0
	let attemptB = 0
	while (placedBushes < bushCount && attemptB < MAX_PLACE_ATTEMPTS) {
		attemptB++
		const lx = (rngBushes() * 2 - 1) * lim
		const ly = (rngBushes() * 2 - 1) * lim
		const h = terrainHeightAtPlaneXY(lx, ly)
		const tn = vHSpan > 1e-5 ? (h - vHMin) / vHSpan : 0.5
		const { wx, wy } = terrainPlaneWarp(lx, ly)
		if (!canPlaceTree(wx, wy, h, tn)) {
			continue
		}
		if (!isDenseForestPatch(wx, wy)) {
			continue
		}
		if (Math.hypot(lx - spawnX, ly - spawnLy) < SPAWN_CLEAR_RADIUS) {
			continue
		}

		const variant = Math.floor(rngBushes() * TOTAL_BUSH_VARIANTS)
		const rotY = rngBushes() * Math.PI * 2
		const sc = (0.32 + rngBushes() * 0.48) * BUSH_INSTANCE_SCALE
		bushBuckets[variant].push({ lx, ly, h, rotY, sc })
		placedBushes++
	}

	const treeMeshes = buildInstancedMeshes(treeGeoms, treeBuckets, mat)
	const bushMeshes = buildInstancedMeshes(bushGeoms, bushBuckets, mat)

	return { meshes: [...treeMeshes, ...bushMeshes], material: mat }
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
