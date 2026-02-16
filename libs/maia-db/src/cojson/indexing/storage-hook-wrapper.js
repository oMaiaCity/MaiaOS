/**
 * Storage Hook Wrapper
 *
 * Wraps the StorageAPI to hook into storage writes for automatic schema indexing.
 * This is more resilient than API-level hooks because it catches ALL writes:
 * - Writes from our CRUD API
 * - Writes from sync (remote peers)
 * - Writes from direct CoJSON operations
 * - Any other write path
 */

import { EXCEPTION_SCHEMAS } from '../../schemas/registry.js'
import * as groups from '../groups/groups.js'
import {
	extractSchemaFromMessage,
	isAccountGroupOrProfile,
	shouldSkipValidation,
} from '../helpers/co-value-detection.js'
import {
	indexCoValue,
	isSchemaCoValue,
	registerSchemaCoValue,
	shouldIndexCoValue,
} from './schema-index-manager.js'

// Track pending indexing operations to prevent duplicates
const pendingIndexing = new Set()

/**
 * Create a storage wrapper that hooks into store() for schema indexing
 * @param {StorageAPI} storage - Original storage instance
 * @param {Object} backend - Backend instance (for schema indexing functions)
 * @returns {StorageAPI} Wrapped storage with indexing hooks
 */
export function wrapStorageWithIndexingHooks(storage, backend) {
	if (!storage || !backend) {
		return storage
	}

	// Store original store method
	const originalStore = storage.store.bind(storage)

	// Create wrapper that preserves ALL methods from original storage
	// Use Proxy to intercept store() while preserving all other methods/properties
	const wrappedStorage = new Proxy(storage, {
		get(target, prop) {
			// Intercept store() method
			if (prop === 'store') {
				return (msg, correctionCallback) =>
					wrappedStore.call(target, msg, correctionCallback, originalStore)
			}
			// For all other properties/methods, return from original storage
			const value = target[prop]
			// Bind methods to original storage to preserve 'this' context
			if (typeof value === 'function') {
				return value.bind(target)
			}
			return value
		},
	})

	// Store function (bound to original storage for 'this' context)
	function wrappedStore(msg, correctionCallback, originalStore) {
		const coId = msg.id

		// CRITICAL: ENFORCE that every co-value MUST have a schema in headerMeta.$schema
		// Exception: Groups and accounts are created by CoJSON without schemas, but we detect them by ruleset/type

		// Use universal detection helper (consolidates all detection logic)
		const detection = isAccountGroupOrProfile(msg, backend, coId)

		// Groups, accounts, and profiles during account creation are allowed without headerMeta.$schema
		if (!detection.isAccount && !detection.isGroup && !detection.isProfile) {
			// For all other co-values, ENFORCE headerMeta.$schema
			if (!msg.header || !msg.header.meta) {
				// No header.meta at all - REJECT
				if (typeof process !== 'undefined' && process.env?.DEBUG) {
					if (msg.header) {
					} else {
					}
				}
				throw new Error(
					`[StorageHook] Co-value ${coId} missing header.meta. Every co-value MUST have headerMeta.$schema (except groups, accounts, and profiles during account creation).`,
				)
			}

			const schema = extractSchemaFromMessage(msg)

			// REJECT co-values without schemas (except exception schemas)
			if (!schema && !detection.isException) {
				// Throw error to prevent storage (co-value will not be stored)
				throw new Error(
					`[StorageHook] Co-value ${coId} missing $schema in headerMeta. Every co-value MUST have a schema (except @account, @group, @metaSchema, and groups/accounts).`,
				)
			}
		}

		// CRITICAL: Synchronous checks to prevent infinite loops BEFORE any async work
		// These checks must be fast and not trigger any storage operations

		// 1. Use universal skip validation helper (consolidates all skip logic)
		// NOTE: We DON'T skip @metaSchema here - °Maia/schema/meta uses @metaSchema but should be registered!
		// Let isSchemaCoValue() and shouldIndexCoValue() handle °Maia detection properly
		let shouldSkipIndexing = shouldSkipValidation(msg, backend, coId)

		// Don't skip @metaSchema for indexing (it should be registered)
		if (shouldSkipIndexing) {
			const schema = extractSchemaFromMessage(msg)
			if (schema === EXCEPTION_SCHEMAS.META_SCHEMA) {
				shouldSkipIndexing = false // Allow @metaSchema to be indexed
			}
		}

		// 2. Skip indexing if this is spark.os, schematas, indexes, or any index colist (they're internal)
		// Use cached osId (set when getSparkOsId is first called - don't trigger async here!)
		if (!shouldSkipIndexing && backend.account) {
			const osId = backend._cachedMaiaOsId
			if (coId === osId) {
				// This is spark.os itself - skip indexing to prevent infinite loop
				shouldSkipIndexing = true
			} else if (osId) {
				// Check if spark.os is already loaded (don't trigger loading!)
				const osCore = backend.node.getCoValue(osId)
				if (osCore && backend.isAvailable(osCore) && osCore.type === 'comap') {
					const osContent = osCore.getCurrentContent?.()
					if (osContent && typeof osContent.get === 'function') {
						// Check if it's schematas registry
						const schematasId = osContent.get('schematas')
						if (coId === schematasId) {
							shouldSkipIndexing = true
						}

						// Check if it's unknown colist
						const unknownId = osContent.get('unknown')
						if (coId === unknownId) {
							shouldSkipIndexing = true
						}

						// Check if it's spark.os.indexes itself
						const indexesId = osContent.get('indexes')
						if (coId === indexesId) {
							shouldSkipIndexing = true
						}

						// Check if it's inside spark.os.indexes (any schema index colist)
						if (indexesId && !shouldSkipIndexing) {
							const indexesCore = backend.node.getCoValue(indexesId)
							if (indexesCore && backend.isAvailable(indexesCore) && indexesCore.type === 'comap') {
								const indexesContent = indexesCore.getCurrentContent?.()
								if (indexesContent && typeof indexesContent.get === 'function') {
									// Only check if we can do it synchronously without triggering loads
									try {
										const keys =
											indexesContent.keys && typeof indexesContent.keys === 'function'
												? indexesContent.keys()
												: Object.keys(indexesContent)
										for (const key of keys) {
											const valueId = indexesContent.get(key)
											if (valueId === coId) {
												// This is a schema index colist - skip indexing to prevent infinite loop
												shouldSkipIndexing = true
												break
											}
										}
									} catch (_e) {
										// If checking fails, err on the side of caution and skip indexing
										// This prevents potential infinite loops
										shouldSkipIndexing = true
									}
								}
							}
						}
					}
				}
				// If spark.os is not loaded yet, do NOT skip - proceed with indexing.
				// ROOT CAUSE FIX: We previously skipped here "to prevent triggering loads", but that
				// broke indexing entirely: spark.os is often not loaded when the first todo/message
				// is stored (getSparkOsId only loads registries->sparks->spark, not spark.os itself).
				// indexCoValue's shouldIndexCoValue/isInternalCoValue will correctly skip internal
				// co-values (spark.os, schematas, indexes). Data co-values (todos, messages) must be indexed.
				// Skipping here caused spark.os.indexes to stay empty since the registry refactor.
			}
		}

		// Call original store first (handles both sync and async)
		const storeResult = originalStore(msg, correctionCallback)

		// If we determined we should skip indexing, return early
		if (shouldSkipIndexing) {
			return storeResult
		}

		// CRITICAL: Chain indexing to store - storage is not complete until BOTH stored AND indexed
		// This ensures readCollection and other consumers never see unindexed data
		return Promise.resolve(storeResult)
			.then(async () => {
				// Deduplication: Skip if already indexing this co-value
				if (pendingIndexing.has(coId)) {
					return
				}
				pendingIndexing.add(coId)

				try {
					// Pre-warm getSparkOsId: ensure registries/spark/os are loaded before indexCoValue
					if (!backend._cachedMaiaOsId && backend.account) {
						await groups.getSparkOsId(backend, backend.systemSpark ?? '°Maia')
					}

					// Get co-value core (may need retries for local rapid writes during seeding)
					let coValueCore = backend.getCoValue(coId)
					let attempts = 0
					const maxAttempts = 10
					while ((!coValueCore || !backend.isAvailable(coValueCore)) && attempts < maxAttempts) {
						if (backend.node?.loadCoValueCore) {
							await backend.node.loadCoValueCore(coId).catch(() => {})
						}
						await new Promise((r) => setTimeout(r, 10 * (attempts + 1)))
						coValueCore = backend.getCoValue(coId)
						attempts++
					}
					if (!coValueCore || !backend.isAvailable(coValueCore)) {
						// Remote write or still not available - explicit re-index pass will catch if local
						return
					}

					const updatedCoValueCore = backend.getCoValue(coId)
					if (!updatedCoValueCore || !backend.isAvailable(updatedCoValueCore)) {
						return
					}

					// Schema co-value - auto-register in spark.os.schematas
					const isSchema = await isSchemaCoValue(backend, updatedCoValueCore)
					if (isSchema) {
						await registerSchemaCoValue(backend, updatedCoValueCore)
						return
					}

					// Check if this co-value should be indexed (skips internal co-values)
					const { shouldIndex } = await shouldIndexCoValue(backend, updatedCoValueCore)
					if (!shouldIndex) {
						return
					}

					// Regular co-value - index it (await ensures storage not complete until indexed)
					await indexCoValue(backend, updatedCoValueCore)
				} catch (error) {
					console.error('[StorageHook] Indexing failed', coId, error)
				} finally {
					pendingIndexing.delete(coId)
				}
			})
			.then(() => storeResult)
	}

	return wrappedStorage
}
