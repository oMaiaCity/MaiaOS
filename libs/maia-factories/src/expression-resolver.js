/**
 * Resolves MaiaScript expressions in payloads ($key, $$key, DSL ops).
 * DOM markers (@inputValue) handled by View Engine. JSON Schema keywords ($ref, $schema) are data.
 */

/** JSON Schema keywords - data, not expressions */
const JSON_SCHEMA_KEYS = new Set([
	'$schema',
	'$id',
	'$ref',
	'$defs',
	'$anchor',
	'$dynamicRef',
	'$dynamicAnchor',
	'$recursiveRef',
	'$recursiveAnchor',
	'$vocabulary',
	'$comment',
	'$async',
	'$co', // MaiaOS CoJSON schema reference (e.g. { $co: "°maia/factory/action" })
])
export async function resolveExpressions(payload, evaluator, data) {
	// Handle string expressions (e.g., "$$result", "$context.key")
	// CRITICAL: Strings starting with $ are MaiaScript expressions and must be evaluated
	if (typeof payload === 'string' && payload.startsWith('$')) {
		return await evaluator.evaluate(payload, data)
	}

	// Handle other primitives (pass through)
	if (payload === null || typeof payload !== 'object') {
		return payload
	}

	// Preserve File/Blob — do NOT recurse (would rebuild as plain object, break instanceof File)
	if (typeof File !== 'undefined' && payload instanceof File) return payload
	if (typeof Blob !== 'undefined' && payload instanceof Blob && !(payload instanceof File))
		return payload

	// Handle arrays - recursively resolve each element
	if (Array.isArray(payload)) {
		return Promise.all(payload.map((item) => resolveExpressions(item, evaluator, data)))
	}

	// Handle objects
	const keys = Object.keys(payload)

	// Check if this entire object is a DSL operation (like { $if: {...} })
	// DSL operations have a single key starting with $ (but NOT $$, which are dynamic key refs)
	// JSON Schema keywords ($ref, $schema, etc.) are DATA, not expressions - recurse into value
	if (keys.length === 1 && keys[0].startsWith('$') && !keys[0].startsWith('$$')) {
		if (JSON_SCHEMA_KEYS.has(keys[0])) {
			return { [keys[0]]: await resolveExpressions(payload[keys[0]], evaluator, data) }
		}
		return await evaluator.evaluate(payload, data)
	}

	// Handle regular objects - recursively resolve all properties
	const resolved = {}
	for (const [key, value] of Object.entries(payload)) {
		const resolvedKey = key.startsWith('$$')
			? String((await evaluator.evaluate(key, data)) ?? key)
			: key
		if (value && typeof value === 'object') {
			if (evaluator.isDSLOperation(value)) {
				resolved[resolvedKey] = await evaluator.evaluate(value, data)
			} else {
				resolved[resolvedKey] = await resolveExpressions(value, evaluator, data)
			}
		} else {
			resolved[resolvedKey] = await evaluator.evaluate(value, data)
		}
	}

	return resolved
}

/** Returns true if payload contains unresolved expressions */
export function containsExpressions(payload) {
	// Handle primitives - no expressions possible
	if (payload === null || payload === undefined) {
		return false
	}

	// Handle strings - check for expression patterns
	if (typeof payload === 'string') {
		// Check for MaiaScript expression shortcuts ($key, $$key)
		if (payload.startsWith('$')) {
			return true
		}
		// Check for ternary operators - only if string contains $ (MaiaScript pattern like "$cond ? $a : $b")
		// Long strings (stringified JSON, schema defs) often contain $, ?, : but are data, not expressions
		if (
			payload.length < 150 &&
			payload.includes('$') &&
			payload.includes('?') &&
			payload.includes(':')
		) {
			return true
		}
		return false
	}

	// Handle numbers, booleans - no expressions possible
	if (typeof payload !== 'object') {
		return false
	}

	// Handle arrays - recursively check each element
	if (Array.isArray(payload)) {
		return payload.some((item) => containsExpressions(item))
	}

	// Handle objects - check for DSL operations or expression strings
	const keys = Object.keys(payload)

	// Check if this is a DSL operation (single key starting with $)
	// JSON Schema keywords ($ref, $schema, $co, etc.) are DATA, not expressions - recurse into value
	if (keys.length === 1 && keys[0].startsWith('$')) {
		const key = keys[0]
		if (JSON_SCHEMA_KEYS.has(key)) {
			return containsExpressions(payload[key])
		}
		// Unknown $-prefixed key - treat as expression (DSL op)
		return true
	}

	// Check all properties recursively
	for (const [key, value] of Object.entries(payload)) {
		if (key.startsWith('$$')) return true
		if (containsExpressions(value)) return true
	}

	return false
}
