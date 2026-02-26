/**
 * Resolve properties/items/$defs that are co-id strings (references to other CoValues) into plain schema objects.
 * AJV requires properties and items to be plain objects; CoJSON schemas may store them as co-id references.
 */

/**
 * Resolve schema references using a resolver function.
 * Recursively walks schema; uses visited set to prevent circular references.
 * @param {Function} resolveFn - async (coId) => schema
 * @param {Object} schema - Schema object (may have properties/items as co-id strings)
 * @param {Set<string>} visited - Set of co-ids already visited (prevents circular refs)
 * @returns {Promise<Object>} Schema with co-id references resolved
 */
export async function normalizeSchemaReferencesWithResolver(
	resolveFn,
	schema,
	visited = new Set(),
) {
	if (!schema || typeof schema !== 'object') return schema

	const resolveIfCoId = async (val) => {
		if (typeof val === 'string' && val.startsWith('co_z') && !visited.has(val)) {
			visited.add(val)
			try {
				const resolved = await resolveFn(val)
				if (resolved) return await normalizeSchemaReferencesWithResolver(resolveFn, resolved, visited)
			} finally {
				visited.delete(val)
			}
		}
		return val
	}

	const result = { ...schema }

	if (result.properties !== undefined) {
		result.properties = await resolveIfCoId(result.properties)
		if (
			result.properties &&
			typeof result.properties === 'object' &&
			!Array.isArray(result.properties)
		) {
			const next = {}
			for (const [k, v] of Object.entries(result.properties)) {
				next[k] = await normalizeSchemaReferencesWithResolver(resolveFn, v, visited)
			}
			result.properties = next
		} else {
			// AJV requires properties to be object; invalid types (e.g. unresolved string) → empty object
			result.properties = {}
		}
	}
	if (result.items !== undefined) {
		result.items = await resolveIfCoId(result.items)
		if (Array.isArray(result.items)) {
			result.items = await Promise.all(
				result.items.map((item) => normalizeSchemaReferencesWithResolver(resolveFn, item, visited)),
			)
		} else if (result.items && typeof result.items === 'object') {
			result.items = await normalizeSchemaReferencesWithResolver(resolveFn, result.items, visited)
		}
	}
	if (
		result.$defs !== undefined &&
		typeof result.$defs === 'object' &&
		!Array.isArray(result.$defs)
	) {
		const defs = {}
		for (const [k, v] of Object.entries(result.$defs)) {
			defs[k] = await resolveIfCoId(v)
			if (defs[k] && typeof defs[k] === 'object' && !Array.isArray(defs[k])) {
				defs[k] = await normalizeSchemaReferencesWithResolver(resolveFn, defs[k], visited)
			}
		}
		result.$defs = defs
	}

	return result
}
