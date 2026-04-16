#!/usr/bin/env bun
/**
 * Converts Blender-exported dome.obj + dome.mtl → libs/maia-game/src/assets/geodesic-dome.glb
 * Source: libs/maia-game/src/assets/blender-dome/ (update those files when replacing the mesh).
 *
 * The shipped OBJ contains three copies (Sphere.003–005); only Sphere.004 (centered) is baked.
 */
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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'

bootstrapNodeLogging()
const domeScriptLog = createLogger('game-scripts')

const __dirname = dirname(fileURLToPath(import.meta.url))
const assetDir = join(__dirname, '../src/assets/blender-dome')
const outDir = join(__dirname, '../src/assets')
const outPath = join(outDir, 'geodesic-dome.glb')

const mtlText = readFileSync(join(assetDir, 'dome.mtl'), 'utf8')
const mtlLoader = new MTLLoader()
const materialCreator = mtlLoader.parse(mtlText, `${assetDir}/`)
materialCreator.preload()

const objText = readFileSync(join(assetDir, 'dome.obj'), 'utf8')
const objLoader = new OBJLoader()
objLoader.setMaterials(materialCreator)
const loaded = objLoader.parse(objText)

const part = loaded.getObjectByName('Sphere.004')
if (!part) {
	throw new Error(
		'OBJ must contain object "Sphere.004" (centered dome). Found: ' +
			loaded.children.map((c) => c.name).join(', '),
	)
}

const root = new THREE.Group()
root.name = 'GeodesicDome'
root.add(part)

root.updateMatrixWorld(true)
const box = new THREE.Box3().setFromObject(root)
const min = box.min
const cx = (min.x + box.max.x) * 0.5
const cz = (min.z + box.max.z) * 0.5
root.position.set(-cx, -min.y, -cz)

root.updateMatrixWorld(true)
const v = new THREE.Vector3()
let maxHoriz = 0
root.traverse((o) => {
	if (o.isMesh && o.geometry) {
		const pos = o.geometry.attributes.position
		for (let i = 0; i < pos.count; i++) {
			v.fromBufferAttribute(pos, i)
			v.applyMatrix4(o.matrixWorld)
			const h = Math.hypot(v.x, v.z)
			if (h > maxHoriz) maxHoriz = h
		}
	}
})
if (maxHoriz < 1e-6) {
	throw new Error('dome mesh has no horizontal extent')
}
root.scale.setScalar(1 / maxHoriz)

mkdirSync(outDir, { recursive: true })

const scene = new THREE.Scene()
scene.add(root)

const exporter = new GLTFExporter()
const arrayBuffer = await exporter.parseAsync(scene, { binary: true })
writeFileSync(outPath, Buffer.from(arrayBuffer))

domeScriptLog.log(`Wrote ${outPath} (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB)`)
