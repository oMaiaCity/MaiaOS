/**
 * Collection Helper Functions
 *
 * Provides helpers for getting CoList IDs from spark.os.indexes and ensuring CoValues are loaded.
 * Uses factory-index-manager for indexing logic (single source of truth).
 */

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
		await ensureFactoryIndexColist(peer, factoryCoId)
		const idAfter = indexesCoMap.get(factoryCoId)
		if (idAfter && typeof idAfter === 'string' && idAfter.startsWith('co_z')) {
			if (typeof process !== 'undefined' && process.env?.DEBUG)
				console.log('[DEBUG getFactoryIndexColistId] ensured indexColistId=', idAfter)
			return idAfter
		}
		return null
	} catch (e) {
		if (typeof process !== 'undefined' && process.env?.DEBUG)
			console.error('[DEBUG getFactoryIndexColistId] error=', e)
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
	// Don't warn if colistId is null - getFactoryIndexColistId already handles creation
	// and will return null silently if schema doesn't have indexing: true (which is expected)
	return colistId
}

/**
 * Resolve CoValueCore in the node (handles seed races where getCoValue is briefly null).
 * @param {Object} peer
 * @param {string} coId
 * @param {number} deadlineAt - epoch ms; stop polling after this
 * @returns {Promise<object|null>}
 */
async function acquireCoValueCore(peer, coId, deadlineAt) {
	const getCore = () => peer.getCoValue(coId) ?? peer.node?.getCoValue?.(coId)
	let coValueCore = getCore()
	if (coValueCore) return coValueCore

	if (peer.node?.loadCoValueCore) {
		await peer.node.loadCoValueCore(coId).catch((_err) => {
			if (typeof process !== 'undefined' && process.env?.DEBUG)
				console.log('[CoValue load error]', _err)
		})
	}

	while (Date.now() < deadlineAt) {
		coValueCore = getCore()
		if (coValueCore) return coValueCore
		await new Promise((r) => setTimeout(r, 100))
	}
	return getCore()
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

	const deadline = Date.now() + timeoutMs
	const coValueCore = await acquireCoValueCore(peer, coId, deadline)
	if (!coValueCore) {
		return null
	}

	if (coValueCore.isAvailable()) {
		return coValueCore
	}

	if (peer.node?.loadCoValueCore) {
		peer.node.loadCoValueCore(coId).catch((_err) => {
			if (typeof process !== 'undefined' && process.env?.DEBUG)
				console.log('[CoValue load error]', _err)
		})
	}

	if (!waitForAvailable) {
		return coValueCore
	}

	const remaining = deadline - Date.now()
	if (remaining <= 0) {
		if (typeof process !== 'undefined' && process.env?.DEBUG) console.log('[CoValue timeout]', coId)
		return coValueCore.isAvailable() ? coValueCore : null
	}

	await new Promise((resolve, reject) => {
		let unsubscribe
		const timer = setTimeout(() => {
			unsubscribe?.()
			if (typeof process !== 'undefined' && process.env?.DEBUG) console.log('[CoValue timeout]', coId)
			reject(new Error(`Timeout waiting for CoValue ${coId} to load after ${timeoutMs}ms`))
		}, remaining)

		unsubscribe = coValueCore.subscribe((core) => {
			if (core.isAvailable()) {
				clearTimeout(timer)
				unsubscribe?.()
				resolve()
			}
		})
	})

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
	try {
		const coValueCore = await ensureCoValueLoaded(backend, coId, {
			waitForAvailable: true,
			timeoutMs: 25000,
		})
		if (!coValueCore) {
			throw new Error(`[${operationName}] CoValue not found: ${coId}`)
		}
		if (!coValueCore.isAvailable()) {
			throw new Error(`[${operationName}] CoValue ${coId} is not available (may still be loading)`)
		}
		return coValueCore
	} catch (e) {
		if (e instanceof Error && e.message.includes('Timeout waiting for CoValue')) {
			throw new Error(`[${operationName}] CoValue ${coId} is not available (may still be loading)`)
		}
		throw e
	}
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

	await ensureCoValueLoaded(peer, coId, { waitForAvailable: true, timeoutMs })

	const coValueCore = peer.getCoValue(coId) ?? peer.node?.getCoValue?.(coId)
	if (!coValueCore) {
		throw new Error(`[waitForHeaderMetaFactory] CoValueCore not found: ${coId}`)
	}

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
