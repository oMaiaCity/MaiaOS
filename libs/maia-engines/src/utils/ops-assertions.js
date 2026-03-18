/**
 * Operation assertion helpers for data engine operations
 */

export function requireParam(param, paramName, operationName) {
	if (param === undefined || param === null) {
		throw new Error(`[${operationName}] ${paramName} required`)
	}
}

export function requireDataEngine(dataEngine, operationName, reason = '') {
	if (!dataEngine) {
		const reasonText = reason ? ` (${reason})` : ''
		throw new Error(`[${operationName}] dataEngine required${reasonText}`)
	}
}

export function validateCoId(id, operationName) {
	if (!id) throw new Error(`[${operationName}] coId required`)
	if (!id.startsWith('co_z')) {
		throw new Error(`[${operationName}] coId must be a valid co-id (co_z...), got: ${id}`)
	}
}

export function validateItems(schema, items) {
	if (!Array.isArray(items)) throw new Error('[validateItems] Items must be an array')
	if (schema.items?.$co) {
		for (const item of items) {
			if (typeof item !== 'string' || !item.startsWith('co_z')) {
				throw new Error(
					`[validateItems] Items must be co-ids when schema.items.$co is specified, got: ${item}`,
				)
			}
		}
	}
}
