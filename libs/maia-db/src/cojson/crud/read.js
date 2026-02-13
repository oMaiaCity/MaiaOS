/**
 * Universal Read Function
 *
 * Single universal read() function that handles ALL CoValue types identically
 * using $stores architecture with progressive loading and true reactivity.
 *
 * Replaces readSingleItem(), readCollection(), and readAllCoValues() with
 * ONE universal function that works for CoMap, CoList, and CoStream.
 */

import { ReactiveStore } from '@MaiaOS/operations/reactive-store'
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js'
import {
	resolve as resolveSchema,
	resolveReactive as resolveSchemaReactive,
} from '../schema/resolver.js'
import { ensureCoValueLoaded, getCoListId } from './collection-helpers.js'
import { extractCoValueDataFlat, resolveCoValueReferences } from './data-extraction.js'
import {
	deepResolveCoValue,
	resolveNestedReferences,
	resolveNestedReferencesPublic,
} from './deep-resolution.js'
import { matchesFilter } from './filter-helpers.js'
import { applyMapTransform } from './map-transform.js'
import { waitForStoreReady } from './read-operations.js'

/**
 * Universal read() function - works for ANY CoValue type
 *
 * Handles:
 * - Single CoValue reads (by coId)
 * - Collection reads (by schema, returns array of items)
 * - All CoValues reads (no schema, returns array of all CoValues)
 *
 * All use the same subscription pattern and progressive loading UX.
 *
 * @param {Object} backend - Backend instance
 * @param {string} [coId] - CoValue ID (for single item read)
 * @param {string} [schema] - Schema co-id (for collection read, or schemaHint for single item)
 * @param {Object} [filter] - Filter criteria (for collection/all reads)
 * @param {string} [schemaHint] - Schema hint for special types (@group, @account, @metaSchema)
 * @param {Object} [options] - Options for deep resolution and transformations
 * @param {boolean} [options.deepResolve=true] - Enable/disable deep resolution (default: true)
 * @param {number} [options.maxDepth=15] - Maximum depth for recursive resolution (default: 15, temporarily)
 * @param {number} [options.timeoutMs=5000] - Timeout for waiting for nested CoValues (default: 5000)
 * @param {Object} [options.resolveReferences] - Options for resolving CoValue references
 * @param {string[]} [options.resolveReferences.fields] - Specific field names to resolve (e.g., ['source', 'target']). If not provided, resolves all co-id references
 * @param {string[]} [options.resolveReferences.schemas] - Specific schema co-ids to resolve. If not provided, resolves all CoValues
 * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data (progressive loading)
 */
export async function read(
	backend,
	coId = null,
	schema = null,
	filter = null,
	schemaHint = null,
	options = {},
) {
	const {
		deepResolve = true,
		maxDepth = 15, // TODO: temporarily scaled up from 10 for @maia spark detail deep resolution
		timeoutMs = 5000,
		resolveReferences = null,
		map = null,
		onChange = null,
	} = options

	const readOptions = { deepResolve, maxDepth, timeoutMs, resolveReferences, map, onChange }

	// Single item read (by coId)
	if (coId) {
		// Use schema as schemaHint if provided
		return await readSingleCoValue(backend, coId, schemaHint || schema, readOptions)
	}

	// Collection read (by schema)
	if (schema) {
		// Sparks: read from account.sparks (includes @maia system spark). Index only has user-created sparks.
		const sparkSchemaCoId = await resolveSchema(backend, '@maia/schema/data/spark', {
			returnType: 'coId',
		})
		const resolvedSchema = await resolveSchema(backend, schema, { returnType: 'coId' })
		if (sparkSchemaCoId && resolvedSchema === sparkSchemaCoId) {
			return await readSparksFromAccount(backend, readOptions)
		}
		return await readCollection(backend, schema, filter, readOptions)
	}

	// All CoValues read (no schema) - returns array of all CoValues
	return await readAllCoValues(backend, filter, { deepResolve, maxDepth, timeoutMs })
}

/**
 * Create unified store that merges context value with query results
 * Detects query objects (objects with `schema` property) and merges their results
 * @param {Object} backend - Backend instance
 * @param {ReactiveStore} contextStore - Context CoValue ReactiveStore
 * @param {Object} options - Options for query resolution
 * @param {Function} [options.onChange] - Callback called when unified value changes (for triggering rerenders)
 * @returns {Promise<ReactiveStore>} Unified ReactiveStore with merged data
 * @private
 */
/**
 * Evaluate filter expressions using context values
 * @param {Object|null} filter - Filter object that may contain expressions (e.g., { "id": "$sparkId" })
 * @param {Object} contextValue - Current context value for expression evaluation
 * @param {Object} evaluator - Evaluator instance for MaiaScript expressions
 * @returns {Promise<Object|null>} Fully evaluated filter object
 */
async function evaluateFilter(filter, contextValue, evaluator) {
	if (!filter || typeof filter !== 'object') {
		return filter // Return null or non-object filters as-is
	}

	// Use resolveExpressions to evaluate filter values that reference context
	// This handles expressions like "$sparkId" → actual co-id value
	return await resolveExpressions(filter, evaluator, { context: contextValue, item: {} })
}

async function createUnifiedStore(backend, contextStore, options = {}) {
	const unifiedStore = new ReactiveStore({})
	const queryStores = new Map() // key -> ReactiveStore
	const queryDefinitions = new Map() // key -> query definition object (for $op) - stores evaluated filters
	const queryIsFindOne = new Map() // key -> boolean (true if query should return single object instead of array)
	const schemaSubscriptions = new Map() // key -> unsubscribe function for schema resolution
	const { timeoutMs = 5000, onChange: _onChange } = options

	// Create evaluator for expression evaluation in filters
	// Import dynamically to avoid circular dependencies
	const { Evaluator } = await import('@MaiaOS/script/utils/evaluator.js')
	const evaluator = new Evaluator()

	// Update Queue: batches all updates within a single event loop tick
	// Prevents duplicate renders when multiple query stores update simultaneously
	let lastUnifiedValue = null
	let _updateQueuePending = false
	let queueTimer = null

	const enqueueUpdate = () => {
		// Mark that an update is pending
		_updateQueuePending = true

		// Schedule batch processing if not already scheduled
		// CRITICAL: Only one microtask per event loop tick, even if multiple stores update
		if (!queueTimer) {
			queueTimer = queueMicrotask(() => {
				queueTimer = null

				// Process single batched update (all pending updates are processed together)
				const contextValue = contextStore.value || {}
				const mergedValue = { ...contextValue }

				// Remove special fields
				delete mergedValue['@stores']

				// Build $op object with query definitions (keyed by query name)
				const $op = {}
				for (const [key, queryDef] of queryDefinitions.entries()) {
					$op[key] = queryDef
				}

				// Add $op to merged value if there are any query definitions
				if (Object.keys($op).length > 0) {
					mergedValue.$op = $op
				}

				// Merge query store values (resolved arrays or single objects at root level, same key as query name)
				// CRITICAL: Always merge query store values, even if they're empty arrays or null
				// This ensures progressive loading works - empty arrays become populated arrays reactively
				for (const [key, queryStore] of queryStores.entries()) {
					if (queryStore && typeof queryStore.subscribe === 'function' && 'value' in queryStore) {
						// Remove the query object from mergedValue (if present) and replace with resolved value
						delete mergedValue[key]

						const isFindOne = queryIsFindOne.get(key) || false
						const storeValue = queryStore.value

						if (isFindOne) {
							// findOne query: return single object (or null if not found/empty)
							// If store value is an array, extract first element; if it's already an object, use it directly
							if (Array.isArray(storeValue)) {
								mergedValue[key] = storeValue.length > 0 ? storeValue[0] : null
							} else if (storeValue && typeof storeValue === 'object') {
								mergedValue[key] = storeValue
							} else {
								mergedValue[key] = null
							}
						} else {
							// Collection query: return array
							// CRITICAL: Always set query store value, even if it's undefined/null/empty array
							// This ensures reactivity works - when query store updates from [] to [items], unified store updates
							mergedValue[key] = storeValue
						}
					}
				}

				// Only update if value actually changed (deep comparison)
				// CRITICAL: JSON.stringify comparison detects array content changes ([] vs [item1, item2])
				const currentValueStr = JSON.stringify(mergedValue)
				const lastValueStr = lastUnifiedValue ? JSON.stringify(lastUnifiedValue) : null

				if (currentValueStr !== lastValueStr) {
					lastUnifiedValue = mergedValue
					// _set() automatically notifies all subscribers (including the one set up in ActorEngine)
					unifiedStore._set(mergedValue)
				}

				// Clear pending flag after processing
				_updateQueuePending = false
			})
		}
	}

	// Helper to resolve and subscribe to query objects
	const resolveQueries = async (contextValue) => {
		if (!contextValue || typeof contextValue !== 'object' || Array.isArray(contextValue)) {
			enqueueUpdate()
			return
		}

		const currentQueryKeys = new Set()

		// Detect and resolve query objects
		for (const [key, value] of Object.entries(contextValue)) {
			// Skip special fields and schema definition properties (not queries)
			// Schema definition properties like 'properties', 'items', '$defs' are part of schema structure, not queries
			if (
				key === '$schema' ||
				key === '$id' ||
				key === '@stores' ||
				key === 'properties' ||
				key === 'items' ||
				key === '$defs' ||
				key === 'cotype' ||
				key === 'indexing' ||
				key === 'title' ||
				key === 'description'
			)
				continue

			// Check if this is a query object (has schema property)
			if (value && typeof value === 'object' && !Array.isArray(value) && value.schema) {
				currentQueryKeys.add(key)

				// Check if we already have this query store
				const existingStore = queryStores.get(key)

				// Evaluate filter expressions using current context value
				// This enables dynamic filters like { "id": "$sparkId" }
				const evaluatedFilter = await evaluateFilter(value.filter || null, contextValue, evaluator)

				// Detect "findOne" pattern: filter with single "id" field pointing to a co-id
				// When filtering by a single ID, we should return a single object instead of an array
				const isFindOneQuery =
					evaluatedFilter &&
					typeof evaluatedFilter === 'object' &&
					Object.keys(evaluatedFilter).length === 1 &&
					evaluatedFilter.id &&
					typeof evaluatedFilter.id === 'string' &&
					evaluatedFilter.id.startsWith('co_z')

				const singleCoId = isFindOneQuery ? evaluatedFilter.id : null

				// Get stored query definition to compare filters
				const storedQueryDef = queryDefinitions.get(key)
				const storedFilter = storedQueryDef?.filter || null

				// Compare evaluated filters to detect changes (deep comparison)
				const filterChanged = JSON.stringify(evaluatedFilter) !== JSON.stringify(storedFilter)

				try {
					// UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema resolution for queries
					let schemaCoId = value.schema

					// Ensure schemaCoId is a string (might be an object if deep resolution happened)
					if (schemaCoId && typeof schemaCoId === 'object' && schemaCoId.$id) {
						// Schema was resolved to an object - use its $id
						schemaCoId = schemaCoId.$id
					}

					// Validate schemaCoId is a string
					if (typeof schemaCoId !== 'string') {
						if (process.env.DEBUG) console.error('Invalid schemaCoId:', schemaCoId)
						continue
					}

					if (!schemaCoId.startsWith('co_z')) {
						if (schemaCoId.startsWith('@maia/schema/')) {
							// Use reactive schema resolution - returns ReactiveStore that updates when schema becomes available
							const schemaStore = resolveSchemaReactive(backend, schemaCoId, { timeoutMs })

							// Subscribe to schema resolution - execute query when schema becomes available
							const schemaUnsubscribe = schemaStore.subscribe(async (schemaState) => {
								if (schemaState.loading) {
									// Still loading - create empty query store to show loading state
									if (!queryStores.has(key)) {
										// Re-evaluate filter to check if it's a findOne query
										const currentEvaluatedFilter = await evaluateFilter(
											value.filter || null,
											contextValue,
											evaluator,
										)
										const isFindOne =
											currentEvaluatedFilter &&
											typeof currentEvaluatedFilter === 'object' &&
											Object.keys(currentEvaluatedFilter).length === 1 &&
											currentEvaluatedFilter.id &&
											typeof currentEvaluatedFilter.id === 'string' &&
											currentEvaluatedFilter.id.startsWith('co_z')

										// Use null for findOne queries, [] for collection queries
										const loadingStore = new ReactiveStore(isFindOne ? null : [])
										queryStores.set(key, loadingStore)
										queryIsFindOne.set(key, isFindOne)

										// Store evaluated filter in query definition (re-evaluate in case context changed)
										queryDefinitions.set(key, {
											schema: value.schema,
											...(value.options ? { options: value.options } : {}),
											filter: currentEvaluatedFilter,
										})
										enqueueUpdate()
									}
									return
								}

								if (schemaState.error || !schemaState.schemaCoId) {
									if (process.env.DEBUG) console.error('Schema resolution failed:', schemaState.error)
									schemaUnsubscribe()
									return
								}

								// Schema resolved - execute query with evaluated filter
								const resolvedSchemaCoId = schemaState.schemaCoId

								try {
									const queryOptions = {
										...options,
										timeoutMs,
										...(value.options || {}),
									}

									// Re-evaluate filter in case context changed during schema resolution
									const currentEvaluatedFilter = await evaluateFilter(
										value.filter || null,
										contextValue,
										evaluator,
									)

									// Detect "findOne" pattern: filter with single "id" field pointing to a co-id
									const isFindOne =
										currentEvaluatedFilter &&
										typeof currentEvaluatedFilter === 'object' &&
										Object.keys(currentEvaluatedFilter).length === 1 &&
										currentEvaluatedFilter.id &&
										typeof currentEvaluatedFilter.id === 'string' &&
										currentEvaluatedFilter.id.startsWith('co_z')

									const singleCoId = isFindOne ? currentEvaluatedFilter.id : null

									// Check if filter changed since we stored it (or if query store doesn't exist)
									const storedQueryDef = queryDefinitions.get(key)
									const storedFilter = storedQueryDef?.filter || null
									const filterChanged =
										JSON.stringify(currentEvaluatedFilter) !== JSON.stringify(storedFilter)

									// Only recreate query store if filter changed or store doesn't exist
									if (filterChanged || !queryStores.has(key)) {
										// Unsubscribe from existing store if it exists
										const existingQueryStore = queryStores.get(key)
										if (existingQueryStore?._queryUnsubscribe) {
											existingQueryStore._queryUnsubscribe()
										}

										// Use findOne pattern: read single CoValue directly instead of collection query
										const queryStore =
											isFindOne && singleCoId
												? await read(backend, singleCoId, resolvedSchemaCoId, null, null, queryOptions)
												: await read(
														backend,
														null,
														resolvedSchemaCoId,
														currentEvaluatedFilter,
														null,
														queryOptions,
													)

										// Store whether this is a findOne query
										queryIsFindOne.set(key, isFindOne)

										// Store query definition with evaluated filter
										queryDefinitions.set(key, {
											schema: value.schema,
											...(value.options ? { options: value.options } : {}),
											filter: currentEvaluatedFilter,
										})

										// Subscribe to query store updates
										const queryUnsubscribe = queryStore.subscribe(() => {
											enqueueUpdate()
										})
										queryStore._queryUnsubscribe = queryUnsubscribe
										queryStores.set(key, queryStore)

										// Initial update now that query is ready
										enqueueUpdate()
									}

									schemaUnsubscribe()
								} catch (_error) {
									if (process.env.DEBUG) console.error(_error)
									schemaUnsubscribe()
								}
							})

							// Store schema subscription for cleanup
							schemaSubscriptions.set(key, schemaUnsubscribe)
						} else {
							if (process.env.DEBUG) {
								/* no-op */
							}
						}
					} else if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
						// Schema is already a co-id - check if filter changed or query store needs to be recreated
						if (filterChanged || !existingStore) {
							// Filter changed or query doesn't exist - recreate query store with new filter
							if (existingStore?._queryUnsubscribe) {
								existingStore._queryUnsubscribe()
							}

							const queryOptions = {
								...options,
								timeoutMs,
								...(value.options || {}),
							}

							// Use findOne pattern: read single CoValue directly instead of collection query
							const queryStore =
								isFindOneQuery && singleCoId
									? await read(backend, singleCoId, schemaCoId, null, null, queryOptions)
									: await read(backend, null, schemaCoId, evaluatedFilter, null, queryOptions)

							// Store whether this is a findOne query
							queryIsFindOne.set(key, isFindOneQuery)

							// Store query definition with evaluated filter
							queryDefinitions.set(key, {
								schema: value.schema,
								...(value.options ? { options: value.options } : {}),
								filter: evaluatedFilter,
							})

							const unsubscribe = queryStore.subscribe(() => {
								enqueueUpdate()
							})
							queryStore._queryUnsubscribe = unsubscribe
							queryStores.set(key, queryStore)
						}
						// If filter didn't change and store exists, keep using existing store
					}
				} catch (_error) {
					if (process.env.DEBUG) console.error(_error)
				}
			}
		}

		// Clean up query stores and definitions that are no longer in context
		for (const [key, store] of queryStores.entries()) {
			if (!currentQueryKeys.has(key)) {
				if (store._queryUnsubscribe) {
					store._queryUnsubscribe()
					delete store._queryUnsubscribe
				}
				queryStores.delete(key)
				queryDefinitions.delete(key)
				queryIsFindOne.delete(key)
			}
		}

		// Clean up schema subscriptions for queries that are no longer in context
		for (const [key, unsubscribe] of schemaSubscriptions.entries()) {
			if (!currentQueryKeys.has(key)) {
				if (unsubscribe) unsubscribe()
				schemaSubscriptions.delete(key)
			}
		}

		// Enqueue update after resolving all queries
		// This ensures unified store reflects current query state
		enqueueUpdate()
	}

	// Subscribe to context store changes
	const contextUnsubscribe = contextStore.subscribe(async (newContextValue) => {
		await resolveQueries(newContextValue)
	})

	// Set up cleanup
	const originalUnsubscribe = unifiedStore._unsubscribe
	unifiedStore._unsubscribe = () => {
		if (originalUnsubscribe) originalUnsubscribe()
		contextUnsubscribe()
		// Clean up schema subscriptions
		for (const unsubscribe of schemaSubscriptions.values()) {
			if (unsubscribe) unsubscribe()
		}
		schemaSubscriptions.clear()
		// Clean up query stores: our subscription + schedule cache cleanup (store may be shared, so don't call _unsubscribe directly)
		for (const store of queryStores.values()) {
			if (store._queryUnsubscribe) {
				store._queryUnsubscribe()
				delete store._queryUnsubscribe
			}
			// Schedule cleanup so cache runs _unsubscribe after 5s when no other consumer uses it (store may be shared)
			if (store._cacheKey && backend.subscriptionCache) {
				backend.subscriptionCache.scheduleCleanup(store._cacheKey)
			}
		}
		queryStores.clear()
	}

	// Initial resolve
	await resolveQueries(contextStore.value)

	return unifiedStore
}

/**
 * Extract co-ids from raw item that map expressions depend on.
 * Map expressions like "$$group.accountMembers" mean we depend on item.group.
 * If item.group is a co-id string, we must subscribe to it for reactivity.
 * @param {Object} rawData - Raw CoValue data (before map, may have co-id refs)
 * @param {Object} mapConfig - Map config e.g. { members: "$$group.accountMembers" }
 * @returns {Set<string>} Co-ids that affect the mapped result
 */
function getMapDependencyCoIds(rawData, mapConfig) {
	if (!mapConfig || typeof mapConfig !== 'object' || !rawData || typeof rawData !== 'object') {
		return new Set()
	}
	const deps = new Set()
	for (const expression of Object.values(mapConfig)) {
		if (typeof expression === 'string' && expression.startsWith('$$')) {
			const rootProperty = expression.substring(2).split('.')[0]
			if (rootProperty && rootProperty in rawData) {
				const val = rawData[rootProperty]
				if (typeof val === 'string' && val.startsWith('co_z')) {
					deps.add(val)
				}
			}
		}
	}
	return deps
}

/**
 * Process CoValue data: extract, resolve, and map
 * Helper function to avoid duplication and enable caching
 *
 * @param {Object} backend - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @param {string} [schemaHint] - Schema hint for special types
 * @param {Object} [options] - Options for processing
 * @param {Set<string>} [visited] - Visited set for circular reference detection
 * @returns {Promise<Object>} Processed CoValue data
 */
async function processCoValueData(backend, coValueCore, schemaHint, options, visited = new Set()) {
	const {
		deepResolve = true,
		maxDepth = 15, // TODO: temporarily scaled up from 10 for @maia spark detail deep resolution
		timeoutMs = 5000,
		resolveReferences = null,
		map = null,
	} = options

	// Extract CoValue data as flat object
	let data = extractCoValueDataFlat(backend, coValueCore, schemaHint)

	// PROGRESSIVE DEEP RESOLUTION: Resolve nested references progressively (non-blocking)
	// Main CoValue is already available (required for processCoValueData to be called)
	// Nested CoValues will be resolved progressively if available, skipped if not ready yet
	if (deepResolve) {
		try {
			// Don't await - let deep resolution happen progressively in background
			// This prevents blocking on nested CoValues that need to sync from server
			deepResolveCoValue(backend, coValueCore.id, { deepResolve, maxDepth, timeoutMs }).catch(
				(_err) => {
					// Silently handle errors - progressive resolution doesn't block on failures
				},
			)
		} catch (_err) {
			// Silently continue - deep resolution failure shouldn't block display
		}
	}

	// Resolve CoValue references (if option enabled)
	if (resolveReferences) {
		try {
			const resolutionOptions = { ...resolveReferences, timeoutMs }
			data = await resolveCoValueReferences(backend, data, resolutionOptions, visited, maxDepth, 0)
		} catch (_err) {
			// Silently continue - resolution failure shouldn't block display
		}
	}

	// Apply map transformation (if option enabled)
	if (map) {
		try {
			data = await applyMapTransform(backend, data, map, { timeoutMs })
		} catch (_err) {
			if (process.env.DEBUG) console.error(_err)
			// Continue with unmapped data
		}
	}

	return data
}

/**
 * Read a single CoValue by ID
 *
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue ID
 * @param {string} [schemaHint] - Schema hint for special types
 * @param {Object} [options] - Options for deep resolution
 * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data (with query objects merged if present)
 */
async function readSingleCoValue(backend, coId, schemaHint = null, options = {}) {
	const {
		deepResolve = true,
		maxDepth = 15, // TODO: temporarily scaled up from 10 for @maia spark detail deep resolution
		timeoutMs = 5000,
		resolveReferences = null,
		map = null,
	} = options

	// CRITICAL OPTIMIZATION: Check cache for resolved+mapped data before processing
	const cache = backend.subscriptionCache
	const cacheOptions = { deepResolve, resolveReferences, map, maxDepth, timeoutMs }
	const cachedData = cache.getResolvedData(coId, cacheOptions)

	if (cachedData) {
		const hasQueryObjects =
			cachedData &&
			typeof cachedData === 'object' &&
			Object.values(cachedData).some(
				(value) => value && typeof value === 'object' && !Array.isArray(value) && value.schema,
			)
		const ctxStore = new ReactiveStore(cachedData)
		const coValueCore = backend.getCoValue(coId)
		if (coValueCore) {
			const processAndCacheCached = async (core) => {
				const newData = await processCoValueData(backend, core, schemaHint, options, new Set())
				cache.setResolvedData(coId, cacheOptions, newData)
				return newData
			}
			const cacheDepUnsubs = new Map()
			const setupMapDepSubs = (mainCore) => {
				if (!map) return
				const rawData = extractCoValueDataFlat(backend, mainCore, schemaHint)
				const newDeps = getMapDependencyCoIds(rawData, map)
				for (const depCoId of newDeps) {
					if (cacheDepUnsubs.has(depCoId)) continue
					const depCore = backend.getCoValue(depCoId)
					if (!depCore) continue
					const unsub = depCore.subscribe(async () => {
						if (!mainCore.isAvailable()) return
						cache.invalidateResolvedData(depCoId)
						const data = await processAndCacheCached(mainCore)
						ctxStore._set(data)
					})
					cacheDepUnsubs.set(depCoId, unsub)
				}
				for (const [depCoId, unsub] of cacheDepUnsubs.entries()) {
					if (!newDeps.has(depCoId)) {
						unsub()
						cacheDepUnsubs.delete(depCoId)
					}
				}
			}
			const cacheCoUnsub = coValueCore.subscribe(async (core) => {
				if (core.isAvailable()) {
					const newData = await processAndCacheCached(core)
					setupMapDepSubs(core)
					ctxStore._set(newData)
				}
			})
			setupMapDepSubs(coValueCore)
			backend.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({
				unsubscribe: cacheCoUnsub,
			}))

			if (hasQueryObjects) {
				const unified = await createUnifiedStore(backend, ctxStore, options)
				const origUnsub = unified._unsubscribe
				unified._unsubscribe = () => {
					if (origUnsub) origUnsub()
					cacheCoUnsub()
					for (const unsub of cacheDepUnsubs.values()) unsub()
					cacheDepUnsubs.clear()
					backend.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
				}
				return unified
			}
			const origUnsub = ctxStore._unsubscribe
			ctxStore._unsubscribe = () => {
				if (origUnsub) origUnsub()
				cacheCoUnsub()
				for (const unsub of cacheDepUnsubs.values()) unsub()
				cacheDepUnsubs.clear()
				backend.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
			}
		}
		return hasQueryObjects ? await createUnifiedStore(backend, ctxStore, options) : ctxStore
	}

	const coValueCore = backend.getCoValue(coId)

	if (!coValueCore) {
		const errStore = new ReactiveStore({ error: 'CoValue not found', id: coId })
		return errStore
	}

	// Helper to process and cache CoValue data (fresh visited set per run for correct re-processing)
	const processAndCache = async (core) => {
		const processedData = await processCoValueData(backend, core, schemaHint, options, new Set())

		// Cache the processed data
		cache.setResolvedData(coId, cacheOptions, processedData)

		return processedData
	}

	// Map dependency subscriptions: when resolved refs (e.g. group) change, re-process main coValue
	const depUnsubscribes = new Map()
	const store = new ReactiveStore(null)
	let unifiedPipeUnsub = null
	let queryCtxStore = null

	const setupMapDependencySubscriptions = (mainCore) => {
		if (!map) return
		const rawData = extractCoValueDataFlat(backend, mainCore, schemaHint)
		const newDeps = getMapDependencyCoIds(rawData, map)
		for (const depCoId of newDeps) {
			if (depUnsubscribes.has(depCoId)) continue
			const depCore = backend.getCoValue(depCoId)
			if (!depCore) continue
			const unsub = depCore.subscribe(async () => {
				if (!mainCore.isAvailable()) return
				cache.invalidateResolvedData(depCoId)
				const data = await processAndCache(mainCore)
				if (queryCtxStore) queryCtxStore._set(data)
				else store._set(data)
			})
			depUnsubscribes.set(depCoId, unsub)
		}
		for (const [depCoId, unsub] of depUnsubscribes.entries()) {
			if (!newDeps.has(depCoId)) {
				unsub()
				depUnsubscribes.delete(depCoId)
			}
		}
	}

	const coUnsubscribe = coValueCore.subscribe(async (core) => {
		if (!core.isAvailable()) {
			store._set({ id: coId, loading: true })
			return
		}
		const data = await processAndCache(core)
		setupMapDependencySubscriptions(core)
		const hasQueryObjects =
			data &&
			typeof data === 'object' &&
			Object.values(data).some(
				(value) => value && typeof value === 'object' && !Array.isArray(value) && value.schema,
			)
		if (hasQueryObjects) {
			if (!queryCtxStore) {
				queryCtxStore = new ReactiveStore(data)
				const unified = await createUnifiedStore(backend, queryCtxStore, options)
				unifiedPipeUnsub = unified.subscribe((v) => store._set(v))
				store._set(unified.value)
			} else {
				queryCtxStore._set(data)
			}
		} else {
			store._set(data)
		}
	})

	backend.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({
		unsubscribe: coUnsubscribe,
	}))

	if (coValueCore.isAvailable()) {
		const data = await processAndCache(coValueCore)
		setupMapDependencySubscriptions(coValueCore)
		const hasQueryObjects =
			data &&
			typeof data === 'object' &&
			Object.values(data).some(
				(value) => value && typeof value === 'object' && !Array.isArray(value) && value.schema,
			)
		if (hasQueryObjects) {
			store._set(data)
			const unified = await createUnifiedStore(backend, store, options)
			const origUnsub = unified._unsubscribe
			unified._unsubscribe = () => {
				if (origUnsub) origUnsub()
				coUnsubscribe()
				for (const unsub of depUnsubscribes.values()) unsub()
				depUnsubscribes.clear()
				backend.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
			}
			return unified
		}
		store._set(data)
		const origUnsub = store._unsubscribe
		store._unsubscribe = () => {
			if (origUnsub) origUnsub()
			coUnsubscribe()
			for (const unsub of depUnsubscribes.values()) unsub()
			depUnsubscribes.clear()
			backend.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
		}
		return store
	}

	store._set({ id: coId, loading: true })
	ensureCoValueLoaded(backend, coId)
		.then(() => {})
		.catch((err) => {
			store._set({ error: err.message, id: coId })
		})

	const origUnsub = store._unsubscribe
	store._unsubscribe = () => {
		if (origUnsub) origUnsub()
		if (unifiedPipeUnsub) {
			unifiedPipeUnsub()
			unifiedPipeUnsub = null
		}
		coUnsubscribe()
		for (const unsub of depUnsubscribes.values()) unsub()
		depUnsubscribes.clear()
		backend.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
	}
	return store
}

/**
 * Read sparks from account.sparks CoMap (includes @maia system spark).
 * Used when schema is spark schema - index colist only has user-created sparks.
 * @param {Object} backend - Backend instance
 * @param {Object} options - Read options
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of spark items {id, name, ...}
 */
async function readSparksFromAccount(backend, options = {}) {
	const { deepResolve = true, maxDepth = 15, timeoutMs = 5000 } = options // TODO: maxDepth temporarily 15 for @maia spark detail
	const store = backend.subscriptionCache.getOrCreateStore(
		'sparks:account',
		() => new ReactiveStore([]),
	)

	const sparksId = backend.account?.get?.('sparks')
	if (!sparksId || !sparksId.startsWith('co_')) {
		return store
	}

	const updateSparks = async () => {
		const sparksStore = await readSingleCoValue(backend, sparksId, null, { deepResolve: false })
		try {
			await waitForStoreReady(sparksStore, sparksId, timeoutMs)
		} catch {
			return
		}
		const sparksData = sparksStore?.value ?? {}
		if (sparksData?.error) return

		const sparkCoIds = []
		for (const k of Object.keys(sparksData)) {
			if (k === 'id' || k === 'loading' || k === 'error' || k === '$schema' || k === 'type') continue
			const v = sparksData[k]
			const coId = typeof v === 'string' && v.startsWith('co_') ? v : k.startsWith('co_') ? k : null
			if (coId) sparkCoIds.push(coId)
		}

		const items = []
		for (const coId of sparkCoIds) {
			try {
				const itemStore = await readSingleCoValue(backend, coId, null, {
					deepResolve,
					maxDepth,
					timeoutMs,
				})
				await waitForStoreReady(itemStore, coId, Math.min(timeoutMs, 2000))
				const data = itemStore?.value
				if (data && !data.error) {
					items.push({ id: coId, name: data.name ?? coId, ...data })
				}
			} catch {
				items.push({ id: coId, name: coId })
			}
		}
		store._set(items)
	}

	await updateSparks()
	const sparksStore = await readSingleCoValue(backend, sparksId, null, { deepResolve: false })
	const unsub = sparksStore?.subscribe?.(() => updateSparks())
	if (unsub) {
		backend.subscriptionCache.getOrCreate(`subscription:sparks:${sparksId}`, () => ({
			unsubscribe: unsub,
		}))
	}
	return store
}

/**
 * Read a collection of CoValues by schema (CoList)
 *
 * Returns array of items from the CoList, with progressive loading.
 *
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @param {Object} [filter] - Filter criteria
 * @param {Object} [options] - Options for deep resolution and transformations
 * @param {Object} [options.resolveReferences] - Options for resolving CoValue references
 * @param {string[]} [options.resolveReferences.fields] - Specific field names to resolve (e.g., ['source', 'target'])
 * @param {string[]} [options.resolveReferences.schemas] - Specific schema co-ids to resolve
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of CoValue data
 */
async function readCollection(backend, schema, filter = null, options = {}) {
	const {
		deepResolve = true,
		maxDepth = 15, // TODO: temporarily scaled up from 10 for @maia spark detail deep resolution
		timeoutMs = 5000,
		resolveReferences = null,
		map = null,
	} = options

	// CRITICAL FIX: Cache stores by schema+filter+options to allow multiple actors to share the same store
	// This prevents creating duplicate stores when navigating back to a vibe
	// IMPORTANT: Include options in cache key so queries with different map/resolveReferences get different stores
	const optionsKey =
		options && (options.map || options.resolveReferences)
			? JSON.stringify({
					map: options.map || null,
					resolveReferences: options.resolveReferences || null,
				})
			: ''
	const cacheKey = `${schema}:${JSON.stringify(filter || {})}:${optionsKey}`

	// Use unified cache for store caching
	const store = backend.subscriptionCache.getOrCreateStore(cacheKey, () => {
		const s = new ReactiveStore([])
		s._cacheKey = `store:${cacheKey}`
		return s
	})

	// Get schema index colist ID from spark.os.indexes (keyed by schema co-id)
	// Supports both schema co-ids (co_z...) and human-readable names (@maia/schema/data/todos)
	const coListId = await getCoListId(backend, schema)
	if (!coListId) {
		return store
	}

	// Get CoList CoValueCore
	const coListCore = backend.getCoValue(coListId)
	if (!coListCore) {
		return store
	}

	// Track item IDs we've subscribed to (for cleanup)
	const subscribedItemIds = new Set()

	// CRITICAL OPTIMIZATION: Persistent shared visited set across ALL updateStore() calls
	// This prevents duplicate deep resolution work when updateStore() is called multiple times
	// (e.g., from subscription callbacks firing repeatedly)
	const sharedVisited = new Set()

	// Cache for resolved+mapped item data (keyed by itemId)
	const cache = backend.subscriptionCache

	// Fix: Declare updateStore BEFORE any subscriptions to avoid temporal dead zone
	// updateStore is referenced in subscription callbacks (both colist and item subscriptions)
	// Initialize to no-op function to prevent temporal dead zone errors when subscriptions fire synchronously
	let updateStore = async () => {} // Will be reassigned below

	// CRITICAL: Progressive loading - don't block if index colist isn't available yet
	// Trigger loading (fire and forget) - subscription will update store when ready
	if (!backend.isAvailable(coListCore)) {
		// Trigger loading (non-blocking)
		ensureCoValueLoaded(backend, coListId, { waitForAvailable: false }).catch((_err) => {
			if (process.env.DEBUG) console.error(_err)
		})

		// Set up subscription to update store when colist becomes available
		if (coListCore) {
			const unsubscribeColist = coListCore.subscribe((core) => {
				if (core && backend.isAvailable(core)) {
					// Colist is now available - trigger store update
					updateStore().catch((_err) => {
						if (process.env.DEBUG) console.error(_err)
					})
				}
			})
			backend.subscriptionCache.getOrCreate(`subscription:${coListId}`, () => ({
				unsubscribe: unsubscribeColist,
			}))
		}

		// Return store immediately (empty array) - will update reactively when colist loads
		// This allows instant UI updates without waiting for index
		return store
	}

	// Helper to subscribe to an item CoValue
	const subscribeToItem = (itemId) => {
		// Skip if already subscribed
		if (subscribedItemIds.has(itemId)) {
			return
		}

		subscribedItemIds.add(itemId)

		const itemCore = backend.getCoValue(itemId)
		if (!itemCore || !backend.isAvailable(itemCore)) {
			// Item not in memory or not available yet - trigger loading and wait for it to be available
			ensureCoValueLoaded(backend, itemId, { waitForAvailable: true, timeoutMs: 2000 })
				.then(() => {
					// Item is now loaded and available - set up subscription
					const loadedItemCore = backend.getCoValue(itemId)
					if (loadedItemCore && backend.isAvailable(loadedItemCore)) {
						// Subscribe to item changes (fires when item becomes available or updates)
						// CRITICAL: Invalidate cache BEFORE processing to ensure fresh data is processed
						// The promise-based cache in getOrCreateResolvedData() will handle concurrent calls
						const unsubscribeItem = loadedItemCore.subscribe(() => {
							// Invalidate cache BEFORE processing - ensures getOrCreateResolvedData() processes fresh data
							cache.invalidateResolvedData(itemId)
							// Fire and forget - don't await async updateStore in subscription callback
							// Guard: Check if updateStore is defined (may not be initialized yet if subscription fires synchronously)
							if (updateStore) {
								updateStore().catch((_err) => {
									if (process.env.DEBUG) console.error(_err)
								})
							}
						})

						// Use subscriptionCache for each item (same pattern for all CoValue references)
						backend.subscriptionCache.getOrCreate(`subscription:${itemId}`, () => ({
							unsubscribe: unsubscribeItem,
						}))

						// CRITICAL FIX: Trigger updateStore immediately after item is available
						// This ensures items that just loaded are included in the store
						// Guard: Check if updateStore is defined (may not be initialized yet)
						if (updateStore) {
							updateStore().catch((_err) => {
								if (process.env.DEBUG) console.error(_err)
							})
						}
					}
				})
				.catch((_err) => {
					if (process.env.DEBUG) console.error(_err)
				})
			return
		}

		// Subscribe to item changes (fires when item becomes available or updates)
		// CRITICAL: Invalidate cache BEFORE processing to ensure fresh data is processed
		// The promise-based cache in getOrCreateResolvedData() will handle concurrent calls
		const unsubscribeItem = itemCore.subscribe(() => {
			// Invalidate cache BEFORE processing - ensures getOrCreateResolvedData() processes fresh data
			cache.invalidateResolvedData(itemId)
			// Fire and forget - don't await async updateStore in subscription callback
			// Guard: Check if updateStore is assigned before calling (prevents temporal dead zone error)
			if (updateStore) {
				updateStore().catch((_err) => {
					if (process.env.DEBUG) console.error(_err)
				})
			}
		})

		// Use subscriptionCache for each item (same pattern for all CoValue references)
		backend.subscriptionCache.getOrCreate(`subscription:${itemId}`, () => ({
			unsubscribe: unsubscribeItem,
		}))
	}

	// Helper to update store with current items
	// Fix: Assign to pre-declared variable (declared above to avoid temporal dead zone)
	updateStore = async () => {
		const results = []

		// Get current CoList content (should be available now, but check anyway)
		if (!backend.isAvailable(coListCore)) {
			// CoList became unavailable - trigger reload
			ensureCoValueLoaded(backend, coListId).catch((_err) => {
				if (process.env.DEBUG) console.error(_err)
			})
			return
		}

		const content = backend.getCurrentContent(coListCore)
		if (!content || !content.toJSON) {
			return
		}

		try {
			const itemIdsArray = content.toJSON() // Array of item co-ids

			// Process each item ID
			let _availableCount = 0
			let _unavailableCount = 0

			for (const itemId of itemIdsArray) {
				if (typeof itemId !== 'string' || !itemId.startsWith('co_')) {
					continue
				}

				// Subscribe to item (if not already subscribed) - this ensures reactive updates
				subscribeToItem(itemId)

				// Get item CoValueCore
				const itemCore = backend.getCoValue(itemId)
				if (!itemCore) {
					// Item not in memory - subscribeToItem already triggered loading
					_unavailableCount++
					continue
				}

				// Extract item if available (progressive loading - show available items immediately)
				if (backend.isAvailable(itemCore)) {
					_availableCount++

					// CRITICAL OPTIMIZATION: Use getOrCreateResolvedData to prevent concurrent processing
					// This ensures that if updateStore is called multiple times, only one processing happens
					const itemCacheOptions = { deepResolve, resolveReferences, map, maxDepth, timeoutMs }

					// CRITICAL: Get fresh itemCore reference each time to ensure we read latest data
					// The itemCore reference might be stale if item changed between subscription and processing
					const currentItemCore = backend.getCoValue(itemId)
					if (!currentItemCore || !backend.isAvailable(currentItemCore)) {
						// Item no longer available - skip it (will be handled by subscription)
						continue
					}

					const itemData = await cache.getOrCreateResolvedData(itemId, itemCacheOptions, async () => {
						// Process and cache the item data using fresh CoValueCore reference
						let processedData = extractCoValueDataFlat(backend, currentItemCore)

						// Filter out empty CoMaps (defense in depth - prevents skeletons from appearing even if index removal fails)
						// Empty CoMap = object with only id, type, $schema properties (no data properties)
						const dataKeys = Object.keys(processedData).filter(
							(key) => !['id', 'type', '$schema'].includes(key),
						)
						if (dataKeys.length === 0 && processedData.type === 'comap') {
							// Return empty object for empty CoMap (will be filtered out later)
							return processedData
						}

						// Deep resolve nested references if enabled (skip when map present - map does on-demand resolution)
						if (deepResolve && !map && !cache.isResolved(itemId)) {
							try {
								await resolveNestedReferences(backend, processedData, sharedVisited, {
									maxDepth,
									timeoutMs,
									currentDepth: 0,
								})
							} catch (_err) {
								// Silently continue - deep resolution failure shouldn't block item display
							}
						}

						// Resolve CoValue references (if option enabled)
						// This allows views to access nested properties like $$source.role
						if (resolveReferences) {
							try {
								const resolutionOptions = { ...resolveReferences, timeoutMs }
								const resolvedData = await resolveCoValueReferences(
									backend,
									processedData,
									resolutionOptions,
									sharedVisited,
									maxDepth,
									0,
								)
								// Replace processedData with resolved version
								Object.assign(processedData, resolvedData)
							} catch (_err) {
								// Silently continue - resolution failure shouldn't block item display
							}
						}

						// Apply map transformation (if option enabled)
						// This transforms data using MaiaScript expressions (e.g., { sender: "$$source.role" })
						if (map) {
							try {
								processedData = await applyMapTransform(backend, processedData, map, { timeoutMs })
							} catch (_err) {
								if (process.env.DEBUG) console.error(_err)
							}
						}

						return processedData
					})

					// Skip empty CoMaps
					const dataKeys = Object.keys(itemData).filter(
						(key) => !['id', 'type', '$schema'].includes(key),
					)
					if (dataKeys.length === 0 && itemData.type === 'comap') {
						continue
					}

					// Apply filter if provided
					if (!filter || matchesFilter(itemData, filter)) {
						results.push(itemData)
					}
				} else {
					_unavailableCount++
				}
				// If item not available yet, subscription will fire when it becomes available
			}
		} catch (_e) {
			if (process.env.DEBUG) console.error(_e)
		}

		// Update store with current results (progressive loading - may be partial, updates reactively)
		// CRITICAL: Always update store, even if results array is empty, to ensure reactivity works
		// This ensures that when items become available later, the store update triggers subscribers
		store._set(results)
	}

	// Subscribe to CoList changes (fires when items are added/removed or CoList updates)
	const unsubscribeCoList = coListCore.subscribe(() => {
		// Fire and forget - don't await async updateStore in subscription callback
		updateStore().catch((_err) => {
			if (process.env.DEBUG) console.error(_err)
		})
	})

	// Use subscriptionCache for CoList
	backend.subscriptionCache.getOrCreate(`subscription:${coListId}`, () => ({
		unsubscribe: unsubscribeCoList,
	}))

	// CRITICAL FIX: Trigger immediate loading of all items before initial updateStore()
	// This ensures items are loaded synchronously, not reactively after view renders
	// Read CoList content to get all item IDs
	if (backend.isAvailable(coListCore)) {
		const content = backend.getCurrentContent(coListCore)
		if (content?.toJSON) {
			try {
				const itemIdsArray = content.toJSON()
				// Trigger loading of all items immediately (don't wait - let them load in parallel)
				// This ensures items are available when updateStore() is called, reducing reactive pop-in
				for (const itemId of itemIdsArray) {
					if (typeof itemId === 'string' && itemId.startsWith('co_')) {
						const itemCore = backend.getCoValue(itemId)
						if (itemCore && !backend.isAvailable(itemCore)) {
							// Trigger loading immediately (don't wait - parallel loading)
							ensureCoValueLoaded(backend, itemId).catch((_err) => {
								if (process.env.DEBUG) console.error(_err)
							})
						}
					}
				}
			} catch (_e) {
				// Ignore errors - will be handled in updateStore()
			}
		}
	}

	// Initial load (progressive - shows available items immediately, sets up subscriptions for all items)
	// Items that aren't ready yet will populate reactively via subscriptions
	await updateStore()

	// Set up store unsubscribe to clean up subscriptions and remove from cache
	const originalUnsubscribe = store._unsubscribe
	store._unsubscribe = () => {
		// Remove from cache when store is cleaned up
		backend.subscriptionCache.scheduleCleanup(`store:${cacheKey}`)
		if (originalUnsubscribe) originalUnsubscribe()
		backend.subscriptionCache.scheduleCleanup(`subscription:${coListId}`)
		for (const itemId of subscribedItemIds) {
			backend.subscriptionCache.scheduleCleanup(`subscription:${itemId}`)
		}
	}

	return store
}

/**
 * Read all CoValues (no schema filter)
 *
 * Returns array of all CoValues in the node.
 *
 * @param {Object} backend - Backend instance
 * @param {Object} [filter] - Filter criteria
 * @param {Object} [options] - Options for deep resolution
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of all CoValue data
 */
async function readAllCoValues(backend, filter = null, options = {}) {
	const {
		deepResolve = true,
		maxDepth = 15, // TODO: temporarily scaled up from 10 for @maia spark detail deep resolution
		timeoutMs = 5000,
	} = options
	const store = new ReactiveStore([])

	// Track CoValue IDs we've subscribed to (for cleanup)
	const subscribedCoIds = new Set()

	// Fix: Declare updateStore before subscribeToCoValue to avoid temporal dead zone
	// updateStore is referenced in subscribeToCoValue callbacks, so it must be declared first
	// Initialize to no-op function to prevent temporal dead zone errors when subscriptions fire synchronously
	let updateStore = async () => {} // Will be reassigned below

	// Helper to subscribe to a CoValue
	const subscribeToCoValue = (coId, coValueCore) => {
		// Skip if already subscribed
		if (subscribedCoIds.has(coId)) {
			return
		}

		subscribedCoIds.add(coId)

		const unsubscribe = coValueCore.subscribe(() => {
			updateStore()
		})

		// Use subscriptionCache (same pattern for all types)
		backend.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({ unsubscribe }))
	}

	// Helper to update store with all CoValues
	// Fix: Assign to pre-declared variable (declared above to avoid temporal dead zone)
	updateStore = async () => {
		const allCoValues = backend.getAllCoValues()
		const results = []

		for (const [coId, coValueCore] of allCoValues.entries()) {
			// Skip invalid IDs
			if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
				continue
			}

			// Subscribe to CoValue (if not already subscribed)
			subscribeToCoValue(coId, coValueCore)

			// Trigger loading for unavailable CoValues
			if (!backend.isAvailable(coValueCore)) {
				ensureCoValueLoaded(backend, coId).catch((_err) => {
					if (process.env.DEBUG) console.error(_err)
				})
				continue
			}

			// Extract CoValue data as flat object
			const data = extractCoValueDataFlat(backend, coValueCore)

			// Filter out empty CoMaps (defense in depth - prevents skeletons from appearing even if index removal fails)
			// Empty CoMap = object with only id, type, $schema properties (no data properties)
			const dataKeys = Object.keys(data).filter((key) => !['id', 'type', '$schema'].includes(key))
			if (dataKeys.length === 0 && data.type === 'comap') {
				// Skip empty CoMap skeletons
				continue
			}

			// Deep resolve nested references if enabled
			if (deepResolve) {
				try {
					await resolveNestedReferencesPublic(backend, data, { maxDepth, timeoutMs })
				} catch (_err) {
					// Silently continue - deep resolution failure shouldn't block the app
				}
			}

			// Apply filter if provided
			if (!filter || matchesFilter(data, filter)) {
				results.push(data)
			}
		}

		store._set(results)
	}

	// Initial load (triggers loading for unavailable CoValues, sets up subscriptions)
	await updateStore()

	// Set up store unsubscribe to clean up subscriptions
	const originalUnsubscribe = store._unsubscribe
	store._unsubscribe = () => {
		if (originalUnsubscribe) originalUnsubscribe()
		// Schedule cleanup for all subscribed CoValues
		for (const coId of subscribedCoIds) {
			backend.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
		}
	}

	return store
}
