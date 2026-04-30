/**
 * CoMap array format: [{key, value}, ...] → {key: value, ...}
 * CoJSON may store nested maps this way. Normalize once at extraction so all consumers get plain objects.
 */
function isCoMapKeyValueArray(arr) {
	return (
		Array.isArray(arr) &&
		arr.length > 0 &&
		arr.every((x) => x && typeof x === 'object' && 'key' in x && 'value' in x)
	)
}

const OMIT_FROM_PERSISTED_PAYLOAD = new Set(['maiaPathKey'])

/**
 * Normalize CoValue data to plain JS (single implementation for read and write).
 * Handles: CoMap array [{key,value}], CoMap-like (.get/.keys), JSON strings.
 * @param {any} data - Data to normalize
 * @returns {any} Normalized plain JS (objects, arrays, primitives)
 */
export function normalizeCoValueData(data) {
	if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
		try {
			const parsed = JSON.parse(data)
			return normalizeCoValueData(parsed)
		} catch (_e) {
			return data // Keep as string if not valid JSON
		}
	} else if (Array.isArray(data)) {
		// CoMap array format [{key, value}] → convert to object for JSON Schema / consumers
		if (isCoMapKeyValueArray(data)) {
			const obj = {}
			for (const { key, value: v } of data) {
				if (OMIT_FROM_PERSISTED_PAYLOAD.has(key)) continue
				obj[key] = normalizeCoValueData(v)
			}
			return obj
		}
		return data.map((item) => normalizeCoValueData(item))
	} else if (
		typeof data === 'object' &&
		data !== null &&
		typeof data.get === 'function' &&
		typeof data.keys === 'function'
	) {
		// CoMap-like (nested CoMap): Object.entries() does not extract content; use .keys() and .get()
		const result = {}
		for (const k of data.keys()) {
			if (OMIT_FROM_PERSISTED_PAYLOAD.has(k)) continue
			result[k] = normalizeCoValueData(data.get(k))
		}
		return result
	} else if (typeof data === 'object' && data !== null) {
		const result = {}
		for (const [key, val] of Object.entries(data)) {
			if (OMIT_FROM_PERSISTED_PAYLOAD.has(key)) continue
			result[key] = normalizeCoValueData(val)
		}
		return result
	}
	return data // Primitives (numbers, booleans, null) pass through
}
