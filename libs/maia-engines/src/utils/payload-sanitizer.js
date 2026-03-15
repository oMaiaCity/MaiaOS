/**
 * Payload sanitizer for interface validation.
 * Strips CoJSON metadata, normalizes interface/definition for list-detail SELECT_ITEM.
 * Used by ViewEngine (before deliver) and InboxEngine (before validateMessage).
 */

/** CoJSON metadata keys to strip (additionalProperties: false fails on these) */
const COJSON_METADATA_KEYS = new Set(['_coValueType', 'cotype', 'groupInfo', 'loading', 'error'])

/** Interface array items must be exactly { name: string } (additionalProperties: false) */
function normalizeInterfaceItem(x) {
	if (x == null) return { name: '' }
	if (typeof x === 'string') return { name: x }
	if (typeof x === 'object' && 'name' in x) return { name: String(x.name ?? '') }
	if (typeof x === 'object') return { name: String(x.id ?? x.key ?? Object.keys(x)[0] ?? '') }
	return { name: String(x) }
}

/**
 * Convert object to array for interface field.
 * - Object with numeric keys 0,1,2,... → array of { name } (CoList-like)
 * - Object with properties (schema-like) → array of { name: key }
 */
function interfaceToArray(val) {
	if (val == null) return []
	if (Array.isArray(val)) return val.map(normalizeInterfaceItem)
	if (typeof val !== 'object') return []
	const keys = Object.keys(val)
	if (keys.length === 0) return []
	const numericKeys = keys.every((k) => /^\d+$/.test(k))
	if (numericKeys) {
		return keys.sort((a, b) => Number(a) - Number(b)).map((k) => normalizeInterfaceItem(val[k]))
	}
	// Schema-like: { properties: { X: {...}, Y: {...} } } → [{ name: "X" }, { name: "Y" }]
	const props = val.properties || val
	if (typeof props === 'object' && props !== null) {
		return Object.keys(props)
			.filter((k) => !k.startsWith('$'))
			.map((k) => ({ name: k }))
	}
	// Fallback: [{ name: key }, ...]
	return keys.filter((k) => !k.startsWith('$')).map((k) => ({ name: k }))
}

/**
 * Strip infrastructure keys (replyTo, etc.) for schema validation.
 * Keeps payload intact for process; use only the result for validation.
 */
export function stripInfrastructureKeysForValidation(payload) {
	if (!payload || typeof payload !== 'object') return payload
	const { replyTo, ...rest } = payload
	return rest
}

/**
 * Sanitize payload for interface validation.
 * - Strip CoJSON metadata (_coValueType, cotype, etc.)
 * - Stringify definition when object (for-schemas)
 * - Convert interface from object to array (for-actors)
 */
export function sanitizePayloadForValidation(payload) {
	if (!payload || typeof payload !== 'object') return payload
	if (Array.isArray(payload)) return payload.map(sanitizePayloadForValidation)
	const result = {}
	for (const [k, v] of Object.entries(payload)) {
		if (COJSON_METADATA_KEYS.has(k)) continue
		if (k === 'definition' && v != null && typeof v === 'object') {
			result[k] = JSON.stringify(v, null, 2)
		} else if (k === 'interface') {
			if (Array.isArray(v)) {
				result[k] = v.map(normalizeInterfaceItem)
			} else if (v != null && typeof v === 'object') {
				result[k] = interfaceToArray(v)
			} else if (typeof v === 'string') {
				result[k] = [] // Schema ref string -> empty array (satisfies type: array)
			} else {
				result[k] = v
			}
		} else if (k === 'item' && v != null && typeof v === 'object') {
			// SELECT_ITEM item: restrict to id, label, definition, interface, wasmCode, hasWasmCode
			const allowed = ['id', 'label', 'definition', 'interface', 'wasmCode', 'hasWasmCode']
			const sub = {}
			for (const key of allowed) {
				if (key in v) {
					const val = v[key]
					if (key === 'interface') {
						if (Array.isArray(val)) sub[key] = val.map(normalizeInterfaceItem)
						else if (val != null && typeof val === 'object') sub[key] = interfaceToArray(val)
						else if (typeof val === 'string') sub[key] = []
						else sub[key] = []
					} else if (key === 'definition' && val != null && typeof val === 'object') {
						sub[key] = JSON.stringify(val, null, 2)
					} else if (key === 'id' && val != null && typeof val === 'object') {
						// CoValue ref: extract id string
						sub[key] = String(val.id ?? val.$id ?? val.coId ?? '')
					} else if (key === 'label' && val != null && typeof val === 'object') {
						// CoValue ref: extract label string
						sub[key] = String(val['@label'] ?? val.label ?? val.name ?? '')
					} else if (!COJSON_METADATA_KEYS.has(key)) {
						sub[key] =
							val != null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof File)
								? sanitizePayloadForValidation(val)
								: val
					}
				}
			}
			result[k] = sub
		} else if (v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof File)) {
			result[k] = sanitizePayloadForValidation(v)
		} else {
			result[k] = v
		}
	}
	return result
}
