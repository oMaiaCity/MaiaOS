import { ensureCoValueLoaded } from '../crud/collection-helpers.js'
import { INFRA_SLOTS } from '../infra-slot-manifest.js'

/**
 * Load infra factory co-ids from named slots on `spark.os` (written at seed) into `peer.infra`.
 * No catalog scan, no namekey/nanoid resolution.
 *
 * @param {object} peer
 * @param {string} osId
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<void>}
 */
export async function loadInfraFromSparkOs(peer, osId, options = {}) {
	const { timeoutMs = 5000 } = options
	if (!osId?.startsWith?.('co_z')) {
		throw new Error('[loadInfraFromSparkOs] osId must be a co_z id')
	}
	const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true, timeoutMs })
	if (!osCore || !peer.getCurrentContent) {
		throw new Error('[loadInfraFromSparkOs] spark.os not available')
	}
	const os = peer.getCurrentContent(osCore)
	/** @type {Record<string, string>} */
	const entries = {}
	for (const { slotKey, infraKey } of INFRA_SLOTS) {
		const v = os.get?.(slotKey)
		if (typeof v !== 'string' || !v.startsWith('co_z')) {
			throw new Error(`[infra] spark.os slot missing or not co_z: ${slotKey}`)
		}
		entries[infraKey] = v
	}
	peer.infra = Object.freeze(entries)
}
