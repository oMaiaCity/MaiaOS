/**
 * Map Transform - Apply mapping transformations to read data
 *
 * Unified map syntax:
 * - $path = resolve path from current item (e.g. $content, $source.replyTo.author.name)
 * - $$path = same as $path (legacy support; both mean "resolve from current item")
 * - path without $ = pass-through (direct property, e.g. "id" → item.id)
 * - "*": "N" = all keys up to depth N (1-8)
 *
 * MAP-DRIVEN ON-DEMAND RESOLUTION: Only resolves CoValues along the expression path.
 * Content-addressable: resolves by co-id when traversing. Never pre-resolves everything.
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
 * Extract resolution path and path type from map expression
 * @param {string} expression - Map expression (e.g. "$content", "$$source.role", "id")
 * @returns {{ path: string, isResolve: boolean }|null} Path and whether it needs resolution
 */
function getValueAtPathNoResolve(item, path) {
	if (!item || typeof path !== 'string') return undefined
	return path.split('.').reduce((acc, key) => acc?.[key], item)
}

function parseMapExpression(expression) {
	if (typeof expression !== 'string') return null
	const pathExpr = expression.startsWith('$$')
		? expression.substring(2)
		: expression.startsWith('$')
			? expression.substring(1)
			: expression
	const isResolve = expression.startsWith('$$') || expression.startsWith('$')
	// Support :asDataUrl suffix for cobinary co-ids (e.g. "$avatar:asDataUrl")
	const asDataUrl = pathExpr.endsWith(':asDataUrl')
	const path = asDataUrl ? pathExpr.slice(0, -10) : pathExpr
	return { path, isResolve, asDataUrl }
}

/**
 * Collect all keys from item up to given depth (for "*" wildcard).
 * Shallow copy: at each level, include primitive/array values; recurse into objects.
 * @param {Object} obj - Source object
 * @param {number} maxDepth - Maximum depth (1-8)
 * @param {number} currentDepth - Current depth
 * @returns {Object} Object with keys up to maxDepth (no co-id resolution)
 */
function collectKeysToDepth(obj, maxDepth, currentDepth = 0) {
	if (currentDepth >= maxDepth || !obj || typeof obj !== 'object' || Array.isArray(obj)) {
		return {}
	}
	const result = {}
	for (const [key, value] of Object.entries(obj)) {
		if (key === '$schema') continue
		if (
			value != null &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			typeof value !== 'string'
		) {
			const nested = collectKeysToDepth(value, maxDepth, currentDepth + 1)
			result[key] = Object.keys(nested).length ? nested : value
		} else {
			result[key] = value
		}
	}
	return result
}

/**
 * Apply map transformation to a single item
 * Uses map-driven on-demand resolution: only resolves CoValues along expression paths.
 * @param {Object} peer - Backend instance
 * @param {Object} item - Item data to transform
 * @param {Object} mapConfig - Map configuration object (e.g., { "content": "$content", "id": "id" })
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
			// Wildcard: "*": "N" = all keys up to depth N
			if (targetField === '*' && typeof expression === 'string') {
				const depth = parseInt(expression, 10)
				if (depth >= 1 && depth <= 8) {
					const expanded = collectKeysToDepth(item, depth)
					for (const [k, v] of Object.entries(expanded)) {
						mappedItem[k] = v
					}
				}
				continue
			}

			// $mapFields: generic reshape – [{label, valuePath}] → [{label, value: item[valuePath]}]
			if (
				typeof expression === 'object' &&
				expression !== null &&
				Array.isArray(expression.$mapFields)
			) {
				mappedItem[targetField] = expression.$mapFields.map((f) => ({
					label: f?.label ?? '',
					value: f?.valuePath ? getValueAtPathNoResolve(item, f.valuePath) : '',
				}))
				continue
			}

			const parsed = parseMapExpression(expression)
			if (!parsed) {
				mappedItem[targetField] = undefined
				continue
			}

			if (!parsed.isResolve) {
				// Pass-through: direct property access
				mappedItem[targetField] = item[parsed.path]
				continue
			}

			const path = parsed.path
			const rootProperty = path.split('.')[0]
			// Only remove raw co-id when we're mapping to a *different* key (we replace, not remove, when targetField === rootProperty)
			if (rootProperty && rootProperty in item && rootProperty !== targetField) {
				const originalValue = item[rootProperty]
				if (originalValue && typeof originalValue === 'string' && originalValue.startsWith('co_z')) {
					coIdsToRemove.add(rootProperty)
				}
			}

			let mappedValue = await getValueAtPathWithResolution(peer, item, path, visited, {
				timeoutMs,
			})
			// :asDataUrl suffix: resolve cobinary co-id to data URL for img src
			if (parsed.asDataUrl && peer.dbEngine) {
				const coId =
					typeof mappedValue === 'string' && mappedValue.startsWith('co_z')
						? mappedValue
						: mappedValue?.id && typeof mappedValue.id === 'string' && mappedValue.id.startsWith('co_z')
							? mappedValue.id
							: null
				const PLACEHOLDER =
					'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
				if (coId) {
					try {
						const r = await peer.dbEngine.execute({ op: 'loadBinaryAsBlob', coId })
						mappedValue = r?.ok && r?.data?.dataUrl ? r.data.dataUrl : PLACEHOLDER
					} catch (_e) {
						mappedValue = PLACEHOLDER
					}
				} else {
					mappedValue = PLACEHOLDER
				}
			}
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
