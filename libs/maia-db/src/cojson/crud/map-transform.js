/**
 * Map Transform - Apply mapping transformations to read data
 *
 * Supports MaiaScript expressions in map definitions to transform data during read operations.
 * Fully generic - can map ANY property path, not limited to specific properties.
 *
 * MAP-DRIVEN ON-DEMAND RESOLUTION: Only resolves CoValues along the expression path.
 * Content-addressable: resolves by co-id when traversing. Never pre-resolves everything.
 *
 * Example:
 * {
 *   "op": "read",
 *   "schema": "°Maia/schema/data/message",
 *   "map": {
 *     "fromRole": "$$source.role",
 *     "toRole": "$$target.role",
 *     "nestedValue": "$$nested.deep.property",
 *     "anyField": "$$anyProperty.anyNested.field"
 *   }
 * }
 *
 * Note: Expressions MUST use $$ (double dollar) prefix for item access - strict syntax required
 * - $$source.role → accesses item.source.role
 * - $$target.id → accesses item.target.id
 * - $$nested.deep.property → accesses item.nested.deep.property (fully generic)
 * - Any property path is supported - no hardcoded restrictions
 * - Expressions without $$ prefix will throw an error
 */

import { resolveCoIdShallow } from './data-extraction.js'

/**
 * Traverse path step-by-step. When value is co-id, resolve by id (content-addressable).
 * Only loads CoValues along the path – never siblings.
 * @param {Object} peer - Backend instance
 * @param {any} item - Root item
 * @param {string} path - Dot path (e.g. "os.capabilities.guardian.accountMembers")
 * @param {Set<string>} visited - Visited co-ids for circular ref detection
 * @param {Object} options - Options { timeoutMs }
 * @returns {Promise<any>} Value at path, or undefined
 */
async function getValueAtPathWithResolution(peer, item, path, visited, options = {}) {
	const parts = path.split('.')
	let current = item
	for (const part of parts) {
		if (current == null) return undefined
		const key = /^\d+$/.test(part) ? parseInt(part, 10) : part
		let value = current[key]
		while (typeof value === 'string' && value.startsWith('co_z')) {
			if (visited.has(value)) return undefined
			const resolved = await resolveCoIdShallow(peer, value, options, visited)
			value = resolved
		}
		current = value
	}
	return current
}

/**
 * Apply map transformation to a single item
 * Uses map-driven on-demand resolution: only resolves CoValues along expression paths.
 * @param {Object} peer - Backend instance
 * @param {Object} item - Item data to transform
 * @param {Object} mapConfig - Map configuration object (e.g., { "sender": "$$source.role" })
 * @param {Object} options - Options for resolution
 * @returns {Promise<Object>} Transformed item with mapped fields
 */
export async function applyMapTransform(peer, item, mapConfig, options = {}) {
	if (!mapConfig || typeof mapConfig !== 'object') {
		return item
	}

	const { timeoutMs = 2000 } = options
	const visited = new Set()
	const mappedItem = { ...item }
	const coIdsToRemove = new Set()

	for (const [targetField, expression] of Object.entries(mapConfig)) {
		try {
			if (typeof expression !== 'string' || !expression.startsWith('$$')) {
				throw new Error(
					`Map expression for "${targetField}" must use strict $$ syntax. Got: "${expression}". Expected format: "$$property.path"`,
				)
			}

			const path = expression.substring(2)
			const rootProperty = path.split('.')[0]
			if (rootProperty && rootProperty in item) {
				const originalValue = item[rootProperty]
				if (originalValue && typeof originalValue === 'string' && originalValue.startsWith('co_z')) {
					coIdsToRemove.add(rootProperty)
				}
			}

			const mappedValue = await getValueAtPathWithResolution(peer, item, path, visited, {
				timeoutMs,
			})
			mappedItem[targetField] = mappedValue
		} catch (_err) {
			mappedItem[targetField] = undefined
		}
	}

	for (const coIdKey of coIdsToRemove) {
		delete mappedItem[coIdKey]
	}

	return mappedItem
}

/**
 * Apply map transformation to an array of items
 * @param {Object} peer - Backend instance
 * @param {Array} items - Array of items to transform
 * @param {Object} mapConfig - Map configuration object
 * @param {Object} options - Options for resolution
 * @returns {Promise<Array>} Array of transformed items
 */
export async function applyMapTransformToArray(peer, items, mapConfig, options = {}) {
	if (!Array.isArray(items)) {
		return items
	}

	return Promise.all(items.map((item) => applyMapTransform(peer, item, mapConfig, options)))
}
