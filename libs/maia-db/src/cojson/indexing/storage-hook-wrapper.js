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

import { createLogger, debugLog } from '@MaiaOS/logs'
import {
	extractSchemaFromMessage,
	isAccountGroupOrProfile,
	shouldSkipValidation,
} from '@MaiaOS/validation/co-value-detection'
import { EXCEPTION_FACTORIES } from '../../factories/registry.js'
import * as groups from '../groups/groups.js'
import { applyPersistentCoValueIndexing } from './factory-index-manager.js'

const log = createLogger('maia-db')

// Track pending indexing operations to prevent duplicates
const pendingIndexing = new Set()

/**
 * Create a storage wrapper that hooks into store() for schema indexing
 * @param {StorageAPI} storage - Original storage instance
 * @param {Object} peer - Backend instance (for schema indexing functions)
 * @returns {StorageAPI} Wrapped storage with indexing hooks
 */
export function wrapStorageWithIndexingHooks(storage, peer) {
	if (!storage || !peer) {
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

		// Normalize: CoJSON may send header in msg.header, msg.new[sessionId].header, or first transaction
		let header = msg.header
		if (!header && msg.new && typeof msg.new === 'object') {
			for (const sessionId of Object.keys(msg.new)) {
				const session = msg.new[sessionId]
				if (session?.header) {
					header = session.header
					break
				}
				// First transaction may contain header (CoJSON creation format)
				const txs = session?.newTransactions
				if (Array.isArray(txs) && txs.length > 0 && txs[0]?.header) {
					header = txs[0].header
					break
				}
			}
		}
		const normalizedMsg = header && !msg.header ? { ...msg, header } : msg

		// CRITICAL: ENFORCE that every co-value MUST have a schema in headerMeta.$factory
		// Exception: Groups and accounts are created by CoJSON without schemas, but we detect them by ruleset/type

		// Use universal detection helper (consolidates all detection logic)
		const detection = isAccountGroupOrProfile(normalizedMsg, peer, coId)

		// Groups, accounts, and profiles during account creation are allowed without headerMeta.$factory
		if (!detection.isAccount && !detection.isGroup && !detection.isProfile) {
			// Allow through when ruleset indicates a group (CoJSON creates groups without our schema)
			const ruleset = header?.ruleset ?? msg.ruleset
			const isGroupByRuleset = ruleset?.type === 'group' || header?.type === 'group'
			if (isGroupByRuleset) {
				return originalStore(msg, correctionCallback)
			}
			// CoJSON sync: incremental batches use msg.new; a chunk may not repeat meta.$factory in
			// the extracted header (second peer / patches). That does NOT mean we accept schema-less
			// co-values: creation must still carry $factory in an earlier or sibling message; the
			// merged CoJSON state retains header meta. Without msg.new, missing $factory still throws below.
			if (msg.new && typeof msg.new === 'object' && Object.keys(msg.new).length > 0) {
				if (!extractSchemaFromMessage(normalizedMsg)) {
					return originalStore(msg, correctionCallback)
				}
			}
			// header exists but meta is null: CoJSON internal CoValue (profile during account creation,
			// or groups/CoValues created without our schema). Allow — indexing will skip them.
			if (header && header.meta === null) {
				return originalStore(msg, correctionCallback)
			}
			// For all other co-values, ENFORCE headerMeta.$factory (required for resolve/CRUD)
			if (!header?.meta) {
				throw new Error(
					`[StorageHook] Co-value ${coId} missing header.meta. Every co-value MUST have headerMeta.$factory (except groups, accounts, and profiles during account creation).`,
				)
			}

			// CoBinary: meta.type === 'binary' without Maia $factory (RawBinaryCoStream). MUST run before
			// $factory enforcement — otherwise we throw and can crash the sync server on store().
			if (header.meta.type === 'binary') {
				return originalStore(msg, correctionCallback)
			}

			const schema = extractSchemaFromMessage(normalizedMsg)

			// REJECT co-values without schemas (except exception schemas)
			if (!schema && !detection.isException) {
				// Throw error to prevent storage (co-value will not be stored)
				throw new Error(
					`[StorageHook] Co-value ${coId} missing $factory in headerMeta. Every co-value MUST have a schema (except @account, @group, @metaSchema, and groups/accounts).`,
				)
			}
		}

		// CRITICAL: Synchronous checks to prevent infinite loops BEFORE any async work
		// These checks must be fast and not trigger any storage operations

		// 1. Use universal skip validation helper (consolidates all skip logic)
		// NOTE: We DON'T skip @metaSchema here - °maia/factory/meta.factory.maia uses @metaSchema but should be registered!
		// Let isFactoryCoValue() and shouldIndexCoValue() handle °maia detection properly
		let shouldSkipIndexing = shouldSkipValidation(normalizedMsg, peer, coId)

		// Don't skip @metaSchema for indexing (it should be registered)
		if (shouldSkipIndexing) {
			const schema = extractSchemaFromMessage(normalizedMsg)
			if (schema === EXCEPTION_FACTORIES.META_SCHEMA) {
				shouldSkipIndexing = false // Allow @metaSchema to be indexed
			}
		}

		// 2. Skip indexing if this is spark.os, indexes, or any index colist (they're internal)
		// Use cached osId (set when getSparkOsId is first called - don't trigger async here!)
		if (!shouldSkipIndexing && peer.account) {
			const osId = peer._cachedMaiaOsId
			if (coId === osId) {
				// This is spark.os itself - skip indexing to prevent infinite loop
				shouldSkipIndexing = true
			} else if (osId) {
				// Check if spark.os is already loaded (don't trigger loading!)
				const osCore = peer.node.getCoValue(osId)
				if (osCore && peer.isAvailable(osCore) && osCore.type === 'comap') {
					const osContent = osCore.getCurrentContent?.()
					if (osContent && typeof osContent.get === 'function') {
						// Check if it's unknown colist
						const unknownId = osContent.get('unknown')
						if (coId === unknownId) {
							shouldSkipIndexing = true
						}

						const nanoidsId = osContent.get('nanoids')
						if (coId === nanoidsId) {
							shouldSkipIndexing = true
						}

						// Check if it's spark.os.indexes itself
						const indexesId = osContent.get('indexes')
						if (coId === indexesId) {
							shouldSkipIndexing = true
						}

						// Check if it's inside spark.os.indexes (any schema index colist)
						if (indexesId && !shouldSkipIndexing) {
							const indexesCore = peer.node.getCoValue(indexesId)
							if (indexesCore && peer.isAvailable(indexesCore) && indexesCore.type === 'comap') {
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
				// co-values (spark.os, indexes). Data co-values (todos, messages) must be indexed.
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
					if (!peer._cachedMaiaOsId && peer.account) {
						await groups.getSparkOsId(peer, peer.systemSparkCoId)
					}

					// Get co-value core (may need retries for local rapid writes during seeding)
					let coValueCore = peer.getCoValue(coId)
					let attempts = 0
					const maxAttempts = 10
					while ((!coValueCore || !peer.isAvailable(coValueCore)) && attempts < maxAttempts) {
						if (peer.node?.loadCoValueCore) {
							await peer.node.loadCoValueCore(coId).catch(() => {})
						}
						await new Promise((r) => setTimeout(r, 10 * (attempts + 1)))
						coValueCore = peer.getCoValue(coId)
						attempts++
					}
					if (!coValueCore || !peer.isAvailable(coValueCore)) {
						// Remote write or still not available - explicit re-index pass will catch if local
						return
					}

					const updatedCoValueCore = peer.getCoValue(coId)
					if (!updatedCoValueCore || !peer.isAvailable(updatedCoValueCore)) {
						return
					}

					await applyPersistentCoValueIndexing(peer, updatedCoValueCore)
					debugLog('db', 'storageHook', 'indexed coId=', coId)
				} catch (error) {
					const isFactoryCompilationError = error?.message?.includes('Failed to compile factory')
					if (!isFactoryCompilationError) {
						log.error('[StorageHook] Indexing failed', coId, error)
					}
				} finally {
					pendingIndexing.delete(coId)
				}
			})
			.then(() => storeResult)
	}

	return wrappedStorage
}
