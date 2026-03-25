/**
 * River surface ribbon (shader) + semi-transparent volume under the corridor.
 */
import * as THREE from 'three'
import { PLANE_HALF } from './game-constants.js'
import {
	riverBedElevationFlow,
	riverCenterY,
	riverHalfWidth,
	WATER_DEPTH,
	WATER_FLOW_SPEED,
	WATER_SEGMENTS,
} from './river.js'

/**
 * Semi-transparent volume under the surface: riverbed + side walls (open top — surface mesh caps it).
 */
export function createRiverWaterVolumeMesh() {
	const n = WATER_SEGMENTS
	const margin = 160
	const x0 = -PLANE_HALF + margin
	const x1 = PLANE_HALF - margin
	const positions = []
	const indices = []

	function vert(x, y, z) {
		positions.push(x, y, z)
		return positions.length / 3 - 1
	}

	function quad(a, b, c, d) {
		indices.push(a, b, c, a, c, d)
	}

	function sectionWx(t) {
		return x0 + t * (x1 - x0)
	}

	for (let i = 0; i < n - 1; i++) {
		const t0 = n > 1 ? i / (n - 1) : 0
		const t1 = (i + 1) / (n - 1)
		const wx0 = sectionWx(t0)
		const wx1 = sectionWx(t1)
		const cy0 = riverCenterY(wx0)
		const cy1 = riverCenterY(wx1)
		const hw0 = riverHalfWidth(wx0, cy0) * 0.82
		const hw1 = riverHalfWidth(wx1, cy1) * 0.82
		const wyL0 = cy0 - hw0
		const wyR0 = cy0 + hw0
		const wyL1 = cy1 - hw1
		const wyR1 = cy1 + hw1

		const b0L = riverBedElevationFlow(wx0, wyL0)
		const b0R = riverBedElevationFlow(wx0, wyR0)
		const b1L = riverBedElevationFlow(wx1, wyL1)
		const b1R = riverBedElevationFlow(wx1, wyR1)
		const s0 = riverBedElevationFlow(wx0, cy0) + WATER_DEPTH
		const s1 = riverBedElevationFlow(wx1, cy1) + WATER_DEPTH

		const B00 = vert(wx0, wyL0, b0L)
		const B01 = vert(wx0, wyR0, b0R)
		const B11 = vert(wx1, wyR1, b1R)
		const B10 = vert(wx1, wyL1, b1L)
		quad(B00, B10, B11, B01)

		const T00 = vert(wx0, wyL0, s0)
		const T10 = vert(wx1, wyL1, s1)
		quad(B00, T00, T10, B10)

		const T01 = vert(wx0, wyR0, s0)
		const T11 = vert(wx1, wyR1, s1)
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
 * Ribbon mesh along the river centerline at bed + WATER_DEPTH; ShaderMaterial ripples + downstream UV scroll.
 * @param {THREE.Fog} fog
 */
export function createRiverWaterMesh(fog) {
	const n = WATER_SEGMENTS
	const margin = 160
	const x0 = -PLANE_HALF + margin
	const x1 = PLANE_HALF - margin
	const verts = n * 2
	const positions = new Float32Array(verts * 3)
	const uvs = new Float32Array(verts * 2)
	for (let i = 0; i < n; i++) {
		const t = n > 1 ? i / (n - 1) : 0
		const wx = x0 + t * (x1 - x0)
		const cy = riverCenterY(wx)
		const hw = riverHalfWidth(wx, cy) * 0.82
		const wyL = cy - hw
		const wyR = cy + hw
		const h = riverBedElevationFlow(wx, cy) + WATER_DEPTH
		const i0 = i * 2
		const i1 = i * 2 + 1
		positions[i0 * 3] = wx
		positions[i0 * 3 + 1] = wyL
		positions[i0 * 3 + 2] = h
		positions[i1 * 3] = wx
		positions[i1 * 3 + 1] = wyR
		positions[i1 * 3 + 2] = h
		uvs[i0 * 2] = t
		uvs[i0 * 2 + 1] = 0
		uvs[i1 * 2] = t
		uvs[i1 * 2 + 1] = 1
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
