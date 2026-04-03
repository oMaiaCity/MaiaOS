/**
 * Collect capability CoMap co-ids from a CoStream view (peer getCurrentContent, or MaiaDB store value).
 * Handles session buckets `{ [sessionId]: [{ value: co_z }] }`, flat `items: [co_z | { value }]`,
 * and RawCoStreamView `toJSON()` when `items` is missing on the live view.
 *
 * @param {object|null|undefined} content - CoStream content from peer, or `{ type, items }` from store
 * @returns {string[]}
 */
export function collectCapabilityGrantCoIdsFromStreamContent(content) {
	if (!content) return []
	if (content.type !== undefined && content.type !== 'costream') return []

	let items = content.items
	if (items == null && typeof content.toJSON === 'function') {
		try {
			const j = content.toJSON()
			if (j && typeof j === 'object' && !(j instanceof Uint8Array)) {
				items = j
			}
		} catch {
			return []
		}
	}
	if (items == null) return []
	return collectCoIdsFromItemsShape(items)
}

/**
 * @param {unknown} items - Session map or flat list (MaiaDB store shape)
 * @returns {string[]}
 */
function collectCoIdsFromItemsShape(items) {
	const ids = []
	if (Array.isArray(items)) {
		for (const item of items) {
			if (typeof item === 'string' && item.startsWith('co_z')) ids.push(item)
			else if (item && typeof item.value === 'string' && item.value.startsWith('co_z'))
				ids.push(item.value)
		}
		return ids
	}
	if (typeof items === 'object') {
		for (const val of Object.values(items)) {
			if (!Array.isArray(val)) continue
			for (const item of val) {
				if (typeof item === 'string' && item.startsWith('co_z')) ids.push(item)
				else if (item && typeof item.value === 'string' && item.value.startsWith('co_z'))
					ids.push(item.value)
			}
		}
	}
	return ids
}
