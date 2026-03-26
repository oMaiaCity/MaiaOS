/**
 * Narrowest river cross-section (for bridge placement).
 */
import { PLANE_HALF } from './game-constants.js'
import { FLOW_DN_X, FLOW_DN_Y, riverCenterY, riverHalfWidth } from './river.js'
import { findMountainTopSpawnPosition, terrainPlaneWarp } from './terrain.js'

const SCAN_MARGIN = 160
const SCAN_STEP = 150

const FLOW_LEN = Math.hypot(FLOW_DN_X, FLOW_DN_Y)
const FLOW_DNX = FLOW_DN_X / FLOW_LEN

/** Shift bridge center toward bank opposite spawn, as a fraction of local half-width (~20–25%). */
const BRIDGE_OPP_BANK_SHIFT_FRAC = 0.225
/** Yaw (horizontal) as a fraction of a quarter-turn in the “left” sense on the opposite bank. */
const BRIDGE_YAW_FRAC_OF_QUARTER = 0.225

/**
 * @returns {{ wxN: number, cyN: number, hwN: number }}
 */
function computeNarrowestRiverSection() {
	let wxN = 0
	let cyN = 0
	let hwN = Infinity
	const x0 = -PLANE_HALF + SCAN_MARGIN
	const x1 = PLANE_HALF - SCAN_MARGIN
	for (let wx = x0; wx <= x1; wx += SCAN_STEP) {
		const cy = riverCenterY(wx)
		const hw = riverHalfWidth(wx, cy)
		if (hw < hwN) {
			hwN = hw
			wxN = wx
			cyN = cy
		}
	}
	return { wxN, cyN, hwN }
}

const NARROW = computeNarrowestRiverSection()

/** Bridge slightly downstream of the narrowest scan (keeps crossing at a workable width). */
const BRIDGE_DOWNSTREAM_METERS = 240

const PLACE = computeBridgePlace()

function computeBridgePlace() {
	let wx = NARROW.wxN + FLOW_DNX * BRIDGE_DOWNSTREAM_METERS
	let wy = riverCenterY(wx)
	const hw0 = riverHalfWidth(wx, wy)

	const sp = findMountainTopSpawnPosition()
	const { wx: sx, wy: sy } = terrainPlaneWarp(sp.playerX, -sp.playerZ)
	const cyS = riverCenterY(sx)
	const spawnSide = Math.sign(sy - cyS) || 1

	const perpX = -FLOW_DN_Y / FLOW_LEN
	const perpY = FLOW_DN_X / FLOW_LEN
	const shift = BRIDGE_OPP_BANK_SHIFT_FRAC * hw0
	wx += perpX * shift * -spawnSide
	wy += perpY * shift * -spawnSide

	const hw = riverHalfWidth(wx, wy)
	const yawRad = spawnSide * (Math.PI * 0.5) * BRIDGE_YAW_FRAC_OF_QUARTER

	return { wx, cy: wy, hw, yawRad }
}

export function getNarrowestRiverSection() {
	return NARROW
}

/**
 * River crossing used by the wood bridge (downstream of narrowest wx sample).
 * @returns {{ wx: number, cy: number, hw: number, yawRad: number }}
 */
export function getBridgePlacement() {
	return PLACE
}
