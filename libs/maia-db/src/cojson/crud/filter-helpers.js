/**
 * Filter Helpers
 *
 * Provides helpers for filtering CoValue data.
 */

/**
 * Check if CoValue data matches filter criteria
 * @param {Object|Array} data - CoValue data (object for CoMap, array for CoList)
 * @param {Object} filter - Filter criteria
 * @returns {boolean} True if matches filter
 */
export function matchesFilter(data, filter) {
	// For arrays (CoList), filter applies to items
	if (Array.isArray(data)) {
		return data.some((item) => {
			for (const [key, value] of Object.entries(filter)) {
				// Use strict equality check (handles boolean, null, undefined correctly)
				if (item[key] !== value) {
					return false
				}
			}
			return true
		})
	}

	// For objects (CoMap), filter applies to properties
	if (data && typeof data === 'object') {
		for (const [key, value] of Object.entries(filter)) {
			// Use strict equality check (handles boolean, null, undefined correctly)
			// This ensures {done: false} matches items where done === false (not just falsy)
			if (data[key] !== value) {
				return false
			}
		}
		return true
	}

	return false
}
