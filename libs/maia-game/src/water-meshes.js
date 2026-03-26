/**
 * River surface ribbon (shader) + semi-transparent volume under the corridor.
 * Meshes march normalized arc s ∈ [0, 1] along the polyline centerline.
 */
import * as THREE from 'three'
import { inverseTerrainPlaneWarp } from './plane-warp.js'
import {
	closestPointOnRiverPolyline,
	riverBedElevationFlow,
	riverCenterlinePointAtS,
	riverHalfWidthAtS,
	riverTangentAtS,
	WATER_FLOW_SPEED,
	WATER_MESH_HALF_WIDTH_SCALE,
	WATER_SEGMENTS,
	WATER_SURFACE_ABOVE_BED,
} from './river.js'
import { clampRiverSurfaceToTerrain } from './water-terrain-alignment.js'

/** Terrain mesh uses plane (lx, ly); river math uses warped (wx, wy). Map corners to plane space. */
function toPlaneXY(wx, wy) {
	return inverseTerrainPlaneWarp(wx, wy)
}

/**
 * Segment bank offsets use local tangents; global closest-point can differ, so points can leave the
 * carved corridor after inverse warp — clamp in warped space to the same half-width rule as terrain.
 */
function clampWarpedCorridor(wx, wy, widthFrac) {
	const c = closestPointOnRiverPolyline(wx, wy)
	if (c.dist > 1e12) {
		return { wx, wy }
	}
	const hw = riverHalfWidthAtS(c.sNorm)
	const maxD = Math.max(hw * widthFrac - 0.35, 2)
	if (c.dist <= maxD) {
		return { wx, wy }
	}
	const dx = wx - c.px
	const dy = wy - c.py
	const len = Math.hypot(dx, dy) || 1
	const t = maxD / len
	return { wx: c.px + dx * t, wy: c.py + dy * t }
}

function flowTAtRibbonVertex(i, n) {
	if (n <= 1) {
		return 0
	}
	return i / (n - 1)
}

function flowUvAlongRiver(flowT) {
	return THREE.MathUtils.clamp(flowT, 0, 1)
}

/**
 * Semi-transparent volume under the surface: riverbed + side walls (open top — surface mesh caps it).
 */
export function createRiverWaterVolumeMesh() {
	const n = WATER_SEGMENTS
	const positions = []
	const indices = []

	function vert(x, y, z) {
		positions.push(x, y, z)
		return positions.length / 3 - 1
	}

	function quad(a, b, c, d) {
		indices.push(a, b, c, a, c, d)
	}

	for (let i = 0; i < n - 1; i++) {
		const flowT0 = flowTAtRibbonVertex(i, n)
		const flowT1 = flowTAtRibbonVertex(i + 1, n)
		const p0 = riverCenterlinePointAtS(flowT0)
		const p1 = riverCenterlinePointAtS(flowT1)
		const t0 = riverTangentAtS(flowT0)
		const t1 = riverTangentAtS(flowT1)
		const px0 = -t0.ty
		const py0 = t0.tx
		const px1 = -t1.ty
		const py1 = t1.tx
		const hw0 = riverHalfWidthAtS(flowT0) * WATER_MESH_HALF_WIDTH_SCALE
		const hw1 = riverHalfWidthAtS(flowT1) * WATER_MESH_HALF_WIDTH_SCALE
		let wx0L = p0.wx + px0 * hw0
		let wy0L = p0.wy + py0 * hw0
		let wx0R = p0.wx - px0 * hw0
		let wy0R = p0.wy - py0 * hw0
		let wx1L = p1.wx + px1 * hw1
		let wy1L = p1.wy + py1 * hw1
		let wx1R = p1.wx - px1 * hw1
		let wy1R = p1.wy - py1 * hw1
		;({ wx: wx0L, wy: wy0L } = clampWarpedCorridor(wx0L, wy0L, WATER_MESH_HALF_WIDTH_SCALE))
		;({ wx: wx0R, wy: wy0R } = clampWarpedCorridor(wx0R, wy0R, WATER_MESH_HALF_WIDTH_SCALE))
		;({ wx: wx1L, wy: wy1L } = clampWarpedCorridor(wx1L, wy1L, WATER_MESH_HALF_WIDTH_SCALE))
		;({ wx: wx1R, wy: wy1R } = clampWarpedCorridor(wx1R, wy1R, WATER_MESH_HALF_WIDTH_SCALE))

		const b0L = riverBedElevationFlow(wx0L, wy0L)
		const b0R = riverBedElevationFlow(wx0R, wy0R)
		const b1L = riverBedElevationFlow(wx1L, wy1L)
		const b1R = riverBedElevationFlow(wx1R, wy1R)

		const p00L = toPlaneXY(wx0L, wy0L)
		const p00R = toPlaneXY(wx0R, wy0R)
		const p10L = toPlaneXY(wx1L, wy1L)
		const p10R = toPlaneXY(wx1R, wy1R)

		const int0L = b0L + WATER_SURFACE_ABOVE_BED
		const int0R = b0R + WATER_SURFACE_ABOVE_BED
		const int1L = b1L + WATER_SURFACE_ABOVE_BED
		const int1R = b1R + WATER_SURFACE_ABOVE_BED
		const s0L = clampRiverSurfaceToTerrain(p00L.lx, p00L.ly, int0L, b0L)
		const s0R = clampRiverSurfaceToTerrain(p00R.lx, p00R.ly, int0R, b0R)
		const s1L = clampRiverSurfaceToTerrain(p10L.lx, p10L.ly, int1L, b1L)
		const s1R = clampRiverSurfaceToTerrain(p10R.lx, p10R.ly, int1R, b1R)

		const B00 = vert(p00L.lx, p00L.ly, b0L)
		const B01 = vert(p00R.lx, p00R.ly, b0R)
		const B11 = vert(p10R.lx, p10R.ly, b1R)
		const B10 = vert(p10L.lx, p10L.ly, b1L)
		quad(B00, B10, B11, B01)

		const T00 = vert(p00L.lx, p00L.ly, s0L)
		const T10 = vert(p10L.lx, p10L.ly, s1L)
		quad(B00, T00, T10, B10)

		const T01 = vert(p00R.lx, p00R.ly, s0R)
		const T11 = vert(p10R.lx, p10R.ly, s1R)
		quad(B01, B11, T11, T01)
	}

	const geo = new THREE.BufferGeometry()
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
	geo.setIndex(indices)
	geo.computeVertexNormals()

	const mat = new THREE.MeshPhysicalMaterial({
		color: 0x0a4d5e,
		transparent: true,
		opacity: 0.42,
		roughness: 0.42,
		metalness: 0,
		side: THREE.DoubleSide,
		depthWrite: false,
		fog: true,
		polygonOffset: true,
		polygonOffsetFactor: 2,
		polygonOffsetUnits: 3,
	})
	const mesh = new THREE.Mesh(geo, mat)
	mesh.rotation.x = -Math.PI / 2
	mesh.renderOrder = 0
	return { mesh, geo, mat }
}

/**
 * Ribbon mesh along the river centerline at bed + WATER_SURFACE_ABOVE_BED; ShaderMaterial ripples + downstream UV scroll.
 * @param {THREE.Fog} fog
 */
export function createRiverWaterMesh(fog) {
	const n = WATER_SEGMENTS
	const verts = n * 2
	const positions = new Float32Array(verts * 3)
	const uvs = new Float32Array(verts * 2)
	for (let i = 0; i < n; i++) {
		const flowT = flowTAtRibbonVertex(i, n)
		const p = riverCenterlinePointAtS(flowT)
		const { tx, ty } = riverTangentAtS(flowT)
		const px = -ty
		const py = tx
		const hw = riverHalfWidthAtS(flowT) * WATER_MESH_HALF_WIDTH_SCALE
		let wxL = p.wx + px * hw
		let wyL = p.wy + py * hw
		let wxR = p.wx - px * hw
		let wyR = p.wy - py * hw
		;({ wx: wxL, wy: wyL } = clampWarpedCorridor(wxL, wyL, WATER_MESH_HALF_WIDTH_SCALE))
		;({ wx: wxR, wy: wyR } = clampWarpedCorridor(wxR, wyR, WATER_MESH_HALF_WIDTH_SCALE))
		const pl = toPlaneXY(wxL, wyL)
		const pr = toPlaneXY(wxR, wyR)
		const bedL = riverBedElevationFlow(wxL, wyL)
		const bedR = riverBedElevationFlow(wxR, wyR)
		const hL = clampRiverSurfaceToTerrain(pl.lx, pl.ly, bedL + WATER_SURFACE_ABOVE_BED, bedL)
		const hR = clampRiverSurfaceToTerrain(pr.lx, pr.ly, bedR + WATER_SURFACE_ABOVE_BED, bedR)
		const uAlong = flowUvAlongRiver(flowT)
		const row = i * 2
		const row1 = i * 2 + 1
		positions[row * 3] = pl.lx
		positions[row * 3 + 1] = pl.ly
		positions[row * 3 + 2] = hL
		positions[row1 * 3] = pr.lx
		positions[row1 * 3 + 1] = pr.ly
		positions[row1 * 3 + 2] = hR
		uvs[row * 2] = uAlong
		uvs[row * 2 + 1] = 0
		uvs[row1 * 2] = uAlong
		uvs[row1 * 2 + 1] = 1
	}
	const indices = []
	for (let i = 0; i < n - 1; i++) {
		const a = i * 2
		const b = i * 2 + 1
		const c = (i + 1) * 2 + 1
		const d = (i + 1) * 2
		indices.push(a, b, c, a, c, d)
	}
	const geo = new THREE.BufferGeometry()
	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
	geo.setIndex(indices)
	geo.computeVertexNormals()

	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uFlowSpeed: { value: WATER_FLOW_SPEED },
			uFogColor: { value: fog.color.clone() },
			uFogNear: { value: fog.near },
			uFogFar: { value: fog.far },
		},
		vertexShader: `
			uniform float uTime;
			varying vec2 vUv;
			varying float vFogDepth;
			void main() {
				vUv = uv;
				vec3 pos = position;
				float damp = 1.0 / (1.0 + max(0.0, cameraPosition.y - 120.0) * 0.0015);
				float w = (sin(position.x * 0.012 + uTime * 2.3) * 0.12
					+ sin(position.y * 0.014 + uTime * 1.8) * 0.1) * damp;
				pos.z += w;
				vec4 mv = modelViewMatrix * vec4(pos, 1.0);
				vFogDepth = -mv.z;
				gl_Position = projectionMatrix * mv;
			}
		`,
		fragmentShader: `
			uniform float uTime;
			uniform float uFlowSpeed;
			uniform vec3 uFogColor;
			uniform float uFogNear;
			uniform float uFogFar;
			varying vec2 vUv;
			varying float vFogDepth;
			void main() {
				vec2 uv = vUv;
				uv.x += uTime * uFlowSpeed;
				vec3 shallow = vec3(0.18, 0.48, 0.58);
				vec3 deep = vec3(0.08, 0.22, 0.38);
				vec3 water = mix(deep, shallow, uv.y * 0.5 + 0.25 + 0.08 * sin(uv.x * 18.0 + uTime * 1.2));
				float fogF = smoothstep(uFogNear, uFogFar, vFogDepth);
				vec3 col = mix(water, uFogColor, fogF);
				gl_FragColor = vec4(col, 0.74);
			}
		`,
		transparent: true,
		depthWrite: false,
		depthTest: true,
		polygonOffset: true,
		polygonOffsetFactor: 4,
		polygonOffsetUnits: 6,
		side: THREE.DoubleSide,
	})
	const mesh = new THREE.Mesh(geo, mat)
	mesh.rotation.x = -Math.PI / 2
	mesh.renderOrder = 1
	return { mesh, geo, mat }
}
