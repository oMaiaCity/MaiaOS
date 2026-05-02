/**
 * Universal Read Function
 *
 * Single universal read() function that handles ALL CoValue types identically
 * using $stores architecture with progressive loading and true reactivity.
 */

import { extractCoValueData } from '../../primitives/data-extraction.js'
import { ensureCoValueLoaded, getCoListId } from './collection-helpers.js'
import { matchesFilter } from './filter-helpers.js'
import { readAllCoValues } from './read-all-covalues.js'
import { readCollection } from './read-collection.js'
import { alignQueryFactoryCoIdWithSparkOsInfra, resolveSchemaLazy } from './read-helpers.js'
import { readSingleCoValue, readSparksFromAccount } from './read-single-and-sparks.js'

/**
 * Lightweight existence check - first matching item by filter.
 * No store, no subscriptions. Used for gate checks (e.g. idempotency).
 * Keeps read/display path pure progressive $stores.
 *
 * @param {Object} peer - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @param {Object} filter - Filter criteria (e.g. { sourceMessageId: 'xyz' })
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutMs=2000] - Timeout for loading colist/items
 * @returns {Promise<Object|null>} First matching item with id, or null
 */
export async function findFirst(peer, schema, filter, options = {}) {
	const { timeoutMs = 2000 } = options
	if (!filter || typeof filter !== 'object') return null

	const coListId = await getCoListId(peer, schema)
	if (!coListId) return null

	const coListCore = peer.getCoValue(coListId)
	if (!coListCore) return null

	await ensureCoValueLoaded(peer, coListId, { waitForAvailable: true, timeoutMs })
	if (!peer.isAvailable(coListCore)) return null

	const content = peer.getCurrentContent(coListCore)
	if (!content?.toJSON) return null

	const itemIds = content.toJSON()
	const seenIds = new Set()

	for (const itemId of itemIds) {
		if (typeof itemId !== 'string' || !itemId.startsWith('co_') || seenIds.has(itemId)) continue
		seenIds.add(itemId)

		await ensureCoValueLoaded(peer, itemId, { waitForAvailable: true, timeoutMs })
		const itemCore = peer.getCoValue(itemId)
		if (!itemCore || !peer.isAvailable(itemCore)) continue

		const itemData = extractCoValueData(peer, itemCore)
		const dataKeys = Object.keys(itemData).filter((k) => !['id', 'type', '$factory'].includes(k))
		if (dataKeys.length === 0 && itemData.type === 'comap') continue

		if (matchesFilter(itemData, filter)) {
			return { ...itemData, id: itemId }
		}
	}
	return null
}

/**
 * Universal read() function - works for ANY CoValue type
 *
 * @param {Object} peer - Backend instance
 * @param {string} [coId] - CoValue ID (for single item read)
 * @param {string} [schema] - Schema co-id (for collection read, or schemaHint for single item)
 * @param {Object} [filter] - Filter criteria (for collection/all reads)
 * @param {string} [schemaHint] - Schema hint for special types (@group, @account, @metaSchema)
 * @param {Object} [options] - Options for deep resolution and transformations
 * @param {boolean} [options.deepResolve=true] - Enable/disable deep resolution (default: true)
 * @param {number} [options.maxDepth=15] - Maximum depth for recursive resolution (default: 15)
 * @param {number} [options.timeoutMs=5000] - Timeout for waiting for nested CoValues (default: 5000)
 * @param {Object} [options.map] - Map config: { targetKey: "$sourcePath" } for on-demand ref resolution
 * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data (progressive loading)
 */
export async function read(
	peer,
	coId = null,
	schema = null,
	filter = null,
	schemaHint = null,
	options = {},
) {
	const {
		deepResolve = true,
		maxDepth = 15,
		timeoutMs = 5000,
		map = null,
		onChange = null,
	} = options

	const readOptions = { deepResolve, maxDepth, timeoutMs, map, onChange, universalRead: read }

	// Single item read (by coId)
	if (coId) {
		return readSingleCoValue(peer, coId, schemaHint || schema, readOptions)
	}

	// Collection read (by schema)
	if (schema) {
		const sparkSchemaCoId = peer.infra?.dataSpark
		let resolvedSchema =
			typeof schema === 'string' && schema.startsWith('co_z')
				? schema
				: await resolveSchemaLazy(peer, schema, { returnType: 'coId' })
		if (typeof resolvedSchema === 'string' && resolvedSchema.startsWith('co_z')) {
			resolvedSchema = await alignQueryFactoryCoIdWithSparkOsInfra(
				peer,
				resolvedSchema,
				readOptions.universalRead,
				timeoutMs,
			)
		}
		if (sparkSchemaCoId && resolvedSchema === sparkSchemaCoId) {
			return readSparksFromAccount(peer, readOptions)
		}
		return readCollection(peer, resolvedSchema, filter, readOptions)
	}

	// All CoValues read (no schema) - returns array of all CoValues
	return readAllCoValues(peer, filter, { deepResolve, maxDepth, timeoutMs })
}
