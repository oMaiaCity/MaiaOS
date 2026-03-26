/**
 * Procedural wood deck + vertical posts at the narrowest river cross-section.
 */
import * as THREE from 'three'
import { riverBedElevationFlow, WATER_DEPTH } from './river.js'
import { getBridgePlacement } from './river-junction-terrain.js'
import { terrainHeightAtPlaneXY } from './terrain.js'

const DECK_INSET = 0.9
const DECK_WIDTH = 50
const DECK_THICK = 2.1
/** Lateral inset from deck edge for walkable clamp (matches rail inner clearance). */
const DECK_SIDE_MARGIN = 0.42
const RAIL_WIDTH = 0.38
const RAIL_HEIGHT = 2.5
/** East-bank ramp: length along bridge axis beyond deck (local +Z when east end is +Z). */
const RAMP_LENGTH = 28
const RAMP_INSET = 0.92
const CLEARANCE_ABOVE_WATER = 15
const STEM_COUNT = 4
const STEM_TOP_R = 0.62 * 6
const STEM_BOT_R = 0.78 * 6

/** Extra half-extents beyond the deck for approach paths (water unblock + height ramp). */
const APPROACH_WIDTH_EXTRA = 52
const APPROACH_SPAN_EXTRA = 175

/** World offset (dx,dz) from bridge center → local XZ matching Three.js group.rotation.y (inverse of R_y). */
function localBridgeXZ(px, pz, fp) {
	const dx = px - fp.wxB
	const dz = pz - fp.worldZCenter
	const c = Math.cos(fp.yawRad)
	const s = Math.sin(fp.yawRad)
	const lx = c * dx - s * dz
	const lz = s * dx + c * dz
	return { lx, lz }
}

/** Distance from inner deck rectangle; 0 when on or inside the deck footprint. */
function distOutsideDeckInner(lx, lz, hw, hs) {
	const ox = Math.abs(lx) - hw
	const oz = Math.abs(lz) - hs
	if (ox <= 0 && oz <= 0) {
		return 0
	}
	if (ox > 0 && oz > 0) {
		return Math.hypot(ox, oz)
	}
	return Math.max(ox, oz)
}

function computeBridgeLayout() {
	const { wx: wxB, cy: cyB, hw: hwB, yawRad } = getBridgePlacement()
	const span = 2 * hwB * DECK_INSET
	const surfY = riverBedElevationFlow(wxB, cyB) + WATER_DEPTH
	const deckCenterY = surfY + CLEARANCE_ABOVE_WATER + DECK_THICK * 0.5
	const deckTopY = deckCenterY + DECK_THICK * 0.5
	const deckBottomY = deckCenterY - DECK_THICK * 0.5
	return { wxB, cyB, hwB, span, surfY, deckCenterY, deckTopY, deckBottomY, yawRad }
}

/**
 * World-space deck footprint (XZ) + top surface Y for movement / camera.
 */
export function getBridgeWorldFootprint() {
	const L = computeBridgeLayout()
	return {
		wxB: L.wxB,
		cyB: L.cyB,
		worldZCenter: -L.cyB,
		halfWidthX: DECK_WIDTH * 0.5,
		halfSpanZ: L.span * 0.5,
		deckTopY: L.deckTopY,
		yawRad: L.yawRad,
	}
}

/**
 * @param {number} px
 * @param {number} pz
 * @param {ReturnType<typeof getBridgeWorldFootprint>} fp
 */
export function isPointOnBridgeDeck(px, pz, fp) {
	const { lx, lz } = localBridgeXZ(px, pz, fp)
	return Math.abs(lx) <= fp.halfWidthX && Math.abs(lz) <= fp.halfSpanZ
}

/**
 * World XZ from bridge-local (lx, lz); lz is along the span, lx across the deck.
 */
function worldXZFromBridgeLocal(lx, lz, fp) {
	const c = Math.cos(fp.yawRad)
	const s = Math.sin(fp.yawRad)
	const dx = c * lx + s * lz
	const dz = -s * lx + c * lz
	return { px: fp.wxB + dx, pz: fp.worldZCenter + dz }
}

/**
 * While within the bridge span, keep the player between the guard rails (no walking off the sides).
 * @param {number} px
 * @param {number} pz
 * @param {ReturnType<typeof getBridgeWorldFootprint>} fp
 */
export function clampPlayerToBridgeSides(px, pz, fp) {
	const { lx, lz } = localBridgeXZ(px, pz, fp)
	if (Math.abs(lz) > fp.halfSpanZ) {
		return { x: px, z: pz }
	}
	const maxLx = fp.halfWidthX - DECK_SIDE_MARGIN
	const nlx = THREE.MathUtils.clamp(lx, -maxLx, maxLx)
	if (nlx === lx) {
		return { x: px, z: pz }
	}
	const w = worldXZFromBridgeLocal(nlx, lz, fp)
	return { x: w.px, z: w.pz }
}

/**
 * Expanded OBB: allows walking onto the deck from banks without water collision blocking first.
 */
export function isInBridgeCrossingWaterExemptZone(px, pz, fp) {
	const { lx, lz } = localBridgeXZ(px, pz, fp)
	const hw = fp.halfWidthX + APPROACH_WIDTH_EXTRA
	const hs = fp.halfSpanZ + APPROACH_SPAN_EXTRA
	return Math.abs(lx) <= hw && Math.abs(lz) <= hs
}

/**
 * Terrain height with ramp up to deck in the approach ring (avoids blob stuck under deck edges).
 * @param {number} px
 * @param {number} pz
 * @param {ReturnType<typeof getBridgeWorldFootprint>} fp
 */
export function sampleBridgeGroundY(px, pz, fp) {
	const t = terrainHeightAtPlaneXY(px, -pz)
	const { lx, lz } = localBridgeXZ(px, pz, fp)
	const hw = fp.halfWidthX
	const hs = fp.halfSpanZ
	const ew = APPROACH_WIDTH_EXTRA
	const es = APPROACH_SPAN_EXTRA
	if (Math.abs(lx) > hw + ew || Math.abs(lz) > hs + es) {
		return t
	}
	const d = distOutsideDeckInner(lx, lz, hw, hs)
	/** Epsilon: FP + inverse-rotation noise should still count as “on deck”. */
	if (d <= 1e-4) {
		return fp.deckTopY
	}
	const ramp = Math.max(ew, es, 1)
	const blend = 1 - THREE.MathUtils.smoothstep(d, 0, ramp)
	return THREE.MathUtils.lerp(t, fp.deckTopY, blend)
}

/**
 * @returns {{ group: import('three').Group, dispose: () => void }}
 */
export function createRiverWoodBridgeGroup() {
	const L = computeBridgeLayout()
	const { wxB, cyB, span, deckCenterY, deckBottomY, yawRad } = L

	const woodMat = new THREE.MeshStandardMaterial({
		color: 0x5a3d24,
		roughness: 0.92,
		metalness: 0.02,
		envMapIntensity: 0.35,
	})

	const group = new THREE.Group()
	group.name = 'RiverWoodBridge'
	group.position.set(wxB, deckCenterY, -cyB)
	group.rotation.y = yawRad

	const deckGeom = new THREE.BoxGeometry(DECK_WIDTH, DECK_THICK, span)
	const deck = new THREE.Mesh(deckGeom, woodMat)
	deck.castShadow = true
	deck.receiveShadow = true
	group.add(deck)

	const railMat = new THREE.MeshStandardMaterial({
		color: 0x3d2814,
		roughness: 0.88,
		metalness: 0.04,
		envMapIntensity: 0.35,
	})
	const railSpan = Math.max(span - 1.2, span * 0.96)
	const railGeom = new THREE.BoxGeometry(RAIL_WIDTH, RAIL_HEIGHT, railSpan)
	const railY = DECK_THICK * 0.5 + RAIL_HEIGHT * 0.5
	const railX = DECK_WIDTH * 0.5 - RAIL_WIDTH * 0.5
	for (const sign of [-1, 1]) {
		const rail = new THREE.Mesh(railGeom, railMat)
		rail.castShadow = true
		rail.receiveShadow = true
		rail.position.set(sign * railX, railY, 0)
		group.add(rail)
	}

	/** Bridge end toward world +X (east bank); ramp extends outward along local ±Z. */
	const sinY = Math.sin(yawRad)
	const eastSign = Math.abs(sinY) > 1e-6 ? Math.sign(sinY) : 1
	const localZEnd = eastSign * span * 0.5
	const innerZ = localZEnd - eastSign * 0.35
	const outerZ = localZEnd + eastSign * RAMP_LENGTH
	const xHalf = DECK_WIDTH * 0.5 * RAMP_INSET
	const fpRamp = {
		wxB,
		worldZCenter: -cyB,
		yawRad,
		halfWidthX: DECK_WIDTH * 0.5,
		halfSpanZ: span * 0.5,
		deckTopY: L.deckTopY,
	}
	function terrainYLocal(lx, lz) {
		const { px, pz } = worldXZFromBridgeLocal(lx, lz, fpRamp)
		return terrainHeightAtPlaneXY(px, -pz) - deckCenterY
	}
	const yOutL = terrainYLocal(-xHalf, outerZ)
	const yOutR = terrainYLocal(xHalf, outerZ)
	const deckTopLocal = DECK_THICK * 0.5
	const rampGeom = new THREE.BufferGeometry()
	const rp = new Float32Array([
		-xHalf,
		deckTopLocal,
		innerZ,
		xHalf,
		deckTopLocal,
		innerZ,
		xHalf,
		yOutR,
		outerZ,
		-xHalf,
		yOutL,
		outerZ,
	])
	rampGeom.setAttribute('position', new THREE.BufferAttribute(rp, 3))
	rampGeom.setIndex([0, 1, 2, 0, 2, 3])
	rampGeom.computeVertexNormals()
	const rampMat = woodMat.clone()
	rampMat.side = THREE.DoubleSide
	const ramp = new THREE.Mesh(rampGeom, rampMat)
	ramp.castShadow = true
	ramp.receiveShadow = true
	group.add(ramp)

	const geoms = [deckGeom, railGeom, rampGeom]

	const wyStart = cyB - span * 0.5
	for (let i = 0; i < STEM_COUNT; i++) {
		const t = (i + 0.5) / STEM_COUNT
		const wi = wyStart + t * span
		const footY = terrainHeightAtPlaneXY(wxB, wi)
		let stemH = deckBottomY - footY
		if (stemH < 0.6) {
			stemH = 0.6
		}
		const yMid = footY + stemH * 0.5
		const cylGeom = new THREE.CylinderGeometry(STEM_TOP_R, STEM_BOT_R, stemH, 12, 1, false)
		const cyl = new THREE.Mesh(cylGeom, woodMat)
		cyl.castShadow = true
		cyl.receiveShadow = true
		cyl.position.set(0, yMid - deckCenterY, cyB - wi)
		group.add(cyl)
		geoms.push(cylGeom)
	}

	function dispose() {
		for (const g of geoms) {
			g.dispose()
		}
		woodMat.dispose()
		rampMat.dispose()
		railMat.dispose()
	}

	return { group, dispose }
}
