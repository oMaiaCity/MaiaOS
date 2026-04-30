/**
 * Collection Helper Functions
 *
 * Provides helpers for getting CoList IDs from spark.os.indexes and ensuring CoValues are loaded.
 * Uses factory-index-manager for indexing logic (single source of truth).
 */

import { createLogger } from '@MaiaOS/logs'
import { ensureCoValueLoaded } from './ensure-covalue-core.js'

export { ensureCoValueAvailable, ensureCoValueLoaded } from './ensure-covalue-core.js'

const log = createLogger('maia-db')

/**
 * Get schema index colist ID using schema co-id as key (all schemas indexed in spark.os.indexes)
 * Lazily creates the index colist if it doesn't exist and the schema has indexing: true
 * @param {Object} peer - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @returns {Promise<string|null>} Schema index colist ID or null if not found/not indexable
 */
export async function getFactoryIndexColistId(peer, schema) {
	if (!schema?.startsWith?.('co_z')) {
		throw new Error(`[getFactoryIndexColistId] schema must be co_z co-id, got: ${schema}`)
	}
	const factoryCoId = schema
	if (typeof process !== 'undefined' && process.env?.DEBUG)
		log.debug('[DEBUG getFactoryIndexColistId] schema=', schema, 'factoryCoId=', factoryCoId)
	if (!factoryCoId) return null

	const { ensureIndexesCoMap, ensureFactoryIndexColist } = await import(
		'../indexing/factory-index-manager.js'
	)
	const indexesCoMap = await ensureIndexesCoMap(peer)
	if (typeof process !== 'undefined' && process.env?.DEBUG)
		log.debug('[DEBUG getFactoryIndexColistId] indexesCoMap=', !!indexesCoMap)
	if (!indexesCoMap) return null

	const indexColistId = indexesCoMap.get(factoryCoId)
	if (indexColistId && typeof indexColistId === 'string' && indexColistId.startsWith('co_')) {
		if (typeof process !== 'undefined' && process.env?.DEBUG)
			log.debug('[DEBUG getFactoryIndexColistId] found indexColistId=', indexColistId)
		return indexColistId
	}

	try {
		await ensureFactoryIndexColist(peer, factoryCoId)
		const idAfter = indexesCoMap.get(factoryCoId)
		if (idAfter && typeof idAfter === 'string' && idAfter.startsWith('co_z')) {
			if (typeof process !== 'undefined' && process.env?.DEBUG)
				log.debug('[DEBUG getFactoryIndexColistId] ensured indexColistId=', idAfter)
			return idAfter
		}
		return null
	} catch (e) {
		if (typeof process !== 'undefined' && process.env?.DEBUG)
			log.error('[DEBUG getFactoryIndexColistId] error=', e)
		return null
	}
}

/**
 * Get CoList ID from spark.os.indexes.<factoryCoId> (all schema indexes in spark.os.indexes)
 * @param {Object} peer - Backend instance
 * @param {string} collectionNameOrSchema - Schema co-id (co_z...)
 * @returns {Promise<string|null>} CoList ID or null if not found
 */
export async function getCoListId(peer, collectionNameOrSchema) {
	if (!collectionNameOrSchema || typeof collectionNameOrSchema !== 'string') {
		return null
	}
	if (!collectionNameOrSchema.startsWith('co_z')) {
		throw new Error(`[getCoListId] schema must be co_z co-id, got: ${collectionNameOrSchema}`)
	}

	const colistId = await getFactoryIndexColistId(peer, collectionNameOrSchema)
	return colistId
}

/**
 * Wait for headerMeta.$schema to become available in a CoValue
 *
 * @param {Object} peer - Backend instance
 * @param {string} coId - CoValue ID (co-id)
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=10000]
 * @returns {Promise<string>}
 */
export async function waitForHeaderMetaFactory(peer, coId, options = {}) {
	const { timeoutMs = 10000 } = options

	if (!coId?.startsWith('co_')) {
		throw new Error(`[waitForHeaderMetaFactory] Invalid co-id: ${coId}`)
	}

	await ensureCoValueLoaded(peer, coId, { waitForAvailable: true, timeoutMs })

	const coValueCore = peer.getCoValue(coId) ?? peer.node?.getCoValue?.(coId)
	if (!coValueCore) {
		throw new Error(`[waitForHeaderMetaFactory] CoValueCore not found: ${coId}`)
	}

	const header = peer.getHeader(coValueCore)
	const headerMeta = header?.meta || null
	const factoryCoId = headerMeta?.$factory || null

	if (factoryCoId && typeof factoryCoId === 'string' && factoryCoId.startsWith('co_z')) {
		return factoryCoId
	}

	return new Promise((resolve, reject) => {
		let resolved = false
		let unsubscribe

		const timeout = setTimeout(() => {
			if (!resolved) {
				resolved = true
				if (unsubscribe) unsubscribe()
				reject(
					new Error(
						`[waitForHeaderMetaFactory] Timeout waiting for headerMeta.$schema in CoValue ${coId} after ${timeoutMs}ms`,
					),
				)
			}
		}, timeoutMs)

		unsubscribe = coValueCore.subscribe((core) => {
			if (resolved) return

			const updatedHeader = peer.getHeader(core)
			const updatedHeaderMeta = updatedHeader?.meta || null
			const updatedSchemaCoId = updatedHeaderMeta?.$factory || null

			if (
				updatedSchemaCoId &&
				typeof updatedSchemaCoId === 'string' &&
				updatedSchemaCoId.startsWith('co_z')
			) {
				resolved = true
				clearTimeout(timeout)
				unsubscribe()
				resolve(updatedSchemaCoId)
			}
		})

		const currentHeader = peer.getHeader(coValueCore)
		const currentHeaderMeta = currentHeader?.meta || null
		const currentSchemaCoId = currentHeaderMeta?.$factory || null

		if (
			currentSchemaCoId &&
			typeof currentSchemaCoId === 'string' &&
			currentSchemaCoId.startsWith('co_z')
		) {
			resolved = true
			clearTimeout(timeout)
			unsubscribe()
			resolve(currentSchemaCoId)
		}
	})
}
