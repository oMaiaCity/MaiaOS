/**
 * Universal Read Function
 *
 * Single universal read() function that handles ALL CoValue types identically
 * using $stores architecture with progressive loading and true reactivity.
 */

import { readAllCoValues } from './read-all-covalues.js'
import { readCollection } from './read-collection.js'
import { findFirst } from './read-find-first.js'
import { resolveSchemaLazy } from './read-helpers.js'
import { readSingleCoValue, readSparksFromAccount } from './read-single-and-sparks.js'

export { findFirst }

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
		const resolvedSchema = await resolveSchemaLazy(peer, schema, { returnType: 'coId' })
		if (sparkSchemaCoId && resolvedSchema === sparkSchemaCoId) {
			return readSparksFromAccount(peer, readOptions)
		}
		return readCollection(peer, schema, filter, readOptions)
	}

	// All CoValues read (no schema) - returns array of all CoValues
	return readAllCoValues(peer, filter, { deepResolve, maxDepth, timeoutMs })
}
