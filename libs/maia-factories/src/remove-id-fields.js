/**
 * Recursively remove 'id' fields from schema objects (AJV only accepts $id, not id).
 * Preserve 'id' in properties/items (valid property names in JSON Schema).
 */
export function removeIdFields(obj, inPropertiesOrItems = false) {
	if (obj === null || obj === undefined) {
		return obj
	}

	if (typeof obj !== 'object') {
		return obj
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => removeIdFields(item, inPropertiesOrItems))
	}

	const cleaned = {}
	for (const [key, value] of Object.entries(obj)) {
		if (key === 'id' && !inPropertiesOrItems) {
			continue
		}

		if (value !== null && value !== undefined && typeof value === 'object') {
			const isPropertiesOrItems = key === 'properties' || key === 'items'
			cleaned[key] = removeIdFields(value, isPropertiesOrItems || inPropertiesOrItems)
		} else {
			cleaned[key] = value
		}
	}

	return cleaned
}
