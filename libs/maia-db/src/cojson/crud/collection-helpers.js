/**
 * Collection Helper Functions
 *
 * Provides helpers for getting CoList IDs from spark.os.indexes and ensuring CoValues are loaded.
 * Uses factory-index-manager for indexing logic (single source of truth).
 */

import { isFactoryRef } from '@MaiaOS/factories'
import { lookupRegistryKey } from '../factory/resolver.js'

/**
 * Get schema index colist ID using schema co-id as key (all schemas indexed in spark.os.indexes)
 * Lazily creates the index colist if it doesn't exist and the schema has indexing: true
 * @param {Object} peer - Backend instance
 * @param {string} schema - Schema co-id (co_z...) or human-readable (°maia/factory/data/todos)
 * @returns {Promise<string|null>} Schema index colist ID or null if not found/not indexable
 */
export async function getFactoryIndexColistId(peer, schema) {
	const factoryCoId = schema.startsWith('co_z')
		? schema
		: (peer.systemFactoryCoIds?.get?.(schema) ??
			(await lookupRegistryKey(peer, schema, { returnType: 'coId' })))
	if (typeof process !== 'undefined' && process.env?.DEBUG)
		console.log('[DEBUG getFactoryIndexColistId] schema=', schema, 'factoryCoId=', factoryCoId)
	if (!factoryCoId) return null

	const { ensureIndexesCoMap, ensureFactoryIndexColist } = await import(
		'../indexing/factory-index-manager.js'
	)
	const indexesCoMap = await ensureIndexesCoMap(peer)
	if (typeof process !== 'undefined' && process.env?.DEBUG)
		console.log('[DEBUG getFactoryIndexColistId] indexesCoMap=', !!indexesCoMap)
	if (!indexesCoMap) return null

	const indexColistId = indexesCoMap.get(factoryCoId)
	if (indexColistId && typeof indexColistId === 'string' && indexColistId.startsWith('co_')) {
		if (typeof process !== 'undefined' && process.env?.DEBUG)
			console.log('[DEBUG getFactoryIndexColistId] found indexColistId=', indexColistId)
		return indexColistId
	}

	try {
		const indexColist = await ensureFactoryIndexColist(peer, factoryCoId)
		const result = indexColist?.id ?? null
		if (typeof process !== 'undefined' && process.env?.DEBUG)
			console.log('[DEBUG getFactoryIndexColistId] ensureFactoryIndexColist result=', result)
		return result
	} catch (e) {
		if (typeof process !== 'undefined' && process.env?.DEBUG)
			console.error('[DEBUG getFactoryIndexColistId] error=', e)
		return null
	}
}

/**
 * Get CoList ID from spark.os.indexes.<factoryCoId> (all schema indexes in spark.os.indexes)
 * @param {Object} peer - Backend instance
 * @param {string} collectionNameOrSchema - Collection name (e.g., "todos"), schema co-id (co_z...), or namekey (°maia/factory/data/todos)
 * @returns {Promise<string|null>} CoList ID or null if not found
 */
export async function getCoListId(peer, collectionNameOrSchema) {
	// STRICT: Only schema-based lookup - no backward compatibility layers
	// All collections must be resolved via schema registry
	if (!collectionNameOrSchema || typeof collectionNameOrSchema !== 'string') {
		return null
	}

	// Must be a schema co-id or human-readable schema name (°maia/factory/... or @domain/schema/...)
	if (!collectionNameOrSchema.startsWith('co_z') && !isFactoryRef(collectionNameOrSchema)) {
		if (typeof process !== 'undefined' && process.env?.DEBUG)
			console.error('Invalid collection/schema ref:', collectionNameOrSchema)
		return null
	}

	const colistId = await getFactoryIndexColistId(peer, collectionNameOrSchema)
	// Don't warn if colistId is null - getFactoryIndexColistId already handles creation
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
 * @param {number} [options.timeoutMs=10000] - Timeout in milliseconds
 * @returns {Promise<CoValueCore|null>} CoValueCore or null if not found
 */
export async function ensureCoValueLoaded(peer, coId, options = {}) {
	const { waitForAvailable = false, timeoutMs = 25000 } = options

	if (!coId?.startsWith('co_')) {
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
 * Ensure CoValue is loaded and available (throws if not). For operations that require the CoValue.
 * @param {Object} backend - Backend instance
 * @param {string} coId - Co-id to ensure is available
 * @param {string} operationName - Operation name for error messages
 * @returns {Promise<CoValueCore>} CoValueCore instance
 */
export async function ensureCoValueAvailable(backend, coId, operationName) {
	let coValueCore = backend.getCoValue(coId)
	if (!coValueCore && backend.node?.loadCoValueCore) {
		await backend.node.loadCoValueCore(coId).catch(() => {})
		for (let i = 0; i < 12 && !coValueCore; i++) {
			coValueCore = backend.getCoValue(coId)
			if (!coValueCore) await new Promise((r) => setTimeout(r, 100))
		}
	}
	if (!coValueCore) {
		throw new Error(`[${operationName}] CoValue not found: ${coId}`)
	}

	if (!coValueCore.isAvailable()) {
		await backend.node.loadCoValueCore(coId)
		let attempts = 0
		while (!coValueCore.isAvailable() && attempts < 10) {
			await new Promise((r) => setTimeout(r, 100))
			attempts++
		}
		if (!coValueCore.isAvailable()) {
			throw new Error(`[${operationName}] CoValue ${coId} is not available (may still be loading)`)
		}
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
export async function waitForHeaderMetaFactory(peer, coId, options = {}) {
	const { timeoutMs = 10000 } = options

	if (!coId?.startsWith('co_')) {
		throw new Error(`[waitForHeaderMetaFactory] Invalid co-id: ${coId}`)
	}

	// Get CoValueCore (creates if doesn't exist)
	const coValueCore = peer.getCoValue(coId)
	if (!coValueCore) {
		throw new Error(`[waitForHeaderMetaFactory] CoValueCore not found: ${coId}`)
	}

	// Ensure CoValue is loaded first
	await ensureCoValueLoaded(peer, coId, { waitForAvailable: true, timeoutMs })

	// Check if headerMeta.$schema is already available
	const header = peer.getHeader(coValueCore)
	const headerMeta = header?.meta || null
	const factoryCoId = headerMeta?.$factory || null

	if (factoryCoId && typeof factoryCoId === 'string' && factoryCoId.startsWith('co_z')) {
		return factoryCoId // Already available
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
						`[waitForHeaderMetaFactory] Timeout waiting for headerMeta.$schema in CoValue ${coId} after ${timeoutMs}ms`,
					),
				)
			}
		}, timeoutMs)

		unsubscribe = coValueCore.subscribe((core) => {
			if (resolved) return

			// Check headerMeta.$schema on each update
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

		// Check one more time after subscription setup (might have changed during setup)
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
