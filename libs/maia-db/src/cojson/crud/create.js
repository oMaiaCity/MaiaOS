/**
 * Create Operation
 *
 * Provides the create() method for creating new CoValues.
 */

import { perfEnginesChat } from '@MaiaOS/logs'
import { createCoValueForSpark } from '../covalue/create-covalue-for-spark.js'
import { extractCoValueData } from './data-extraction.js'
import { determineCotypeAndFlag } from './ensure-covalue-core.js'

// Schema indexing is handled by storage-level hooks (more resilient than API hooks)
// No CRUD-level hooks needed - storage hook catches ALL writes

/**
 * Create new record - directly creates CoValue using CoJSON raw methods
 * @param {Object} peer - Backend instance
 * @param {string} schema - Schema co-id (co_z...) for data collections
 * @param {Object} data - Data to create
 * @param {Object} [options] - Optional settings
 * @param {string} [options.spark] - Spark co-id (co_z...); defaults to peer.systemSparkCoId
 * @returns {Promise<Object>} Created record with generated co-id
 */
export async function create(peer, schema, data, options = {}) {
	const spark = options.spark ?? peer.systemSparkCoId
	if (!spark?.startsWith?.('co_z')) {
		throw new Error('[MaiaDB] create: options.spark or peer.systemSparkCoId (co_z) required')
	}

	// Determine cotype from schema or data type
	const { cotype, isSchemaDefinition } = await determineCotypeAndFlag(peer, schema, data)

	if (!peer.account) {
		throw new Error('[MaiaDB] Account required for create')
	}

	if (cotype === 'comap' && (!data || typeof data !== 'object' || Array.isArray(data))) {
		throw new Error('[MaiaDB] Data must be object for comap')
	}
	if (cotype === 'colist' && !Array.isArray(data)) {
		throw new Error('[MaiaDB] Data must be array for colist')
	}

	// Chat message: { role, content, displayName }
	const isChatMessage = data && 'role' in data && 'content' in data
	const t0 = isChatMessage ? perfEnginesChat.now() : 0

	const { coValue } = await createCoValueForSpark(peer, spark, {
		factory: schema,
		cotype,
		data: cotype === 'comap' ? data : cotype === 'colist' ? data : undefined,
		dataEngine: peer.dbEngine,
		isFactoryDefinition: isSchemaDefinition && cotype === 'comap',
	})

	if (isChatMessage) {
		perfEnginesChat.timing(
			'create.createCoValueForSpark',
			Math.round((perfEnginesChat.now() - t0) * 100) / 100,
		)
	}

	// Fast path: coValue is local and available—extract from node, no read/store wait
	// coValue from createCoValueForSpark is RawCoMap/RawCoList (content); peer.isAvailable expects CoValueCore
	const coValueCore = peer.getCoValue?.(coValue?.id) ?? coValue
	if (coValueCore && peer.isAvailable(coValueCore)) {
		const extracted = extractCoValueData(peer, coValueCore, schema)
		if (extracted && !extracted.error) {
			return { id: coValue.id, ...data, ...extracted }
		}
		return { id: coValue.id, ...data, type: cotype, schema }
	}

	// Fallback: coValue not yet available (rare remote/edge case)
	const store = await peer.read(null, coValue.id, null, null, { deepResolve: false })
	const { waitForStoreReady } = await import('./read-operations.js')
	const t1 = isChatMessage ? perfEnginesChat.now() : 0
	try {
		await waitForStoreReady(store, coValue.id, 5000)
	} catch (_e) {
		return { id: coValue.id, ...data, type: cotype, schema }
	}
	if (isChatMessage) {
		perfEnginesChat.timing(
			'create.waitForStoreReady',
			Math.round((perfEnginesChat.now() - t1) * 100) / 100,
		)
	}
	const extracted = store.value
	if (extracted && !extracted.error) {
		return { id: coValue.id, ...data, ...extracted }
	}
	return { id: coValue.id, ...data, type: cotype, schema }
}
