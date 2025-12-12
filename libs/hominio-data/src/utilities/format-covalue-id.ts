/**
 * CoValue ID Formatting Utility
 * Framework-agnostic utility for formatting CoValue IDs for display
 */

/**
 * Format CoValue ID for display (truncate if needed)
 */
export function formatCoValueId(id: string, maxLength: number = 16): string {
	if (!id) return 'unknown'
	if (id.length <= maxLength) return id
	return `${id.slice(0, maxLength)}...`
}

/**
 * Truncate a string to a maximum length
 */
export function truncateId(id: string, maxLength: number = 8): string {
	if (!id) return ''
	if (id.length <= maxLength) return id
	return `${id.slice(0, maxLength)}...`
}

/**
 * Get display label from CoValue
 * Tries @label first, then falls back to truncated ID
 */
export function getDisplayLabel(coValue: any): string {
	if (!coValue) return ''

	try {
		// Try @label first
		if (coValue.$isLoaded && coValue.$jazz?.has('@label')) {
			const label = coValue['@label']
			if (label && typeof label === 'string' && label.trim()) {
				return label
			}
		}

		// Fallback to truncated ID
		if (coValue.$jazz?.id) {
			return formatCoValueId(coValue.$jazz.id, 8)
		}

		return 'Unknown'
	} catch (_e) {
		return 'Unknown'
	}
}

/**
 * Format display label with fallback
 */
export function formatDisplayLabel(coValue: any, fallback: string = 'Loading...'): string {
	const label = getDisplayLabel(coValue)
	return label || fallback
}

