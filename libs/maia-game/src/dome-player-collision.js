import { angleWithinArc } from './dome-placement.js'

/**
 * Single-dome rim / door collision (same rules as maia-game player loop).
 * @param {object} p
 * @param {number} p.playerX
 * @param {number} p.playerZ
 * @param {number} p.prevX
 * @param {number} p.prevZ
 * @param {number} p.domeCx
 * @param {number} p.domeCz
 * @param {number} p.doorAngleCenter
 * @param {boolean} p.domeLegitInterior
 * @param {number} p.domeRadius
 * @param {number} p.domeDoorGap
 * @returns {{ playerX: number, playerZ: number, domeLegitInterior: boolean }}
 */
export function applyDomeRimCollision(p) {
	const {
		playerX: pxIn,
		playerZ: pzIn,
		prevX,
		prevZ,
		domeCx,
		domeCz,
		doorAngleCenter,
		domeLegitInterior,
		domeRadius,
		domeDoorGap,
	} = p
	let playerX = pxIn
	let playerZ = pzIn
	const prevD = Math.hypot(prevX - domeCx, prevZ - domeCz)
	const d = Math.hypot(playerX - domeCx, playerZ - domeCz)
	const ang = Math.atan2(playerX - domeCx, playerZ - domeCz)
	const doorHalfArc = domeDoorGap / 2 + 0.08
	const inDoorArc = angleWithinArc(ang, doorAngleCenter, doorHalfArc)
	const rimIn = domeRadius - 1.5
	let domeLegit = domeLegitInterior
	const inwardCross = prevD >= rimIn && d < rimIn
	const outwardCross = prevD < rimIn && d >= rimIn
	if (inwardCross) {
		if (inDoorArc) {
			domeLegit = true
		} else {
			playerX = prevX
			playerZ = prevZ
		}
	} else if (outwardCross) {
		if (inDoorArc) {
			domeLegit = false
		} else {
			playerX = prevX
			playerZ = prevZ
		}
	} else if (d < rimIn && !domeLegitInterior) {
		const dx = playerX - domeCx
		const dz = playerZ - domeCz
		const len = Math.hypot(dx, dz) || 1
		const push = (rimIn + 0.5) / len
		playerX = domeCx + dx * push
		playerZ = domeCz + dz * push
	} else if (d >= rimIn && prevD >= rimIn) {
		domeLegit = false
	}
	return { playerX, playerZ, domeLegitInterior: domeLegit }
}
