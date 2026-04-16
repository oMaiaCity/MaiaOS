#!/usr/bin/env bun
/**
 * One-shot: build geodesic dome (unit radius) and write libs/maia-game/src/assets/geodesic-dome.glb
 */
/** GLTFExporter uses FileReader for Blob → ArrayBuffer; Bun/Node omit it. */
if (typeof globalThis.FileReader === 'undefined') {
	globalThis.FileReader = class FileReader {
		result = null
		onloadend = null
		readAsArrayBuffer(blob) {
			Promise.resolve(blob.arrayBuffer()).then((ab) => {
				this.result = ab
				if (this.onloadend) this.onloadend()
			})
		}
		readAsDataURL(blob) {
			Promise.resolve(blob.arrayBuffer()).then((ab) => {
				this.result = `data:application/octet-stream;base64,${Buffer.from(ab).toString('base64')}`
				if (this.onloadend) this.onloadend()
			})
		}
	}
}

import { bootstrapNodeLogging, createLogger } from '@MaiaOS/logs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

bootstrapNodeLogging()
const domeScriptLog = createLogger('game-scripts')

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../src/assets')
const outPath = join(outDir, 'geodesic-dome.glb')

const DOOR_GAP_RADIANS = 0.92

function domeLocalGapCenterAtan2XZ(doorGapRadians) {
	const phi = Math.PI * 2 - doorGapRadians / 2
	const theta = Math.PI / 2
	const x = -Math.cos(phi) * Math.sin(theta)
	const z = Math.sin(phi) * Math.sin(theta)
	return Math.atan2(x, z)
}

function angleDiff(a, b) {
	let d = a - b
	while (d > Math.PI) d -= Math.PI * 2
	while (d < -Math.PI) d += Math.PI * 2
	return d
}

function seededRandom(seed) {
	let s = seed
	return () => {
		s = (s * 16807 + 0) % 2147483647
		return (s - 1) / 2147483646
	}
}

function buildDomeMeshes(radius, doorGapRadians, icoDetail = 3) {
	const gapCenterAngle = domeLocalGapCenterAtan2XZ(doorGapRadians)
	const gapHalf = doorGapRadians / 2 + 0.08
	const archHeight = radius * 0.52

	let geo = new THREE.IcosahedronGeometry(radius, icoDetail)
	geo = mergeVertices(geo)
	const pos = geo.attributes.position

	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i)
		const y = pos.getY(i)
		const z = pos.getZ(i)
		const len = Math.hypot(x, y, z) || 1
		const s = radius / len
		pos.setXYZ(i, x * s, y * s, z * s)
	}

	const idx = geo.index
	if (!idx) {
		throw new Error('IcosahedronGeometry must be indexed')
	}

	const arr = idx.array
	const panelIdx = []
	const windowIdx = []
	const strutEdgeSet = new Set()
	const rng = seededRandom(42)

	function addEdge(a, b) {
		const lo = Math.min(a, b)
		const hi = Math.max(a, b)
		strutEdgeSet.add(`${lo}_${hi}`)
	}

	function isInGap(cx, cz) {
		const ang = Math.atan2(cx, cz)
		return Math.abs(angleDiff(ang, gapCenterAngle)) < gapHalf
	}

	function isInDoorArch(cx, cy, cz) {
		if (!isInGap(cx, cz)) {
			return false
		}
		const ang = Math.atan2(cx, cz)
		const t = Math.abs(angleDiff(ang, gapCenterAngle)) / gapHalf
		const maxY = archHeight * Math.cos(Math.min(t, 1) * Math.PI * 0.5)
		return cy < maxY
	}

	for (let i = 0; i < arr.length; i += 3) {
		const i0 = arr[i]
		const i1 = arr[i + 1]
		const i2 = arr[i + 2]
		const ia = i0 * 3
		const ib = i1 * 3
		const ic = i2 * 3
		const cx = (pos.array[ia] + pos.array[ib] + pos.array[ic]) / 3
		const cy = (pos.array[ia + 1] + pos.array[ib + 1] + pos.array[ic + 1]) / 3
		const cz = (pos.array[ia + 2] + pos.array[ib + 2] + pos.array[ic + 2]) / 3

		if (cy < -0.001) {
			continue
		}

		addEdge(i0, i1)
		addEdge(i1, i2)
		addEdge(i2, i0)

		if (isInDoorArch(cx, cy, cz)) {
			continue
		}

		if (isInGap(cx, cz) && cy < archHeight * 1.05) {
			continue
		}

		const isWindow = rng() < 0.12 && cy > radius * 0.18
		if (isWindow) {
			windowIdx.push(i0, i1, i2)
		} else {
			panelIdx.push(i0, i1, i2)
		}
	}

	const panelGeo = geo.clone()
	panelGeo.setIndex(panelIdx)
	panelGeo.computeVertexNormals()

	const windowGeo = geo.clone()
	windowGeo.setIndex(windowIdx)
	windowGeo.computeVertexNormals()

	const strutSegments = []
	for (const key of strutEdgeSet) {
		const [a, b] = key.split('_').map(Number)
		const ax = pos.array[a * 3]
		const ay = pos.array[a * 3 + 1]
		const az = pos.array[a * 3 + 2]
		const bx = pos.array[b * 3]
		const by = pos.array[b * 3 + 1]
		const bz = pos.array[b * 3 + 2]
		if (ay < -0.01 && by < -0.01) {
			continue
		}
		strutSegments.push(new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz))
	}

	geo.dispose()
	return { panelGeo, windowGeo, strutSegments }
}

function buildArchFrame(radius, doorGapRadians) {
	const gapCenter = domeLocalGapCenterAtan2XZ(doorGapRadians)
	const gapHalf = doorGapRadians / 2
	const archHeight = radius * 0.52
	const archPts = []
	const segs = 32

	for (let i = 0; i <= segs; i++) {
		const t = i / segs
		const ang = gapCenter - gapHalf + t * doorGapRadians
		const u = Math.abs(angleDiff(ang, gapCenter)) / gapHalf
		const y = archHeight * Math.cos(Math.min(u, 1) * Math.PI * 0.5)
		const x = Math.sin(ang) * radius
		const z = Math.cos(ang) * radius
		archPts.push(new THREE.Vector3(x, y, z))
	}

	return archPts
}

const RADIUS = 1
const scene = new THREE.Scene()
const root = new THREE.Group()
root.name = 'GeodesicDome'
scene.add(root)

const { panelGeo, windowGeo, strutSegments } = buildDomeMeshes(RADIUS, DOOR_GAP_RADIANS, 3)

const panelMat = new THREE.MeshStandardMaterial({
	name: 'DomePanel',
	color: 0xf0ebe0,
	metalness: 0.04,
	roughness: 0.55,
	side: THREE.DoubleSide,
	envMapIntensity: 0.3,
})
const panelMesh = new THREE.Mesh(panelGeo, panelMat)
panelMesh.name = 'Panels'
root.add(panelMesh)

const windowMat = new THREE.MeshPhysicalMaterial({
	name: 'DomeWindow',
	color: 0xc8dce8,
	metalness: 0.08,
	roughness: 0.08,
	transmission: 0.65,
	thickness: 0.4,
	transparent: true,
	side: THREE.DoubleSide,
	ior: 1.5,
	reflectivity: 0.5,
	attenuationDistance: 4,
	attenuationColor: new THREE.Color(0x90b8cc),
})
const windowMesh = new THREE.Mesh(windowGeo, windowMat)
windowMesh.name = 'Windows'
root.add(windowMesh)

const tmpMat = new THREE.Matrix4()
const up = new THREE.Vector3(0, 1, 0)
const dir = new THREE.Vector3()
const quat = new THREE.Quaternion()

const strutCount = strutSegments.length / 2
const tubeR = 0.006
const tubeSides = 4
const strutInstanceGeo = new THREE.CylinderGeometry(tubeR, tubeR, 1, tubeSides, 1, false)
const strutTubeMat = new THREE.MeshStandardMaterial({
	name: 'DomeStrut',
	color: 0x6a7078,
	metalness: 0.65,
	roughness: 0.35,
	envMapIntensity: 0.5,
})
const strutMeshInst = new THREE.InstancedMesh(strutInstanceGeo, strutTubeMat, strutCount)
strutMeshInst.name = 'Struts'

for (let i = 0; i < strutCount; i++) {
	const a = strutSegments[i * 2]
	const b = strutSegments[i * 2 + 1]
	dir.subVectors(b, a)
	const len = dir.length()
	dir.normalize()
	quat.setFromUnitVectors(up, dir)
	tmpMat.compose(
		new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
		quat,
		new THREE.Vector3(1, len, 1),
	)
	strutMeshInst.setMatrixAt(i, tmpMat)
}
strutMeshInst.instanceMatrix.needsUpdate = true
root.add(strutMeshInst)

const archPts = buildArchFrame(RADIUS, DOOR_GAP_RADIANS)
const archTubeMat = new THREE.MeshStandardMaterial({
	name: 'DomeArch',
	color: 0x5a6068,
	metalness: 0.7,
	roughness: 0.3,
	envMapIntensity: 0.5,
})
const archTubeR = 0.012
const archTubeSides = 8
const archTubeGeo = new THREE.CylinderGeometry(archTubeR, archTubeR, 1, archTubeSides, 1, false)
const archSegCount = archPts.length - 1
const archInst = new THREE.InstancedMesh(archTubeGeo, archTubeMat, archSegCount)
archInst.name = 'ArchFrame'

for (let i = 0; i < archSegCount; i++) {
	const a = archPts[i]
	const b = archPts[i + 1]
	dir.subVectors(b, a)
	const len = dir.length()
	dir.normalize()
	quat.setFromUnitVectors(up, dir)
	tmpMat.compose(
		new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
		quat,
		new THREE.Vector3(1, len, 1),
	)
	archInst.setMatrixAt(i, tmpMat)
}
archInst.instanceMatrix.needsUpdate = true
root.add(archInst)

const gapCenter = domeLocalGapCenterAtan2XZ(DOOR_GAP_RADIANS)
const gapHalf = DOOR_GAP_RADIANS / 2
const archHeight = RADIUS * 0.52
const postR = 0.014
const postH = archHeight + 0.015

function rimAtAngle(ang) {
	return new THREE.Vector3(Math.sin(ang) * RADIUS, 0, Math.cos(ang) * RADIUS)
}

const pLeft = rimAtAngle(gapCenter - gapHalf)
const pRight = rimAtAngle(gapCenter + gapHalf)

const postGeo = new THREE.CylinderGeometry(postR, postR * 1.08, postH, 8, 1, false)
const postMat = new THREE.MeshStandardMaterial({
	name: 'DomePost',
	color: 0x5a6068,
	metalness: 0.7,
	roughness: 0.3,
})

const postLMesh = new THREE.Mesh(postGeo, postMat)
postLMesh.name = 'PostLeft'
postLMesh.position.set(pLeft.x, postH * 0.5, pLeft.z)
root.add(postLMesh)

const postRMesh = new THREE.Mesh(postGeo.clone(), postMat)
postRMesh.name = 'PostRight'
postRMesh.position.set(pRight.x, postH * 0.5, pRight.z)
root.add(postRMesh)

mkdirSync(outDir, { recursive: true })

const exporter = new GLTFExporter()
const arrayBuffer = await exporter.parseAsync(scene, { binary: true })
writeFileSync(outPath, Buffer.from(arrayBuffer))

domeScriptLog.log(`Wrote ${outPath} (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB)`)
