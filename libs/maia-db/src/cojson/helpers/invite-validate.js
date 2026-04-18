/**
 * Invite CoValue validation (future: paywall / strict mode).
 * Permissive default — always ok until MAIA_INVITE_REQUIRED wiring lands.
 */

/**
 * @param {import('../core/MaiaDB.js').MaiaDB} _peer
 * @param {string} [_inviteCoId]
 * @param {{ sub?: string }} [_opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateInvite(_peer, _inviteCoId, _opts) {
	return { ok: true, reason: 'permissive' }
}
