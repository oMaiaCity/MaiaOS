/**
 * Collect capability CoMap co-ids from a schema index CoList view (peer getCurrentContent, or MaiaDB store value).
 * @param {object|null|undefined} content - CoList content from peer, or store value
 * @returns {string[]}
 */
export function collectCapabilityGrantCoIdsFromColistContent(content) {
	if (!content) return []
	if (content.type !== undefined && content.type !== 'colist') return []

	let items = content.items
	if (items == null && typeof content.toJSON === 'function') {
		try {
			const j = content.toJSON()
			if (Array.isArray(j)) {
				return j.filter((id) => typeof id === 'string' && id.startsWith('co_z'))
			}
			if (j && typeof j === 'object' && !(j instanceof Uint8Array) && Array.isArray(j.items)) {
				items = j.items
			}
		} catch {
			return []
		}
	}
	if (items == null) return []
	return collectCoIdsFromItemsShape(items)
}

/**
 * @param {unknown} items - Flat list (MaiaDB store shape)
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
