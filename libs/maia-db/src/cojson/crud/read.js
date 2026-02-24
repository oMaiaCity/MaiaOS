/**
 * Universal Read Function
 *
 * Single universal read() function that handles ALL CoValue types identically
 * using $stores architecture with progressive loading and true reactivity.
 *
 * Replaces readSingleItem(), readCollection(), and readAllCoValues() with
 * ONE universal function that works for CoMap, CoList, and CoStream.
 */

import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js'
import { ReactiveStore } from '../../reactive-store.js'
import { getHumansRegistryId, getSparksRegistryId } from '../groups/groups.js'
import { resolve as resolveSchema } from '../schema/resolver.js'
import { ensureCoValueLoaded, getCoListId } from './collection-helpers.js'
import { extractCoValueData } from './data-extraction.js'
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

	const readOptions = { deepResolve, maxDepth, timeoutMs, map, onChange }

	// Single item read (by coId)
	if (coId) {
		// Use schema as schemaHint if provided
		return await readSingleCoValue(peer, coId, schemaHint || schema, readOptions)
	}

	// Collection read (by schema)
	if (schema) {
		// Sparks: read from account.registries.sparks (index only has user-created sparks)
		const sparkSchemaCoId = await resolveSchema(peer, '°Maia/schema/data/spark', {
			returnType: 'coId',
		})
		// Humans: read from account.registries.humans (no schema index)
		const humanSchemaCoId = await resolveSchema(peer, '°Maia/schema/data/human', {
			returnType: 'coId',
		})
		const resolvedSchema = await resolveSchema(peer, schema, { returnType: 'coId' })
		if (sparkSchemaCoId && resolvedSchema === sparkSchemaCoId) {
			return await readSparksFromAccount(peer, readOptions)
		}
		if (humanSchemaCoId && resolvedSchema === humanSchemaCoId) {
			return await readHumansFromRegistries(peer, readOptions)
		}
		return await readCollection(peer, schema, filter, readOptions)
	}

	// All CoValues read (no schema) - returns array of all CoValues
	return await readAllCoValues(peer, filter, { deepResolve, maxDepth, timeoutMs })
}

/**
 * Create unified store that merges context value with query results
 * Detects query objects (objects with `schema` property) and merges their results
 * @param {Object} peer - Backend instance
 * @param {ReactiveStore} contextStore - Context CoValue ReactiveStore
 * @param {Object} options - Options for query resolution
 * @param {Function} [options.onChange] - Callback called when unified value changes (for triggering rerenders)
 * @returns {Promise<ReactiveStore>} Unified ReactiveStore with merged data
 * @private
 */
/** Detect findOne pattern: filter with single id field pointing to co-id */
function isFindOneFilter(filter) {
	return (
		filter &&
		typeof filter === 'object' &&
		Object.keys(filter).length === 1 &&
		filter.id &&
		typeof filter.id === 'string' &&
		filter.id.startsWith('co_z')
	)
}

/**
 * True if value looks like a context query object (has schema for reads), not a DB_OP payload.
 * DB_OP payloads have { op, schema, data } - schema is operation target, not a read query.
 */
function isQueryObject(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value) || !value.schema) return false
	if (value.op && !['query', 'read'].includes(value.op) && typeof value.schema === 'string')
		return false
	return true
}

/** Execute read for schema+filter and wire query store. Shared by reactive and co-id branches. */
async function wireQueryStoreForSchema(
	peer,
	readFn,
	key,
	resolvedSchemaCoId,
	evaluatedFilter,
	value,
	queryStores,
	queryDefinitions,
	queryIsFindOne,
	enqueueUpdate,
	options,
	timeoutMs,
) {
	const isFindOne = isFindOneFilter(evaluatedFilter)
	const singleCoId = isFindOne ? evaluatedFilter.id : null
	const queryOptions = { ...options, timeoutMs, ...(value.map ? { map: value.map } : {}) }
	const queryStore =
		isFindOne && singleCoId
			? await readFn(peer, singleCoId, resolvedSchemaCoId, null, null, queryOptions)
			: await readFn(peer, null, resolvedSchemaCoId, evaluatedFilter, null, queryOptions)

	queryIsFindOne.set(key, isFindOne)
	queryDefinitions.set(key, {
		schema: value.schema,
		filter: evaluatedFilter,
		...(value.map ? { map: value.map } : {}),
	})

	const unsub = queryStore.subscribe(() => enqueueUpdate())
	queryStore._queryUnsubscribe = unsub
	queryStores.set(key, queryStore)
	enqueueUpdate()
}

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

async function createUnifiedStore(peer, contextStore, options = {}) {
	const unifiedStore = new ReactiveStore({})
	const queryStores = new Map() // key -> ReactiveStore
	const queryDefinitions = new Map() // key -> query definition object (for $op) - stores evaluated filters
	const queryIsFindOne = new Map() // key -> boolean (true if query should return single object instead of array)
	const schemaSubscriptions = new Map() // key -> unsubscribe function for schema resolution
	const { timeoutMs = 5000, onChange: _onChange } = options

	// Evaluator injected at boot (avoids maia-db → maia-engines dependency)
	const evaluator = peer.evaluator
	if (!evaluator) {
		throw new Error(
			'[read] Evaluator required for reactive resolution. Inject via DataEngine options at boot.',
		)
	}

	// Update Queue: batches all updates within a single event loop tick
	// Prevents duplicate renders when multiple query stores update simultaneously
	let lastUnifiedValue = null
	let _updateQueuePending = false
	let queueTimer = null

	const enqueueUpdate = () => {
		// Mark that an update is pending
		_updateQueuePending = true

		// Schedule batch processing if not already scheduled
		// Batch updates: one microtask per tick
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
				// Always merge query values (even empty) so progressive loading works
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
							// Set even empty arrays so reactivity works
							mergedValue[key] = storeValue
							// Derived: has{Key} = array has items (e.g. conversations -> hasConversations)
							// Keeps view dumb: state/context handles logic, view uses simple $hasConversations ref
							const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`
							if (hasKey in contextValue) {
								mergedValue[hasKey] = Array.isArray(storeValue) && storeValue.length > 0
							}
						}
					}
				}

				// Replace skipped query objects with [] so views don't crash on $each (expect array, not {schema,map})
				for (const [key, value] of Object.entries(contextValue || {})) {
					if (key !== '$schema' && key !== '$id' && isQueryObject(value) && !queryStores.has(key)) {
						delete mergedValue[key]
						mergedValue[key] = []
						const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`
						if (hasKey in contextValue) {
							mergedValue[hasKey] = false
						}
					}
				}

				// Only update if value actually changed (deep comparison)
				// Deep change detection via JSON.stringify
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

			// Check if this is a query object (has schema for reads), exclude DB_OP payloads
			if (isQueryObject(value)) {
				currentQueryKeys.add(key)

				// Check if we already have this query store
				const existingStore = queryStores.get(key)

				const evaluatedFilter = await evaluateFilter(value.filter || null, contextValue, evaluator)

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
						if (typeof process !== 'undefined' && process.env?.DEBUG)
							console.error('Invalid schemaCoId:', schemaCoId)
						continue
					}

					// Runtime: resolve human-readable schema refs to co-id (seed should transform; resolve handles edge cases)
					if (!schemaCoId.startsWith('co_z')) {
						try {
							const resolved = await resolveSchema(peer, schemaCoId, {
								returnType: 'coId',
								timeoutMs,
							})
							if (resolved && typeof resolved === 'string' && resolved.startsWith('co_z')) {
								schemaCoId = resolved
							}
						} catch (_) {
							console.error(
								'[createUnifiedStore] Query schema must be co-id or resolve to co-id. Got:',
								schemaCoId,
							)
							continue
						}
						if (!schemaCoId.startsWith('co_z')) continue
					}
					if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
						if (filterChanged || !existingStore) {
							if (existingStore?._queryUnsubscribe) {
								existingStore._queryUnsubscribe()
							}
							await wireQueryStoreForSchema(
								peer,
								read,
								key,
								schemaCoId,
								evaluatedFilter,
								value,
								queryStores,
								queryDefinitions,
								queryIsFindOne,
								enqueueUpdate,
								options,
								timeoutMs,
							)
						}
					}
				} catch (_error) {
					if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_error)
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
			if (store._cacheKey && peer.subscriptionCache) {
				peer.subscriptionCache.scheduleCleanup(store._cacheKey)
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
 * Supports $path and $$path: both mean resolve from current item.
 * If item[rootProperty] is a co-id string, we must subscribe to it for reactivity.
 * @param {Object} rawData - Raw CoValue data (before map, may have co-id refs)
 * @param {Object} mapConfig - Map config e.g. { members: "$group.accountMembers", content: "$content" }
 * @returns {Set<string>} Co-ids that affect the mapped result
 */
function getMapDependencyCoIds(rawData, mapConfig) {
	if (!mapConfig || typeof mapConfig !== 'object' || !rawData || typeof rawData !== 'object') {
		return new Set()
	}
	const deps = new Set()
	for (const expression of Object.values(mapConfig)) {
		if (typeof expression !== 'string') continue
		// Skip wildcard
		if (expression === '*') continue
		const path = expression.startsWith('$$')
			? expression.substring(2)
			: expression.startsWith('$')
				? expression.substring(1)
				: null
		if (!path) continue // pass-through, no resolution dependency
		const rootProperty = path.split('.')[0]
		if (rootProperty && rootProperty in rawData) {
			const val = rawData[rootProperty]
			if (typeof val === 'string' && val.startsWith('co_z')) {
				deps.add(val)
			}
		}
	}
	return deps
}

/**
 * Process CoValue data: extract, resolve, and map
 * Helper function to avoid duplication and enable caching
 *
 * @param {Object} peer - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @param {string} [schemaHint] - Schema hint for special types
 * @param {Object} [options] - Options for processing
 * @param {Set<string>} [visited] - Visited set for circular reference detection
 * @returns {Promise<Object>} Processed CoValue data
 */
async function processCoValueData(peer, coValueCore, schemaHint, options, _visited = new Set()) {
	const { deepResolve = true, maxDepth = 15, timeoutMs = 5000, map = null } = options

	// Extract CoValue data as flat object
	let data = extractCoValueData(peer, coValueCore, schemaHint)

	// PROGRESSIVE DEEP RESOLUTION: Resolve nested references progressively (non-blocking)
	// Main CoValue is already available (required for processCoValueData to be called)
	// Nested CoValues will be resolved progressively if available, skipped if not ready yet
	if (deepResolve) {
		try {
			// Don't await - let deep resolution happen progressively in background
			// This prevents blocking on nested CoValues that need to sync from server
			deepResolveCoValue(peer, coValueCore.id, { deepResolve, maxDepth, timeoutMs }).catch((_err) => {
				// Silently handle errors - progressive resolution doesn't block on failures
			})
		} catch (_err) {
			// Silently continue - deep resolution failure shouldn't block display
		}
	}

	// Apply map transformation (if option enabled)
	if (map) {
		try {
			data = await applyMapTransform(peer, data, map, { timeoutMs })
		} catch (_err) {
			if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
			// Continue with unmapped data
		}
	}

	return data
}

/**
 * Read a single CoValue by ID
 *
 * @param {Object} peer - Backend instance
 * @param {string} coId - CoValue ID
 * @param {string} [schemaHint] - Schema hint for special types
 * @param {Object} [options] - Options for deep resolution
 * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data (with query objects merged if present)
 */
async function readSingleCoValue(peer, coId, schemaHint = null, options = {}) {
	const { deepResolve = true, maxDepth = 15, timeoutMs = 5000, map = null } = options

	// Check cache for resolved data before processing
	const cache = peer.subscriptionCache
	const cacheOptions = { deepResolve, map, maxDepth, timeoutMs }
	const cachedData = cache.getResolvedData(coId, cacheOptions)

	if (cachedData) {
		const hasQueryObjects =
			cachedData && typeof cachedData === 'object' && Object.values(cachedData).some(isQueryObject)
		const ctxStore = new ReactiveStore(cachedData)
		const coValueCore = peer.getCoValue(coId)
		if (coValueCore) {
			const processAndCacheCached = async (core) => {
				const newData = await processCoValueData(peer, core, schemaHint, options, new Set())
				cache.setResolvedData(coId, cacheOptions, newData)
				return newData
			}
			const cacheDepUnsubs = new Map()
			const setupMapDepSubs = (mainCore) => {
				if (!map) return
				const rawData = extractCoValueData(peer, mainCore, schemaHint)
				const newDeps = getMapDependencyCoIds(rawData, map)
				for (const depCoId of newDeps) {
					if (cacheDepUnsubs.has(depCoId)) continue
					const depCore = peer.getCoValue(depCoId)
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
			peer.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({
				unsubscribe: cacheCoUnsub,
			}))

			if (hasQueryObjects) {
				const unified = await createUnifiedStore(peer, ctxStore, options)
				const origUnsub = unified._unsubscribe
				unified._unsubscribe = () => {
					if (origUnsub) origUnsub()
					cacheCoUnsub()
					for (const unsub of cacheDepUnsubs.values()) unsub()
					cacheDepUnsubs.clear()
					peer.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
				}
				return unified
			}
			const origUnsub = ctxStore._unsubscribe
			ctxStore._unsubscribe = () => {
				if (origUnsub) origUnsub()
				cacheCoUnsub()
				for (const unsub of cacheDepUnsubs.values()) unsub()
				cacheDepUnsubs.clear()
				peer.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
			}
		}
		return hasQueryObjects ? await createUnifiedStore(peer, ctxStore, options) : ctxStore
	}

	const coValueCore = peer.getCoValue(coId)

	if (!coValueCore) {
		const errStore = new ReactiveStore({ error: 'CoValue not found', id: coId })
		return errStore
	}

	// Helper to process and cache CoValue data (fresh visited set per run for correct re-processing)
	const processAndCache = async (core) => {
		const processedData = await processCoValueData(peer, core, schemaHint, options, new Set())

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
		const rawData = extractCoValueData(peer, mainCore, schemaHint)
		const newDeps = getMapDependencyCoIds(rawData, map)
		for (const depCoId of newDeps) {
			if (depUnsubscribes.has(depCoId)) continue
			const depCore = peer.getCoValue(depCoId)
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
			data && typeof data === 'object' && Object.values(data).some(isQueryObject)
		if (hasQueryObjects) {
			if (!queryCtxStore) {
				queryCtxStore = new ReactiveStore(data)
				const unified = await createUnifiedStore(peer, queryCtxStore, options)
				unifiedPipeUnsub = unified.subscribe((v) => store._set(v))
				store._set(unified.value)
			} else {
				queryCtxStore._set(data)
			}
		} else {
			store._set(data)
		}
	})

	peer.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({
		unsubscribe: coUnsubscribe,
	}))

	if (coValueCore.isAvailable()) {
		const data = await processAndCache(coValueCore)
		setupMapDependencySubscriptions(coValueCore)
		const hasQueryObjects =
			data && typeof data === 'object' && Object.values(data).some(isQueryObject)
		if (hasQueryObjects) {
			store._set(data)
			const unified = await createUnifiedStore(peer, store, options)
			const origUnsub = unified._unsubscribe
			unified._unsubscribe = () => {
				if (origUnsub) origUnsub()
				coUnsubscribe()
				for (const unsub of depUnsubscribes.values()) unsub()
				depUnsubscribes.clear()
				peer.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
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
			peer.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
		}
		return store
	}

	store._set({ id: coId, loading: true })
	ensureCoValueLoaded(peer, coId)
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
		peer.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
	}
	return store
}

/**
 * Read sparks from account.registries.sparks CoMap.
 * Used when schema is spark schema - index colist only has user-created sparks.
 * @param {Object} peer - Backend instance
 * @param {Object} options - Read options
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of spark items {id, name, ...}
 */
async function readSparksFromAccount(peer, options = {}) {
	const { deepResolve = true, maxDepth = 15, timeoutMs = 5000 } = options
	const store = peer.subscriptionCache.getOrCreateStore(
		'sparks:account',
		() => new ReactiveStore([]),
	)

	const sparksId = await getSparksRegistryId(peer)
	if (!sparksId || !sparksId.startsWith('co_')) {
		return store
	}

	const updateSparks = async () => {
		const sparksStore = await readSingleCoValue(peer, sparksId, null, { deepResolve: false })
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
				const itemStore = await readSingleCoValue(peer, coId, null, {
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
	const sparksStore = await readSingleCoValue(peer, sparksId, null, { deepResolve: false })
	const unsub = sparksStore?.subscribe?.(() => updateSparks())
	if (unsub) {
		peer.subscriptionCache.getOrCreate(`subscription:sparks:${sparksId}`, () => ({
			unsubscribe: unsub,
		}))
	}
	return store
}

/**
 * Fallback when profile has no name: "Traveler " + short id
 */
function travelerFallback(accountCoId) {
	const shortId = typeof accountCoId === 'string' ? accountCoId.slice(-12) : ''
	return `Traveler ${shortId}`
}

/**
 * Read humans from account.registries.humans CoMap.
 * Used when schema is human schema - data from humans registry, not schema index.
 * @param {Object} peer - Backend instance
 * @param {Object} options - Read options
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of {id, accountId, registryName, profileName}
 */
async function readHumansFromRegistries(peer, options = {}) {
	const { timeoutMs = 5000 } = options
	const store = peer.subscriptionCache.getOrCreateStore(
		'humans:registries',
		() => new ReactiveStore([]),
	)

	const humansId = await getHumansRegistryId(peer)
	if (!humansId || !humansId.startsWith('co_')) {
		return store
	}

	const updateHumans = async () => {
		const humansStore = await readSingleCoValue(peer, humansId, null, { deepResolve: false })
		try {
			await waitForStoreReady(humansStore, humansId, timeoutMs)
		} catch {
			return
		}
		const humansData = humansStore?.value ?? {}
		if (humansData?.error) return

		// humans CoMap: keys = registry name or account co-id, values = human CoMap co-id (dual-key)
		// Dedupe by human co-id; find registry name (key that does NOT start with co_z)
		const humanCoIdToRegistryName = new Map()
		for (const k of Object.keys(humansData)) {
			if (k === 'id' || k === 'loading' || k === 'error' || k === '$schema' || k === 'type') continue
			const humanCoId = humansData[k]
			if (typeof humanCoId !== 'string' || !humanCoId.startsWith('co_')) continue
			const isRegistryName = !k.startsWith('co_z')
			// Prefer registry name (animal key); only set account id if no registry name exists
			if (isRegistryName) {
				humanCoIdToRegistryName.set(humanCoId, k)
			} else if (!humanCoIdToRegistryName.has(humanCoId)) {
				humanCoIdToRegistryName.set(humanCoId, k)
			}
		}

		const uniqueHumanCoIds = [...new Set(humanCoIdToRegistryName.keys())]
		const items = []

		for (const humanCoId of uniqueHumanCoIds) {
			const registryName = humanCoIdToRegistryName.get(humanCoId) ?? humanCoId
			try {
				const humanStore = await readSingleCoValue(peer, humanCoId, null, {
					deepResolve: false,
					timeoutMs,
				})
				await waitForStoreReady(humanStore, humanCoId, Math.min(timeoutMs, 2000))
				const humanData = humanStore?.value ?? {}
				if (humanData?.error) {
					items.push({
						id: humanCoId,
						accountId: humanCoId,
						registryName,
						profileName: travelerFallback(humanCoId),
					})
					continue
				}
				const accountId = humanData.account ?? humanCoId
				const profileCoId = humanData.profile

				let profileName = travelerFallback(accountId)
				if (profileCoId && typeof profileCoId === 'string' && profileCoId.startsWith('co_')) {
					try {
						const profileStore = await readSingleCoValue(peer, profileCoId, null, {
							deepResolve: false,
							timeoutMs: Math.min(timeoutMs, 2000),
						})
						await waitForStoreReady(profileStore, profileCoId, 2000)
						const profileData = profileStore?.value ?? {}
						const name = profileData?.name
						if (typeof name === 'string' && name.length > 0) {
							profileName = name
						}
					} catch {
						/* use fallback */
					}
				}

				items.push({
					id: humanCoId,
					accountId,
					registryName,
					profileName,
				})
			} catch {
				items.push({
					id: humanCoId,
					accountId: humanCoId,
					registryName,
					profileName: travelerFallback(humanCoId),
				})
			}
		}

		store._set(items)
	}

	await updateHumans()
	const humansStore = await readSingleCoValue(peer, humansId, null, { deepResolve: false })
	const unsub = humansStore?.subscribe?.(() => updateHumans())
	if (unsub) {
		peer.subscriptionCache.getOrCreate(`subscription:humans:${humansId}`, () => ({
			unsubscribe: unsub,
		}))
	}
	return store
}

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
		const dataKeys = Object.keys(itemData).filter((k) => !['id', 'type', '$schema'].includes(k))
		if (dataKeys.length === 0 && itemData.type === 'comap') continue

		if (matchesFilter(itemData, filter)) {
			return { ...itemData, id: itemId }
		}
	}
	return null
}

/**
 * Read a collection of CoValues by schema (CoList)
 *
 * Returns array of items from the CoList, with progressive loading.
 *
 * @param {Object} peer - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @param {Object} [filter] - Filter criteria
 * @param {Object} [options] - Options for deep resolution and transformations
 * @param {Object} [options.map] - Map config: { targetKey: "$sourcePath" } for on-demand ref resolution
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of CoValue data
 */
async function readCollection(peer, schema, filter = null, options = {}) {
	const { deepResolve = true, maxDepth = 15, timeoutMs = 5000, map = null } = options

	// Cache stores by schema+filter+options so multiple actors share same store
	const optionsKey = options?.map ? JSON.stringify({ map: options.map }) : ''
	const cacheKey = `${schema}:${JSON.stringify(filter || {})}:${optionsKey}`

	// Use unified cache for store caching
	const store = peer.subscriptionCache.getOrCreateStore(cacheKey, () => {
		const s = new ReactiveStore([])
		s._cacheKey = `store:${cacheKey}`
		return s
	})

	// Get schema index colist ID from spark.os.indexes (keyed by schema co-id)
	// Supports both schema co-ids (co_z...) and human-readable names (°Maia/schema/data/todos)
	const coListId = await getCoListId(peer, schema)
	if (!coListId) {
		return store
	}

	// Get CoList CoValueCore
	const coListCore = peer.getCoValue(coListId)
	if (!coListCore) {
		return store
	}

	// Track item IDs we've subscribed to (for cleanup)
	const subscribedItemIds = new Set()
	// Track resolved-ref subscription cache keys (ref CoValues like note.content)
	const subscribedResolvedRefKeys = new Set()

	// Shared visited set prevents duplicate work across updateStore calls
	const sharedVisited = new Set()

	// Cache for resolved+mapped item data (keyed by itemId)
	const cache = peer.subscriptionCache

	// Fix: Declare updateStore BEFORE any subscriptions to avoid temporal dead zone
	// updateStore is referenced in subscription callbacks (both colist and item subscriptions)
	// Initialize to no-op function to prevent temporal dead zone errors when subscriptions fire synchronously
	let updateStore = async () => {} // Will be reassigned below

	// Progressive loading: trigger load, return store, subscription updates when ready
	if (!peer.isAvailable(coListCore)) {
		// Trigger loading (non-blocking)
		ensureCoValueLoaded(peer, coListId, { waitForAvailable: false }).catch((_err) => {
			if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
		})

		// Set up subscription to update store when colist becomes available
		if (coListCore) {
			const unsubscribeColist = coListCore.subscribe((core) => {
				if (core && peer.isAvailable(core)) {
					// Colist is now available - trigger store update
					updateStore().catch((_err) => {
						if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
					})
				}
			})
			peer.subscriptionCache.getOrCreate(`subscription:${coListId}`, () => ({
				unsubscribe: unsubscribeColist,
			}))
		}

		// Return store immediately (empty array) - will update reactively when colist loads
		// This allows instant UI updates without waiting for index
		return store
	}

	// Subscribe to a resolved-reference CoValue (e.g. note.content = CoText).
	// When the ref changes, invalidate the parent item's cache so it re-resolves with fresh data.
	const subscribeToResolvedRef = (refCoId, parentItemId) => {
		if (!refCoId || typeof refCoId !== 'string' || !refCoId.startsWith('co_')) return
		const refKey = `subscription:ref:${refCoId}:${parentItemId}`
		if (subscribedResolvedRefKeys.has(refKey)) return
		subscribedResolvedRefKeys.add(refKey)

		const refCore = peer.getCoValue(refCoId)
		const setupSub = (core) => {
			if (!core) return
			const unsub = core.subscribe(() => {
				cache.invalidateResolvedData(parentItemId)
				if (updateStore) updateStore().catch((_e) => {})
			})
			peer.subscriptionCache.getOrCreate(refKey, () => ({ unsubscribe: unsub }))
		}
		if (refCore && peer.isAvailable(refCore)) {
			setupSub(refCore)
		} else {
			ensureCoValueLoaded(peer, refCoId, { waitForAvailable: true, timeoutMs: 2000 })
				.then(() => {
					const core = peer.getCoValue(refCoId)
					if (core && peer.isAvailable(core)) setupSub(core)
				})
				.catch(() => {})
		}
	}

	// Helper to subscribe to an item CoValue
	const subscribeToItem = (itemId) => {
		// Skip if already subscribed
		if (subscribedItemIds.has(itemId)) {
			return
		}

		subscribedItemIds.add(itemId)

		const itemCore = peer.getCoValue(itemId)
		if (!itemCore || !peer.isAvailable(itemCore)) {
			// Item not in memory or not available yet - trigger loading and wait for it to be available
			ensureCoValueLoaded(peer, itemId, { waitForAvailable: true, timeoutMs: 2000 })
				.then(() => {
					// Item is now loaded and available - set up subscription
					const loadedItemCore = peer.getCoValue(itemId)
					if (loadedItemCore && peer.isAvailable(loadedItemCore)) {
						// Subscribe to item changes (fires when item becomes available or updates)
						// Invalidate cache before processing for fresh data
						const unsubscribeItem = loadedItemCore.subscribe(() => {
							// Invalidate cache BEFORE processing - ensures getOrCreateResolvedData() processes fresh data
							cache.invalidateResolvedData(itemId)
							// Fire and forget - don't await async updateStore in subscription callback
							// Guard: Check if updateStore is defined (may not be initialized yet if subscription fires synchronously)
							if (updateStore) {
								updateStore().catch((_err) => {
									if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
								})
							}
						})

						// Use subscriptionCache for each item (same pattern for all CoValue references)
						peer.subscriptionCache.getOrCreate(`subscription:${itemId}`, () => ({
							unsubscribe: unsubscribeItem,
						}))

						// Trigger updateStore when item becomes available
						if (updateStore) {
							updateStore().catch((_err) => {
								if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
							})
						}
					}
				})
				.catch((_err) => {
					if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
				})
			return
		}

		// Subscribe to item changes (fires when item becomes available or updates)
		// Invalidate cache before processing for fresh data
		// The promise-based cache in getOrCreateResolvedData() will handle concurrent calls
		const unsubscribeItem = itemCore.subscribe(() => {
			// Invalidate cache BEFORE processing - ensures getOrCreateResolvedData() processes fresh data
			cache.invalidateResolvedData(itemId)
			// Fire and forget - don't await async updateStore in subscription callback
			// Guard: Check if updateStore is assigned before calling (prevents temporal dead zone error)
			if (updateStore) {
				updateStore().catch((_err) => {
					if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
				})
			}
		})

		// Use subscriptionCache for each item (same pattern for all CoValue references)
		peer.subscriptionCache.getOrCreate(`subscription:${itemId}`, () => ({
			unsubscribe: unsubscribeItem,
		}))
	}

	// Helper to update store with current items
	// Fix: Assign to pre-declared variable (declared above to avoid temporal dead zone)
	updateStore = async () => {
		const results = []

		// Get current CoList content (should be available now, but check anyway)
		if (!peer.isAvailable(coListCore)) {
			// CoList became unavailable - trigger reload
			ensureCoValueLoaded(peer, coListId).catch((_err) => {
				if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
			})
			return
		}

		const content = peer.getCurrentContent(coListCore)
		if (!content || !content.toJSON) {
			return
		}

		try {
			const itemIdsArray = content.toJSON() // Array of item co-ids

			// Deduplicate by co-id: schema index colist can contain same co-id twice (sync race)
			const seenIds = new Set()

			// Process each item ID
			let _availableCount = 0
			let _unavailableCount = 0

			for (const itemId of itemIdsArray) {
				if (typeof itemId !== 'string' || !itemId.startsWith('co_')) {
					continue
				}

				if (seenIds.has(itemId)) continue
				seenIds.add(itemId)

				// Subscribe to item (if not already subscribed) - this ensures reactive updates
				subscribeToItem(itemId)

				// Get item CoValueCore
				const itemCore = peer.getCoValue(itemId)
				if (!itemCore) {
					// Item not in memory - subscribeToItem already triggered loading
					_unavailableCount++
					continue
				}

				// Extract item if available (progressive loading - show available items immediately)
				if (peer.isAvailable(itemCore)) {
					_availableCount++

					// getOrCreateResolvedData prevents concurrent processing
					const itemCacheOptions = { deepResolve, map, maxDepth, timeoutMs }

					// Get fresh itemCore for latest data
					const currentItemCore = peer.getCoValue(itemId)
					if (!currentItemCore || !peer.isAvailable(currentItemCore)) {
						// Item no longer available - skip it (will be handled by subscription)
						continue
					}

					const itemData = await cache.getOrCreateResolvedData(itemId, itemCacheOptions, async () => {
						// Process and cache the item data using fresh CoValueCore reference
						let processedData = extractCoValueData(peer, currentItemCore)

						// Subscribe to refs that map depends on (map-driven resolution reactivity)
						if (map) {
							const deps = getMapDependencyCoIds(processedData, map)
							for (const coId of deps) {
								subscribeToResolvedRef(coId, itemId)
							}
						}

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
								await resolveNestedReferences(peer, processedData, sharedVisited, {
									maxDepth,
									timeoutMs,
									currentDepth: 0,
								})
							} catch (_err) {
								// Silently continue - deep resolution failure shouldn't block item display
							}
						}

						// Apply map transformation (if option enabled)
						// This transforms data using MaiaScript expressions (e.g., { sender: "$$source.role" })
						if (map) {
							try {
								processedData = await applyMapTransform(peer, processedData, map, { timeoutMs })
							} catch (_err) {
								if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
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
			if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_e)
		}

		// Update store with current results (progressive loading - may be partial, updates reactively)
		// Always update store (even empty) for reactivity
		store._set(results)
	}

	// Subscribe to CoList changes (fires when items are added/removed or CoList updates)
	const unsubscribeCoList = coListCore.subscribe(() => {
		// Fire and forget - don't await async updateStore in subscription callback
		updateStore().catch((_err) => {
			if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
		})
	})

	// Use subscriptionCache for CoList
	peer.subscriptionCache.getOrCreate(`subscription:${coListId}`, () => ({
		unsubscribe: unsubscribeCoList,
	}))

	// Trigger immediate load before initial updateStore
	// Read CoList content to get all item IDs
	if (peer.isAvailable(coListCore)) {
		const content = peer.getCurrentContent(coListCore)
		if (content?.toJSON) {
			try {
				const itemIdsArray = content.toJSON()
				// Trigger loading of all items immediately (don't wait - let them load in parallel)
				// This ensures items are available when updateStore() is called, reducing reactive pop-in
				for (const itemId of itemIdsArray) {
					if (typeof itemId === 'string' && itemId.startsWith('co_')) {
						const itemCore = peer.getCoValue(itemId)
						if (itemCore && !peer.isAvailable(itemCore)) {
							// Trigger loading immediately (don't wait - parallel loading)
							ensureCoValueLoaded(peer, itemId).catch((_err) => {
								if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
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
		peer.subscriptionCache.scheduleCleanup(`store:${cacheKey}`)
		if (originalUnsubscribe) originalUnsubscribe()
		peer.subscriptionCache.scheduleCleanup(`subscription:${coListId}`)
		for (const itemId of subscribedItemIds) {
			peer.subscriptionCache.scheduleCleanup(`subscription:${itemId}`)
		}
		for (const refKey of subscribedResolvedRefKeys) {
			peer.subscriptionCache.scheduleCleanup(refKey)
		}
	}

	return store
}

/**
 * Read all CoValues (no schema filter)
 *
 * Returns array of all CoValues in the node.
 *
 * @param {Object} peer - Backend instance
 * @param {Object} [filter] - Filter criteria
 * @param {Object} [options] - Options for deep resolution
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of all CoValue data
 */
async function readAllCoValues(peer, filter = null, options = {}) {
	const { deepResolve = true, maxDepth = 15, timeoutMs = 5000 } = options
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
		peer.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({ unsubscribe }))
	}

	// Helper to update store with all CoValues
	// Fix: Assign to pre-declared variable (declared above to avoid temporal dead zone)
	updateStore = async () => {
		const allCoValues = peer.getAllCoValues()
		const results = []

		for (const [coId, coValueCore] of allCoValues.entries()) {
			// Skip invalid IDs
			if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
				continue
			}

			// Subscribe to CoValue (if not already subscribed)
			subscribeToCoValue(coId, coValueCore)

			// Trigger loading for unavailable CoValues
			if (!peer.isAvailable(coValueCore)) {
				ensureCoValueLoaded(peer, coId).catch((_err) => {
					if (typeof process !== 'undefined' && process.env?.DEBUG) console.error(_err)
				})
				continue
			}

			// Extract CoValue data as flat object
			const data = extractCoValueData(peer, coValueCore)

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
					await resolveNestedReferencesPublic(peer, data, { maxDepth, timeoutMs })
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
			peer.subscriptionCache.scheduleCleanup(`subscription:${coId}`)
		}
	}

	return store
}
