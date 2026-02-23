/**
 * Collection Helper Functions
 *
 * Provides helpers for getting CoList IDs from spark.os.indexes and ensuring CoValues are loaded.
 * Uses schema-index-manager for indexing logic (single source of truth).
 */

import { isSchemaRef } from '@MaiaOS/schemata'
import { resolve } from '../schema/resolver.js'

/**
 * Get schema index colist ID using schema co-id as key (all schemas indexed in spark.os.indexes)
 * Lazily creates the index colist if it doesn't exist and the schema has indexing: true
 * @param {Object} peer - Backend instance
 * @param {string} schema - Schema co-id (co_z...) or human-readable (°Maia/schema/data/todos)
 * @returns {Promise<string|null>} Schema index colist ID or null if not found/not indexable
 */
export async function getSchemaIndexColistId(peer, schema) {
	const schemaCoId = await resolve(peer, schema, { returnType: 'coId' })
	if (!schemaCoId) return null

	const { ensureIndexesCoMap, ensureSchemaIndexColist } = await import(
		'../indexing/schema-index-manager.js'
	)
	const indexesCoMap = await ensureIndexesCoMap(peer)
	if (!indexesCoMap) return null

	const indexColistId = indexesCoMap.get(schemaCoId)
	if (indexColistId && typeof indexColistId === 'string' && indexColistId.startsWith('co_')) {
		return indexColistId
	}

	try {
		const indexColist = await ensureSchemaIndexColist(peer, schemaCoId)
		return indexColist?.id ?? null
	} catch {
		return null
	}
}

/**
 * Get CoList ID from spark.os.indexes.<schemaCoId> (all schema indexes in spark.os.indexes)
 * @param {Object} peer - Backend instance
 * @param {string} collectionNameOrSchema - Collection name (e.g., "todos"), schema co-id (co_z...), or namekey (°Maia/schema/data/todos)
 * @returns {Promise<string|null>} CoList ID or null if not found
 */
export async function getCoListId(peer, collectionNameOrSchema) {
	// STRICT: Only schema-based lookup - no backward compatibility layers
	// All collections must be resolved via schema registry
	if (!collectionNameOrSchema || typeof collectionNameOrSchema !== 'string') {
		return null
	}

	// Must be a schema co-id or human-readable schema name (°Maia/schema/... or @domain/schema/...)
	if (!collectionNameOrSchema.startsWith('co_z') && !isSchemaRef(collectionNameOrSchema)) {
		if (typeof process !== 'undefined' && process.env?.DEBUG)
			console.error('Invalid collection/schema ref:', collectionNameOrSchema)
		return null
	}

	const colistId = await getSchemaIndexColistId(peer, collectionNameOrSchema)
	// Don't warn if colistId is null - getSchemaIndexColistId already handles creation
	// and will return null silently if schema doesn't have indexing: true (which is expected)
	return colistId
}

/**
 * Ensure CoValue is loaded from IndexedDB (jazz-tools pattern)
 * Generic method that works for ANY CoValue type (CoMap, CoList, CoStream, etc.)
 * After re-login, CoValues exist in IndexedDB but aren't loaded into node memory
 * This method explicitly loads them before accessing, just like jazz-tools does
 * @param {Object} peer - Backend instance
 * @param {string} coId - CoValue ID (co-id)
 * @param {Object} [options] - Options
 * @param {boolean} [options.waitForAvailable=false] - Wait for CoValue to become available
 * @param {number} [options.timeoutMs=2000] - Timeout in milliseconds
 * @returns {Promise<CoValueCore|null>} CoValueCore or null if not found
 */
export async function ensureCoValueLoaded(peer, coId, options = {}) {
	const { waitForAvailable = false, timeoutMs = 2000 } = options

	if (!coId || !coId.startsWith('co_')) {
		return null // Invalid co-id
	}

	// Get CoValueCore (creates if doesn't exist)
	const coValueCore = peer.getCoValue(coId)
	if (!coValueCore) {
		return null // CoValueCore doesn't exist (shouldn't happen)
	}

	// If already available, return immediately
	if (coValueCore.isAvailable()) {
		return coValueCore
	}

	// Not available - trigger loading from IndexedDB (jazz-tools pattern)
	peer.node.loadCoValueCore(coId).catch((_err) => {
		if (typeof process !== 'undefined' && process.env?.DEBUG)
			console.log('[CoValue load error]', _err)
	})

	// If waitForAvailable is true, wait for it to become available
	if (waitForAvailable) {
		await new Promise((resolve, reject) => {
			// Fix: Declare unsubscribe before subscribe call to avoid temporal dead zone
			let unsubscribe
			const timeout = setTimeout(() => {
				if (typeof process !== 'undefined' && process.env?.DEBUG) console.log('[CoValue timeout]', coId)
				unsubscribe()
				reject(new Error(`Timeout waiting for CoValue ${coId} to load after ${timeoutMs}ms`))
			}, timeoutMs)

			unsubscribe = coValueCore.subscribe((core) => {
				if (core.isAvailable()) {
					clearTimeout(timeout)
					unsubscribe()
					resolve()
				}
			})
		})
	}

	return coValueCore
}

/**
 * Wait for headerMeta.$schema to become available in a CoValue
 *
 * ROOT-CAUSE ARCHITECTURAL FIX: Direct headerMeta access
 * - Ensures headerMeta.$schema is actually available, not just that CoValue is "available"
 * - Subscribes to CoValueCore updates and checks headerMeta.$schema on each update
 * - This prevents race conditions where isAvailable() returns true but headerMeta isn't synced yet
 *
 * @param {Object} peer - Backend instance
 * @param {string} coId - CoValue ID (co-id)
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutMs=10000] - Timeout in milliseconds (default: 10 seconds for fresh browser instances)
 * @returns {Promise<string>} Schema co-id from headerMeta.$schema
 * @throws {Error} If headerMeta.$schema doesn't become available within timeout
 */
export async function waitForHeaderMetaSchema(peer, coId, options = {}) {
	const { timeoutMs = 10000 } = options

	if (!coId || !coId.startsWith('co_')) {
		throw new Error(`[waitForHeaderMetaSchema] Invalid co-id: ${coId}`)
	}

	// Get CoValueCore (creates if doesn't exist)
	const coValueCore = peer.getCoValue(coId)
	if (!coValueCore) {
		throw new Error(`[waitForHeaderMetaSchema] CoValueCore not found: ${coId}`)
	}

	// Ensure CoValue is loaded first
	await ensureCoValueLoaded(peer, coId, { waitForAvailable: true, timeoutMs })

	// Check if headerMeta.$schema is already available
	const header = peer.getHeader(coValueCore)
	const headerMeta = header?.meta || null
	const schemaCoId = headerMeta?.$schema || null

	if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
		return schemaCoId // Already available
	}

	// Not available yet - wait for it by subscribing to CoValueCore updates
	return new Promise((resolve, reject) => {
		let resolved = false
		let unsubscribe

		const timeout = setTimeout(() => {
			if (!resolved) {
				resolved = true
				if (unsubscribe) unsubscribe()
				reject(
					new Error(
						`[waitForHeaderMetaSchema] Timeout waiting for headerMeta.$schema in CoValue ${coId} after ${timeoutMs}ms`,
					),
				)
			}
		}, timeoutMs)

		unsubscribe = coValueCore.subscribe((core) => {
			if (resolved) return

			// Check headerMeta.$schema on each update
			const updatedHeader = peer.getHeader(core)
			const updatedHeaderMeta = updatedHeader?.meta || null
			const updatedSchemaCoId = updatedHeaderMeta?.$schema || null

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

		// Check one more time after subscription setup (might have changed during setup)
		const currentHeader = peer.getHeader(coValueCore)
		const currentHeaderMeta = currentHeader?.meta || null
		const currentSchemaCoId = currentHeaderMeta?.$schema || null

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
