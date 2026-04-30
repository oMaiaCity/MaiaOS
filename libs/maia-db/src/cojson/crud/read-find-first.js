import { ensureCoValueLoaded, getCoListId } from './collection-helpers.js'
import { extractCoValueData } from './data-extraction.js'
import { matchesFilter } from './filter-helpers.js'

/**
 * Lightweight existence check - first matching item by filter.
 * No store, no subscriptions. Used for gate checks (e.g. idempotency).
 * Keeps read/display path pure progressive $stores.
 *
 * @param {Object} peer - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @param {Object} filter - Filter criteria (e.g. { sourceMessageId: 'xyz' })
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutMs=2000] - Timeout for loading colist/items
 * @returns {Promise<Object|null>} First matching item with id, or null
 */
export async function findFirst(peer, schema, filter, options = {}) {
	const { timeoutMs = 2000 } = options
	if (!filter || typeof filter !== 'object') return null

	const coListId = await getCoListId(peer, schema)
	if (!coListId) return null

	const coListCore = peer.getCoValue(coListId)
	if (!coListCore) return null

	await ensureCoValueLoaded(peer, coListId, { waitForAvailable: true, timeoutMs })
	if (!peer.isAvailable(coListCore)) return null

	const content = peer.getCurrentContent(coListCore)
	if (!content?.toJSON) return null

	const itemIds = content.toJSON()
	const seenIds = new Set()

	for (const itemId of itemIds) {
		if (typeof itemId !== 'string' || !itemId.startsWith('co_') || seenIds.has(itemId)) continue
		seenIds.add(itemId)

		await ensureCoValueLoaded(peer, itemId, { waitForAvailable: true, timeoutMs })
		const itemCore = peer.getCoValue(itemId)
		if (!itemCore || !peer.isAvailable(itemCore)) continue

		const itemData = extractCoValueData(peer, itemCore)
		const dataKeys = Object.keys(itemData).filter((k) => !['id', 'type', '$factory'].includes(k))
		if (dataKeys.length === 0 && itemData.type === 'comap') continue

		if (matchesFilter(itemData, filter)) {
			return { ...itemData, id: itemId }
		}
	}
	return null
}
