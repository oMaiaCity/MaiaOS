/**
 * Load nano-ID → co_z mappings from spark.os.factories (12-char alphanumeric keys only).
 */

import { ensureCoValueLoaded } from '../../cojson/crud/collection-helpers.js'
import * as groups from '../../cojson/groups/groups.js'

const MAIA_SPARK = '°maia'

/** Nano-IDs produced by @MaiaOS/factories/nanoid (12 chars, [0-9A-Za-z]). */
export const NANOID_KEY_PATTERN = /^[0-9A-Za-z]{12}$/

/**
 * @param {import('../../cojson/core/MaiaDB.js').MaiaDB} peer
 * @returns {Promise<Map<string, string>>}
 */
export async function loadNanoidRegistryFromSpark(peer) {
	const map = new Map()
	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (!osId) return map
	const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
	if (!osCore || !peer.isAvailable(osCore)) return map
	const osContent = peer.getCurrentContent(osCore)
	const factoriesId = osContent?.get?.('factories')
	if (!factoriesId?.startsWith?.('co_z')) return map
	const factoriesCore = await ensureCoValueLoaded(peer, factoriesId, { waitForAvailable: true })
	if (!factoriesCore || !peer.isAvailable(factoriesCore)) return map
	const factoriesContent = peer.getCurrentContent(factoriesCore)
	const keys =
		typeof factoriesContent?.keys === 'function'
			? Array.from(factoriesContent.keys())
			: Object.keys(factoriesContent ?? {})
	for (const key of keys) {
		if (typeof key !== 'string' || !NANOID_KEY_PATTERN.test(key)) continue
		const coId = factoriesContent.get(key)
		if (coId?.startsWith?.('co_z')) map.set(key, coId)
	}
	return map
}
