/**
 * Unified account bootstrap handshake.
 *
 * Single POST /bootstrap call that:
 *   - triggers server-side guardian promotion + identity indexing (both idempotent)
 *   - returns the canonical `sparks` registry co-id
 *
 * Client sets `account.sparks` with default (private) privacy. CoJSON rejects 'trusting' writes on an account
 * for any key outside the whitelisted set (readKey/groupSealer/profile/root/key-reveals/parent-extensions/writeKeys
 * or valid role assignments); 'sparks' with a co_z value would be parsed as setRole('sparks', '<invalid role>') and
 * marked invalid. Private works because the account's readKey is sealed for the agent's sealer secret — any signed-in
 * agent can decrypt immediately, no cross-peer sync required.
 *
 * Replaces: anchorSparksOnSignup + ensureHumanIdentityForCurrentAccount + server scheduleGuardianAdminPromotion.
 */

import { BOOTSTRAP_PHASES, BootstrapError, setBootstrapPhase } from './bootstrap-phase.js'
import { TIMEOUT_HTTP, TIMEOUT_STORAGE_PERSIST } from './timeouts.js'

/**
 * @param {import('cojson').RawAccount} account - client's RawAccount (id + profile already present)
 * @param {Object} options
 * @param {string} options.syncBaseUrl - sync HTTP base URL (no trailing slash required)
 * @param {import('cojson').LocalNode} [options.node] - optional; when provided, waits for storage sync of account + sparks after anchoring
 * @param {number} [options.httpTimeoutMs] - optional override
 * @returns {Promise<{ sparks: string }>}
 */
export async function bootstrapAccountHandshake(account, options) {
	const { syncBaseUrl, node, httpTimeoutMs = TIMEOUT_HTTP } = options ?? {}
	if (!account?.set || typeof account.get !== 'function') {
		throw new BootstrapError(
			BOOTSTRAP_PHASES.HANDSHAKE,
			'bootstrapAccountHandshake: account (RawAccount) required',
		)
	}
	const accountId = account.id ?? account?.$jazz?.id
	const profileId = account.get('profile')
	if (!accountId?.startsWith?.('co_z') || !profileId?.startsWith?.('co_z')) {
		throw new BootstrapError(
			BOOTSTRAP_PHASES.HANDSHAKE,
			'bootstrapAccountHandshake: account id + profile co-id required',
		)
	}
	const base = typeof syncBaseUrl === 'string' ? syncBaseUrl.replace(/\/$/, '') : ''
	if (!base) {
		throw new BootstrapError(
			BOOTSTRAP_PHASES.HANDSHAKE,
			'bootstrapAccountHandshake: syncBaseUrl required',
		)
	}

	setBootstrapPhase(BOOTSTRAP_PHASES.HANDSHAKE, { accountId: accountId.slice(0, 12) })

	let res
	try {
		const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
		const timer = controller ? setTimeout(() => controller.abort(), httpTimeoutMs) : null
		try {
			res = await fetch(`${base}/bootstrap`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ accountId, profileId }),
				...(controller ? { signal: controller.signal } : {}),
			})
		} finally {
			if (timer) clearTimeout(timer)
		}
	} catch (fetchErr) {
		throw new BootstrapError(
			BOOTSTRAP_PHASES.HANDSHAKE,
			`[Maia] /bootstrap fetch failed: ${fetchErr?.message ?? fetchErr}`,
			{ cause: fetchErr, retryable: true },
		)
	}
	if (!res.ok) {
		throw new BootstrapError(
			BOOTSTRAP_PHASES.HANDSHAKE,
			`[Maia] /bootstrap failed: HTTP ${res.status}`,
			{ retryable: res.status >= 500 },
		)
	}
	let data
	try {
		data = await res.json()
	} catch (parseErr) {
		throw new BootstrapError(
			BOOTSTRAP_PHASES.HANDSHAKE,
			`[Maia] /bootstrap response parse error: ${parseErr?.message ?? parseErr}`,
			{ cause: parseErr },
		)
	}
	const sparksId = data?.sparks
	if (!sparksId?.startsWith?.('co_z')) {
		throw new BootstrapError(
			BOOTSTRAP_PHASES.HANDSHAKE,
			'[Maia] /bootstrap response missing sparks co-id',
		)
	}

	setBootstrapPhase(BOOTSTRAP_PHASES.ANCHORING_SPARKS, { sparks: sparksId.slice(0, 12) })

	const existing = account.get('sparks')
	if (existing !== sparksId) {
		account.set('sparks', sparksId)
		const readBack = account.get('sparks')
		if (readBack !== sparksId) {
			throw new BootstrapError(
				BOOTSTRAP_PHASES.ANCHORING_SPARKS,
				`[Maia] account.set('sparks') did not apply (have ${readBack}, expected ${sparksId})`,
			)
		}
	}

	const wfs = node?.syncManager?.waitForStorageSync
	if (typeof wfs === 'function') {
		const storageRace = async () => {
			await Promise.race([
				Promise.all([wfs.call(node.syncManager, accountId), wfs.call(node.syncManager, sparksId)]),
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error(`waitForStorageSync timeout after ${TIMEOUT_STORAGE_PERSIST}ms`)),
						TIMEOUT_STORAGE_PERSIST,
					),
				),
			])
		}
		try {
			await storageRace()
		} catch (syncErr) {
			throw new BootstrapError(
				BOOTSTRAP_PHASES.ANCHORING_SPARKS,
				`[Maia] sparks anchor not persisted: ${syncErr?.message ?? syncErr}`,
				{ cause: syncErr, retryable: true },
			)
		}
	}

	return { sparks: sparksId }
}
