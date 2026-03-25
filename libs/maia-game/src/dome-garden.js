/**
 * Permaculture-style food garden ring in local space (parent: dome group).
 * Dense golden-angle packing; 20 variants per type; fruit, berry, veg (20 kinds), herbs,
 * plus vines, flower beds, bamboo, strawberry ground, citrus — one selectable unit with the dome.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

function mulberry32(seed) {
	let a = seed >>> 0
	return () => {
		a += 0x6d2b79f5
		let t = Math.imul(a ^ (a >>> 15), a | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/** Speckled gravel albedo for path strips (CanvasTexture, repeat in material). */
function createGravelTexture() {
	const c = document.createElement('canvas')
	c.width = 256
	c.height = 256
	const ctx = c.getContext('2d')
	if (!ctx) {
		return null
	}
	const rng = mulberry32(0x6a11e4)
	ctx.fillStyle = '#5c5a52'
	ctx.fillRect(0, 0, 256, 256)
	for (let i = 0; i < 14000; i++) {
		const v = 55 + rng() * 165
		const d = 18 + rng() * 55
		ctx.fillStyle = `rgb(${v - d * 0.35},${v - d * 0.28},${v - d * 0.42})`
		const x = rng() * 256
		const y = rng() * 256
		const s = 0.6 + rng() * 1.8
		ctx.fillRect(x, y, s, s * (0.7 + rng() * 0.6))
	}
	const tex = new THREE.CanvasTexture(c)
	tex.colorSpace = THREE.SRGBColorSpace
	tex.wrapS = THREE.RepeatWrapping
	tex.wrapT = THREE.RepeatWrapping
	tex.anisotropy = 8
	return tex
}

/**
 * Single continuous strip along one radial (two rows of verts, quads between).
 * @param {(lx: number, lz: number) => number} localY
 */
function buildRadialPathStripGeometry(theta, rStart, rEnd, halfW, radialSegments, localY) {
	const positions = []
	const uvs = []
	const indices = []
	const n = radialSegments + 1
	const px = -Math.cos(theta)
	const pz = Math.sin(theta)
	for (let i = 0; i < n; i++) {
		const t = i / radialSegments
		const r = rStart + t * (rEnd - rStart)
		const cx = Math.sin(theta) * r
		const cz = Math.cos(theta) * r
		const yL = localY(cx - px * halfW, cz - pz * halfW)
		const yR = localY(cx + px * halfW, cz + pz * halfW)
		positions.push(cx - px * halfW, yL, cz - pz * halfW)
		positions.push(cx + px * halfW, yR, cz + pz * halfW)
		uvs.push(0, t)
		uvs.push(1, t)
	}
	for (let i = 0; i < radialSegments; i++) {
		const b = i * 2
		indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2)
	}
	const geo = new THREE.BufferGeometry()
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
	geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
	geo.setIndex(indices)
	geo.computeVertexNormals()
	return geo
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

/** Trunk + canopy + a few fruit spheres — reads as small orchard tree. */
function fruitTreeGeometry(seed) {
	const rng = mulberry32(seed)
	const parts = []
	const th = 5 + rng() * 5
	const tr = 0.35 + rng() * 0.25
	const trunk = new THREE.CylinderGeometry(tr * 0.75, tr, th, 6, 1, false)
	trunk.translate(0, th * 0.5, 0)
	setVertexColor(trunk, 0.34, 0.22, 0.14)
	parts.push(trunk)
	const cy = th * 0.88
	const cr = 3 + rng() * 2.2
	const canopy = new THREE.SphereGeometry(cr, 7, 5)
	canopy.scale(1, 0.72, 1)
	canopy.translate(0, cy + cr * 0.35, 0)
	setVertexColor(canopy, 0.16 + rng() * 0.06, 0.42 + rng() * 0.12, 0.14 + rng() * 0.06)
	parts.push(canopy)
	const nf = 3 + (rng() > 0.45 ? 1 : 0)
	for (let i = 0; i < nf; i++) {
		const fx = (rng() - 0.5) * cr * 1.1
		const fz = (rng() - 0.5) * cr * 1.1
		const fr = 0.35 + rng() * 0.25
		const fruit = new THREE.SphereGeometry(fr, 5, 4)
		fruit.translate(fx, cy + cr * 0.5 + rng() * 0.4, fz)
		setVertexColor(fruit, 0.92, 0.38 + rng() * 0.15, 0.12)
		parts.push(fruit)
	}
	const merged = mergeGeometries(parts, false)
	for (const p of parts) p.dispose()
	merged.computeVertexNormals()
	return merged
}

/** Low spreading berry mound. */
function berryBushGeometry(seed) {
	const rng = mulberry32(seed)
	const parts = []
	const segs = 6
	for (let i = 0; i < 3; i++) {
		const h = 0.9 + rng() * 1.1
		const r = 1.8 + rng() * 1.6 - i * 0.35
		const c = new THREE.ConeGeometry(Math.max(0.45, r), h, segs, 1, false)
		c.translate((rng() - 0.5) * 1.2, h * 0.5 + i * 0.35, (rng() - 0.5) * 1.2)
		setVertexColor(c, 0.12 + rng() * 0.05, 0.32 + rng() * 0.1, 0.12 + rng() * 0.06)
		parts.push(c)
	}
	const merged = mergeGeometries(parts, false)
	for (const p of parts) p.dispose()
	merged.computeVertexNormals()
	return merged
}

/** Raised bed: frame + soil + rows — kinds 0–19 (two rotations of leaf / vine / brassica / root / legume / allium / nightshade / stem / corn / squash palettes). */
function vegRowGeometry(kind, seed) {
	const rng = mulberry32(seed + kind * 7919)
	const parts = []
	const w = 4.2 + rng() * 3.8
	const d = 1.35 + rng() * 1.0
	const wallH = 0.42 + rng() * 0.08
	const frame = new THREE.BoxGeometry(w + 0.35, wallH, d + 0.35)
	frame.translate(0, wallH * 0.5, 0)
	setVertexColor(frame, 0.36 + rng() * 0.06, 0.26 + rng() * 0.06, 0.16 + rng() * 0.05)
	parts.push(frame)
	const soil = new THREE.BoxGeometry(w * 0.92, 0.12, d * 0.88)
	soil.translate(0, wallH + 0.06, 0)
	setVertexColor(soil, 0.2 + rng() * 0.04, 0.15 + rng() * 0.04, 0.1 + rng() * 0.03)
	parts.push(soil)
	const rows = 2 + (rng() > 0.35 ? 1 : 0)
	const k = kind % 20
	const tall = k === 1 || k === 7 || k === 9 || k === 13 || k === 17
	const wideLeaf = k === 3 || k === 8 || k === 11 || k === 18
	for (let ri = 0; ri < rows; ri++) {
		const zOff = (ri / Math.max(1, rows - 1) - 0.5) * d * 0.55
		const n = 4 + Math.floor(rng() * 5)
		for (let i = 0; i < n; i++) {
			const xOff = (i / Math.max(1, n - 1) - 0.5) * w * 0.75
			const gw = (wideLeaf ? 0.28 : 0.2) + rng() * 0.14
			const gh = tall ? 0.5 + rng() * 0.5 : 0.28 + rng() * 0.38
			const gz = 0.12 + rng() * 0.1
			const box = new THREE.BoxGeometry(gw, gh, gz)
			box.translate(xOff, wallH + gh * 0.5 + 0.08, zOff)
			const vegRgb = [
				[0.2, 0.58, 0.22],
				[0.16, 0.52, 0.18],
				[0.26, 0.5, 0.18],
				[0.42, 0.34, 0.52],
				[0.62, 0.38, 0.2],
				[0.24, 0.48, 0.36],
				[0.34, 0.52, 0.28],
				[0.72, 0.22, 0.18],
				[0.38, 0.5, 0.32],
				[0.68, 0.62, 0.22],
				[0.18, 0.48, 0.52],
				[0.48, 0.2, 0.28],
				[0.52, 0.58, 0.42],
				[0.78, 0.58, 0.22],
				[0.32, 0.42, 0.62],
				[0.55, 0.48, 0.2],
				[0.28, 0.55, 0.38],
				[0.45, 0.35, 0.62],
				[0.22, 0.62, 0.36],
				[0.58, 0.52, 0.28],
			]
			const [vr, vg, vb] = vegRgb[k]
			setVertexColor(
				box,
				vr + (rng() - 0.5) * 0.08,
				vg + (rng() - 0.5) * 0.08,
				vb + (rng() - 0.5) * 0.06,
			)
			parts.push(box)
		}
	}
	if (tall && rng() > 0.15) {
		const pole = new THREE.BoxGeometry(0.1, 1.6 + rng() * 0.6, 0.1)
		pole.translate(0, wallH + 0.85 + rng() * 0.25, 0)
		setVertexColor(pole, 0.3, 0.22, 0.14)
		parts.push(pole)
	}
	const merged = mergeGeometries(parts, false)
	for (const p of parts) p.dispose()
	merged.computeVertexNormals()
	return merged
}

/** Grape / kiwi — posts, cross beam, leaf masses. */
function vineTrellisGeometry(seed) {
	const rng = mulberry32(seed)
	const parts = []
	const span = 3.2 + rng() * 1.4
	const postH = 1.8 + rng() * 0.8
	const pw = 0.18 + rng() * 0.06
	for (const sx of [-span * 0.5, span * 0.5]) {
		const post = new THREE.BoxGeometry(pw, postH, pw)
		post.translate(sx, postH * 0.5, 0)
		setVertexColor(post, 0.34, 0.24, 0.14)
		parts.push(post)
	}
	const beam = new THREE.BoxGeometry(span + 0.4, 0.14, 0.14)
	beam.translate(0, postH, 0)
	setVertexColor(beam, 0.32, 0.22, 0.12)
	parts.push(beam)
	const nLeaf = 5 + Math.floor(rng() * 4)
	for (let i = 0; i < nLeaf; i++) {
		const lx = (rng() - 0.5) * span * 0.85
		const lz = (rng() - 0.5) * 0.6
		const s = 0.45 + rng() * 0.55
		const leaf = new THREE.SphereGeometry(s, 5, 4)
		leaf.scale(1.1, 0.65, 0.9)
		leaf.translate(lx, postH * 0.35 + rng() * 0.9, lz)
		setVertexColor(leaf, 0.12 + rng() * 0.06, 0.48 + rng() * 0.12, 0.14 + rng() * 0.08)
		parts.push(leaf)
	}
	const merged = mergeGeometries(parts, false)
	for (const p of parts) p.dispose()
	merged.computeVertexNormals()
	return merged
}

/** Pollinator strip — soil + many small flower heads. */
function flowerBedGeometry(seed) {
	const rng = mulberry32(seed)
	const parts = []
	const w = 3.8 + rng() * 2.2
	const d = 1.2 + rng() * 0.7
	const wallH = 0.28
	const frame = new THREE.BoxGeometry(w + 0.25, wallH, d + 0.25)
	frame.translate(0, wallH * 0.5, 0)
	setVertexColor(frame, 0.34, 0.26, 0.18)
	parts.push(frame)
	const soil = new THREE.BoxGeometry(w * 0.9, 0.1, d * 0.88)
	soil.translate(0, wallH + 0.05, 0)
	setVertexColor(soil, 0.22, 0.16, 0.12)
	parts.push(soil)
	const palette = [
		[0.85, 0.35, 0.55],
		[0.92, 0.72, 0.2],
		[0.45, 0.55, 0.92],
		[0.95, 0.45, 0.2],
		[0.75, 0.4, 0.85],
		[0.95, 0.9, 0.35],
	]
	const nf = 14 + Math.floor(rng() * 10)
	for (let i = 0; i < nf; i++) {
		const fx = (rng() - 0.5) * w * 0.8
		const fz = (rng() - 0.5) * d * 0.75
		const fr = 0.12 + rng() * 0.14
		const stem = 0.15 + rng() * 0.25
		const fl = new THREE.SphereGeometry(fr, 5, 4)
		fl.translate(fx, wallH + stem, fz)
		const [cr, cg, cb] = palette[i % palette.length]
		setVertexColor(
			fl,
			cr + (rng() - 0.5) * 0.08,
			cg + (rng() - 0.5) * 0.08,
			cb + (rng() - 0.5) * 0.06,
		)
		parts.push(fl)
	}
	const merged = mergeGeometries(parts, false)
	for (const p of parts) p.dispose()
	merged.computeVertexNormals()
	return merged
}

/** Bamboo / giant grass clump. */
function bambooClumpGeometry(seed) {
	const rng = mulberry32(seed)
	const parts = []
	const n = 7 + Math.floor(rng() * 6)
	for (let i = 0; i < n; i++) {
		const ang = (i / n) * Math.PI * 2 + rng() * 0.5
		const rad = rng() * 0.85
		const h = 2.2 + rng() * 2.8
		const tr = 0.08 + rng() * 0.06
		const culm = new THREE.CylinderGeometry(tr * 0.85, tr, h, 5, 1, false)
		culm.translate(Math.sin(ang) * rad, h * 0.5, Math.cos(ang) * rad)
		setVertexColor(culm, 0.22 + rng() * 0.08, 0.42 + rng() * 0.1, 0.18 + rng() * 0.06)
		parts.push(culm)
	}
	const merged = mergeGeometries(parts, false)
	for (const p of parts) p.dispose()
	merged.computeVertexNormals()
	return merged
}

/** Strawberry / low ground-fruit mat. */
function strawberryGroundGeometry(seed) {
	const rng = mulberry32(seed)
	const parts = []
	const baseR = 2.0 + rng() * 1.4
	const mound = new THREE.CylinderGeometry(baseR, baseR * 1.05, 0.22, 12, 1, false)
	mound.translate(0, 0.11, 0)
	setVertexColor(mound, 0.14 + rng() * 0.05, 0.44 + rng() * 0.1, 0.16 + rng() * 0.06)
	parts.push(mound)
	const nl = 4 + Math.floor(rng() * 4)
	for (let i = 0; i < nl; i++) {
		const ang = rng() * Math.PI * 2
		const rr = rng() * baseR * 0.75
		const lump = new THREE.SphereGeometry(0.35 + rng() * 0.35, 5, 4)
		lump.scale(1, 0.55, 1)
		lump.translate(Math.sin(ang) * rr, 0.35 + rng() * 0.15, Math.cos(ang) * rr)
		setVertexColor(lump, 0.1 + rng() * 0.05, 0.5 + rng() * 0.1, 0.12 + rng() * 0.06)
		parts.push(lump)
	}
	const nb = 8 + Math.floor(rng() * 8)
	for (let i = 0; i < nb; i++) {
		const ang = rng() * Math.PI * 2
		const rr = rng() * baseR * 0.65
		const ber = new THREE.SphereGeometry(0.14 + rng() * 0.06, 4, 3)
		ber.translate(Math.sin(ang) * rr, 0.38 + rng() * 0.1, Math.cos(ang) * rr)
		setVertexColor(ber, 0.88 + rng() * 0.06, 0.18 + rng() * 0.08, 0.22 + rng() * 0.08)
		parts.push(ber)
	}
	const merged = mergeGeometries(parts, false)
	for (const p of parts) p.dispose()
	merged.computeVertexNormals()
	return merged
}

/** Dwarf citrus — shorter than orchard tree, round canopy, warm fruit. */
function citrusTreeGeometry(seed) {
	const rng = mulberry32(seed)
	const parts = []
	const th = 3.2 + rng() * 2.2
	const tr = 0.28 + rng() * 0.18
	const trunk = new THREE.CylinderGeometry(tr * 0.8, tr * 1.05, th, 6, 1, false)
	trunk.translate(0, th * 0.5, 0)
	setVertexColor(trunk, 0.32, 0.22, 0.13)
	parts.push(trunk)
	const cy = th * 0.82
	const cr = 2.2 + rng() * 1.6
	const canopy = new THREE.SphereGeometry(cr, 7, 5)
	canopy.scale(1, 0.78, 1)
	canopy.translate(0, cy + cr * 0.32, 0)
	setVertexColor(canopy, 0.14 + rng() * 0.05, 0.46 + rng() * 0.1, 0.12 + rng() * 0.05)
	parts.push(canopy)
	const nf = 4 + Math.floor(rng() * 3)
	for (let i = 0; i < nf; i++) {
		const fx = (rng() - 0.5) * cr * 1.0
		const fz = (rng() - 0.5) * cr * 1.0
		const fr = 0.28 + rng() * 0.18
		const fruit = new THREE.SphereGeometry(fr, 5, 4)
		fruit.translate(fx, cy + cr * 0.45 + rng() * 0.3, fz)
		setVertexColor(fruit, 0.95, 0.55 + rng() * 0.15, 0.12 + rng() * 0.08)
		parts.push(fruit)
	}
	const merged = mergeGeometries(parts, false)
	for (const p of parts) p.dispose()
	merged.computeVertexNormals()
	return merged
}

/** Low herb / ground-cover patch. */
function herbPatchGeometry(seed) {
	const rng = mulberry32(seed)
	const cyl = new THREE.CylinderGeometry(2.2 + rng() * 1.5, 2.4 + rng() * 1.6, 0.25, 10, 1, false)
	cyl.translate(0, 0.125, 0)
	setVertexColor(cyl, 0.14 + rng() * 0.06, 0.42 + rng() * 0.12, 0.14 + rng() * 0.08)
	return cyl
}

const dummy = new THREE.Object3D()
const Y_AXIS = new THREE.Vector3(0, 1, 0)

/** Extra scale so food plants read clearly next to forest trees. */
const GARDEN_VIS_SCALE = 1.45

/**
 * Local Y so plant base sits on heightfield (group origin is rim height; terrain varies in the ring).
 * @param {number} lx
 * @param {number} lz
 * @param {number} centerX
 * @param {number} centerZ
 * @param {number} groundY
 * @param {number} doorYaw
 * @param {(lx: number, ly: number) => number} terrainHeightAtPlaneXY
 */
export function localGardenYOnTerrain(
	lx,
	lz,
	centerX,
	centerZ,
	groundY,
	doorYaw,
	terrainHeightAtPlaneXY,
) {
	const v = new THREE.Vector3(lx, 0, lz)
	v.applyAxisAngle(Y_AXIS, doorYaw)
	const wx = centerX + v.x
	const wz = centerZ + v.z
	const h = terrainHeightAtPlaneXY(wx, -wz)
	return h - groundY
}

/**
 * @param {import('three').Group} root
 * @param {object} opts
 * @param {number} opts.centerX
 * @param {number} opts.centerZ
 * @param {number} opts.groundY
 * @param {number} opts.doorYaw
 * @param {(lx: number, ly: number) => number} opts.terrainHeightAtPlaneXY
 */
export function updateDomeGardenPositions(
	root,
	{ centerX, centerZ, groundY, doorYaw, terrainHeightAtPlaneXY },
) {
	const wp = root.userData.walkPathInst
	if (wp?.meshes) {
		for (const mesh of wp.meshes) {
			const posAttr = mesh.geometry.attributes.position
			for (let i = 0; i < posAttr.count; i++) {
				const lx = posAttr.getX(i)
				const lz = posAttr.getZ(i)
				const ly =
					localGardenYOnTerrain(lx, lz, centerX, centerZ, groundY, doorYaw, terrainHeightAtPlaneXY) +
					wp.yBias
				posAttr.setY(i, ly)
			}
			posAttr.needsUpdate = true
			mesh.geometry.computeVertexNormals()
		}
	}
	const layers = root.userData.gardenLayers
	if (!layers) {
		return
	}
	for (const { mesh, pts } of layers) {
		for (let i = 0; i < pts.length; i++) {
			const { x, z, rotY, sc } = pts[i]
			const ly = localGardenYOnTerrain(
				x,
				z,
				centerX,
				centerZ,
				groundY,
				doorYaw,
				terrainHeightAtPlaneXY,
			)
			dummy.position.set(x, ly, z)
			dummy.rotation.set(0, rotY, 0)
			dummy.scale.setScalar(sc * GARDEN_VIS_SCALE)
			dummy.updateMatrix()
			mesh.setMatrixAt(i, dummy.matrix)
		}
		mesh.instanceMatrix.needsUpdate = true
	}
}

/**
 * @param {object} opts
 * @param {number} opts.domeRadius — same units as dome shell (world/local)
 * @param {number} opts.centerX
 * @param {number} opts.centerZ
 * @param {number} opts.groundY — dome group Y (rim reference)
 * @param {number} opts.doorYaw
 * @param {(lx: number, ly: number) => number} opts.terrainHeightAtPlaneXY
 */
export function createDomeGardenGroup({
	domeRadius,
	centerX,
	centerZ,
	groundY,
	doorYaw,
	terrainHeightAtPlaneXY,
}) {
	const root = new THREE.Group()
	root.name = 'DomeGarden'

	const innerR = domeRadius + 12
	const outerR = domeRadius + 168
	const rng = mulberry32(0x70d4c1e7)

	/** Half-width of gravel strips (m); same value excludes plant centers from path corridors. */
	const PATH_HALF_WIDTH = 1.05 * 3
	const radialAngles = [0, 1, 2, 3, 4].map((k) => (k / 5) * Math.PI * 2 + 0.11)
	function clearOfWalkingPaths(x, z) {
		for (const th of radialAngles) {
			const perp = Math.abs(x * Math.cos(th) - z * Math.sin(th))
			if (perp < PATH_HALF_WIDTH) {
				return false
			}
		}
		return true
	}

	const pathYBias = 0.025
	const pathHalfW = PATH_HALF_WIDTH
	const PATH_R_START = 5
	const PATH_R_END = outerR - 4
	const PATH_RADIAL_SUBDIV = 56
	const gravelMap = createGravelTexture()
	const pathMat = new THREE.MeshStandardMaterial({
		color: gravelMap ? 0xffffff : 0x8f7f62,
		map: gravelMap ?? undefined,
		roughness: 0.91,
		metalness: 0.04,
		envMapIntensity: 0.34,
	})
	if (pathMat.map) {
		pathMat.map.repeat.set(3.2 * 3, 42)
	}
	function pathLocalY(lx, lz) {
		return (
			localGardenYOnTerrain(lx, lz, centerX, centerZ, groundY, doorYaw, terrainHeightAtPlaneXY) +
			pathYBias
		)
	}
	const pathStripMeshes = []
	for (const th of radialAngles) {
		const geo = buildRadialPathStripGeometry(
			th,
			PATH_R_START,
			PATH_R_END,
			pathHalfW,
			PATH_RADIAL_SUBDIV,
			pathLocalY,
		)
		const mesh = new THREE.Mesh(geo, pathMat)
		mesh.name = 'DomeGardenWalkPath'
		mesh.receiveShadow = true
		mesh.castShadow = false
		root.add(mesh)
		pathStripMeshes.push(mesh)
	}
	root.userData.walkPathInst = {
		meshes: pathStripMeshes,
		yBias: pathYBias,
	}

	const VARIANTS = 20
	const fruitGeos = []
	const berryGeos = []
	const vegGeos = []
	const herbGeos = []
	const vineGeos = []
	const flowerGeos = []
	const bambooGeos = []
	const strawberryGeos = []
	const citrusGeos = []
	for (let v = 0; v < VARIANTS; v++) {
		const s = v * 0x1337
		fruitGeos.push(fruitTreeGeometry(0x310 + s))
		berryGeos.push(berryBushGeometry(0x520 + s))
		vegGeos.push(vegRowGeometry(v, 0xa100 + v * 0x211))
		herbGeos.push(herbPatchGeometry(0x630 + s))
		vineGeos.push(vineTrellisGeometry(0x740 + s))
		flowerGeos.push(flowerBedGeometry(0x850 + s))
		bambooGeos.push(bambooClumpGeometry(0x960 + s))
		strawberryGeos.push(strawberryGroundGeometry(0xa70 + s))
		citrusGeos.push(citrusTreeGeometry(0xb80 + s))
	}

	const mat = new THREE.MeshStandardMaterial({
		vertexColors: true,
		roughness: 0.84,
		metalness: 0.04,
		envMapIntensity: 0.52,
	})

	const fruitPtsByV = Array.from({ length: VARIANTS }, () => [])
	const berryPtsByV = Array.from({ length: VARIANTS }, () => [])
	const vegPtsByKind = Array.from({ length: VARIANTS }, () => [])
	const herbPtsByV = Array.from({ length: VARIANTS }, () => [])
	const vinePtsByV = Array.from({ length: VARIANTS }, () => [])
	const flowerPtsByV = Array.from({ length: VARIANTS }, () => [])
	const bambooPtsByV = Array.from({ length: VARIANTS }, () => [])
	const strawberryPtsByV = Array.from({ length: VARIANTS }, () => [])
	const citrusPtsByV = Array.from({ length: VARIANTS }, () => [])

	/** Golden-angle disk packing in the annulus — reads as a full polyculture bed, not a single line. */
	const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
	const GUILD_CYCLE = 11
	/** More samples than placed instances — skips under path corridors (wider paths need more tries). */
	const PLANT_COUNT = 2480

	for (let i = 0; i < PLANT_COUNT; i++) {
		const u = (i + 0.5) / PLANT_COUNT
		const r = innerR + (outerR - innerR) * Math.sqrt(u)
		const theta = i * GOLDEN_ANGLE + (rng() - 0.5) * 0.08
		const rJ = THREE.MathUtils.clamp(r + (rng() - 0.5) * 1.1, innerR - 0.8, outerR + 0.8)
		const x = Math.sin(theta) * rJ
		const z = Math.cos(theta) * rJ
		if (!clearOfWalkingPaths(x, z)) {
			continue
		}
		const rotY = theta + (rng() - 0.5) * 0.35
		const sc = 0.38 + 0.36 * Math.sqrt(u) + (rng() - 0.5) * 0.06
		const guild = i % GUILD_CYCLE
		const cycle = Math.floor(i / GUILD_CYCLE)
		const variant = cycle % VARIANTS
		const pt = { x, z, rotY, sc }
		const ptBerry = { x, z, rotY, sc: sc * 1.02 }
		const ptVeg = { x, z, rotY: rotY + (rng() - 0.5) * 0.35, sc: sc * 0.86 }
		const ptHerb = { x, z, rotY, sc: sc * 1.03 }
		const ptVine = { x, z, rotY: rotY + (rng() - 0.5) * 0.2, sc: sc * 0.92 }
		const ptFlower = { x, z, rotY: rotY + (rng() - 0.5) * 0.3, sc: sc * 0.9 }
		const ptBamboo = { x, z, rotY, sc: sc * 1.08 }
		const ptBerryGround = { x, z, rotY, sc: sc * 1.01 }
		const ptCitrus = { x, z, rotY, sc: sc * 0.96 }
		if (guild === 0) {
			fruitPtsByV[variant].push(pt)
		} else if (guild === 1) {
			berryPtsByV[variant].push(ptBerry)
		} else if (guild === 2) {
			vegPtsByKind[(cycle * 3) % VARIANTS].push(ptVeg)
		} else if (guild === 3) {
			vegPtsByKind[(cycle * 3 + 5) % VARIANTS].push(ptVeg)
		} else if (guild === 4) {
			vegPtsByKind[(cycle * 3 + 11) % VARIANTS].push(ptVeg)
		} else if (guild === 5) {
			herbPtsByV[variant].push(ptHerb)
		} else if (guild === 6) {
			vinePtsByV[variant].push(ptVine)
		} else if (guild === 7) {
			flowerPtsByV[variant].push(ptFlower)
		} else if (guild === 8) {
			bambooPtsByV[variant].push(ptBamboo)
		} else if (guild === 9) {
			strawberryPtsByV[variant].push(ptBerryGround)
		} else {
			citrusPtsByV[variant].push(ptCitrus)
		}
	}

	const layers = []

	function fillInst(geom, pts) {
		if (pts.length === 0) {
			geom.dispose()
			return null
		}
		const im = new THREE.InstancedMesh(geom, mat, pts.length)
		im.castShadow = true
		im.receiveShadow = true
		for (let i = 0; i < pts.length; i++) {
			const { x, z, rotY, sc } = pts[i]
			const ly = localGardenYOnTerrain(
				x,
				z,
				centerX,
				centerZ,
				groundY,
				doorYaw,
				terrainHeightAtPlaneXY,
			)
			dummy.position.set(x, ly, z)
			dummy.rotation.set(0, rotY, 0)
			dummy.scale.setScalar(sc * GARDEN_VIS_SCALE)
			dummy.updateMatrix()
			im.setMatrixAt(i, dummy.matrix)
		}
		im.instanceMatrix.needsUpdate = true
		layers.push({ mesh: im, pts })
		return im
	}

	for (let v = 0; v < VARIANTS; v++) {
		const f = fillInst(fruitGeos[v], fruitPtsByV[v])
		if (f) root.add(f)
	}
	for (let v = 0; v < VARIANTS; v++) {
		const b = fillInst(berryGeos[v], berryPtsByV[v])
		if (b) root.add(b)
	}
	for (let k = 0; k < VARIANTS; k++) {
		const vg = fillInst(vegGeos[k], vegPtsByKind[k])
		if (vg) root.add(vg)
	}
	for (let v = 0; v < VARIANTS; v++) {
		const h = fillInst(herbGeos[v], herbPtsByV[v])
		if (h) root.add(h)
	}
	for (let v = 0; v < VARIANTS; v++) {
		const vn = fillInst(vineGeos[v], vinePtsByV[v])
		if (vn) root.add(vn)
	}
	for (let v = 0; v < VARIANTS; v++) {
		const fl = fillInst(flowerGeos[v], flowerPtsByV[v])
		if (fl) root.add(fl)
	}
	for (let v = 0; v < VARIANTS; v++) {
		const bb = fillInst(bambooGeos[v], bambooPtsByV[v])
		if (bb) root.add(bb)
	}
	for (let v = 0; v < VARIANTS; v++) {
		const sg = fillInst(strawberryGeos[v], strawberryPtsByV[v])
		if (sg) root.add(sg)
	}
	for (let v = 0; v < VARIANTS; v++) {
		const ct = fillInst(citrusGeos[v], citrusPtsByV[v])
		if (ct) root.add(ct)
	}

	root.userData.gardenLayers = layers

	return root
}

/**
 * @param {import('three').Object3D} root
 */
export function disposeDomeGardenGroup(root) {
	const materials = new Set()
	root.traverse((o) => {
		if (o.isMesh) {
			o.geometry?.dispose()
			const mats = o.material
			if (Array.isArray(mats)) {
				for (const m of mats) materials.add(m)
			} else if (mats) {
				materials.add(mats)
			}
		}
	})
	for (const m of materials) m.dispose()
}
