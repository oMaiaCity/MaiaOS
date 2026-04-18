/**
 * Pure validation for POST /bootstrap (unified account anchor + identity handshake).
 *
 * Single input path: both humans and agents call this same endpoint on first boot
 * (idempotent when already anchored). See services/sync/src/index.js -> handleBootstrap.
 */

/**
 * @param {unknown} body
 * @returns
 *   | { ok: true, accountId: string, profileId: string }
 *   | { ok: false, field: 'accountId' | 'profileId' }
 */
export function parseBootstrapBody(body) {
	const { accountId, profileId } = body ?? {}
	if (typeof accountId !== 'string' || !accountId.startsWith('co_z')) {
		return { ok: false, field: 'accountId' }
	}
	if (typeof profileId !== 'string' || !profileId.startsWith('co_z')) {
		return { ok: false, field: 'profileId' }
	}
	return { ok: true, accountId, profileId }
}
