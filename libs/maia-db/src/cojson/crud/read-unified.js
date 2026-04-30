import { resolveExpressions } from '@MaiaOS/validation/expression-resolver.js'
import { ReactiveStore } from '../../reactive-store.js'
import {
	debugLog,
	getQueryFilterFromValue,
	getQueryMapFromValue,
	isFindOneFilter,
	isQueryObject,
	log,
	resolveSchemaLazy,
} from './read-helpers.js'

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
	const queryMap = getQueryMapFromValue(value)
	const queryOptions = { ...options, timeoutMs, ...(queryMap ? { map: queryMap } : {}) }
	const queryStore =
		isFindOne && singleCoId
			? await readFn(peer, singleCoId, resolvedSchemaCoId, null, null, queryOptions)
			: await readFn(peer, null, resolvedSchemaCoId, evaluatedFilter, null, queryOptions)

	queryIsFindOne.set(key, isFindOne)
	queryDefinitions.set(key, {
		factory: value.factory,
		filter: evaluatedFilter,
		...(queryMap ? { map: queryMap } : {}),
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
	return resolveExpressions(filter, evaluator, { context: contextValue, item: {} })
}

/**
 * Create unified store that merges context value with query results.
 * @param {Object} peer - Backend instance
 * @param {ReactiveStore} contextStore - Context CoValue ReactiveStore
 * @param {Object} options - Options for query resolution; must include universalRead (same contract as read())
 */
export async function createUnifiedStore(peer, contextStore, options = {}) {
	const universalRead = options.universalRead
	if (typeof universalRead !== 'function') {
		throw new Error('[read] universalRead required for createUnifiedStore')
	}

	const unifiedStore = new ReactiveStore({})
	let unifiedInnerTeardownDone = false
	const queryStores = new Map() // key -> ReactiveStore
	const queryDefinitions = new Map() // key -> query definition object (for $op) - stores evaluated filters
	const queryIsFindOne = new Map() // key -> boolean (true if query should return single object instead of array)
	/** Last merged query result per key (survives transient gaps while a query rebinds). */
	const lastCommittedQueryMerge = new Map()
	const { timeoutMs = 5000 } = options

	// Evaluator injected at boot (avoids maia-db → maia-runtime dependency)
	const evaluator = peer.evaluator
	if (!evaluator) {
		throw new Error(
			'[read] Evaluator required for reactive resolution. Inject via DataEngine options at boot.',
		)
	}

	// Update Queue: batches all updates within a single event loop tick
	// Prevents duplicate renders when multiple query stores update simultaneously
	let queueTimer = null

	const flushUpdate = () => {
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
					// Set even empty arrays so reactivity works (guard against null/undefined)
					mergedValue[key] = Array.isArray(storeValue) ? storeValue : []
					// Derived: has{Key} = array has items (e.g. conversations -> hasConversations)
					const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`
					if (hasKey in contextValue) {
						mergedValue[hasKey] = Array.isArray(storeValue) && storeValue.length > 0
					}
				}
				lastCommittedQueryMerge.set(key, mergedValue[key])
			}
		}

		// ${key}Loading: paired with ViewEngine shouldShowQueryLoadingSkeleton (libs/maia-runtime/src/utils/query-loading.js)
		for (const key of queryStores.keys()) {
			mergedValue[`${key}Loading`] = false
		}

		// Query still in context but not yet wired (e.g. mid single-flight resolve): keep last committed value, not transient []
		for (const [key, value] of Object.entries(contextValue || {})) {
			if (key !== '$factory' && key !== '$id' && isQueryObject(value) && !queryStores.has(key)) {
				delete mergedValue[key]
				const prev = lastCommittedQueryMerge.get(key)
				if (prev !== undefined) {
					mergedValue[key] = prev
					mergedValue[`${key}Loading`] = true
					const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`
					if (hasKey in contextValue) {
						mergedValue[hasKey] = Array.isArray(prev) ? prev.length > 0 : prev != null
					}
				} else {
					mergedValue[key] = []
					mergedValue[`${key}Loading`] = true
					const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`
					if (hasKey in contextValue) {
						mergedValue[hasKey] = false
					}
				}
			}
		}

		// Always _set: JSON.stringify dedup caused false negatives (list updates skipped until a later event).
		unifiedStore._set(mergedValue)
	}

	const enqueueUpdate = () => {
		// Schedule batch processing if not already scheduled
		// Batch updates: one microtask per tick
		if (!queueTimer) {
			queueTimer = queueMicrotask(() => {
				queueTimer = null
				flushUpdate()
			})
		}
	}

	// Single-flight: exactly one runResolveQueriesImpl at a time via a promise chain.
	// Never call runResolveQueriesImpl outside this chain — a direct await + subscribe's
	// immediate callback would run two legs in parallel and corrupt queryStores.
	let resolveChain = Promise.resolve()

	const scheduleResolve = (snapshotOverride) => {
		const run = async () => {
			const snapshot = snapshotOverride !== undefined ? snapshotOverride : contextStore.value || {}
			await runResolveQueriesImpl(snapshot)
		}
		resolveChain = resolveChain.then(run).catch((e) => {
			debugLog(e)
		})
		return resolveChain
	}

	// Helper to resolve and subscribe to query objects (full context snapshot only)
	const runResolveQueriesImpl = async (contextValue) => {
		if (!contextValue || typeof contextValue !== 'object' || Array.isArray(contextValue)) {
			enqueueUpdate()
			return
		}

		const currentQueryKeys = new Set()

		// Pre-pass: resolve @scope to inject accountId/profileId for filter evaluation
		const scopeInject = {}
		for (const [key, value] of Object.entries(contextValue || {})) {
			if (isQueryObject(value) && value.factory === '@scope' && peer.account) {
				scopeInject[key] = {
					accountId: peer.account.id,
					profileId: peer.account.get?.('profile') ?? null,
				}
				currentQueryKeys.add(key)
				const scopeStore = new ReactiveStore(scopeInject[key])
				queryStores.set(key, scopeStore)
				queryDefinitions.set(key, { factory: '@scope', filter: null })
				queryIsFindOne.set(key, true)
			}
		}
		const contextWithScope = { ...contextValue, ...scopeInject }

		// Detect and resolve query objects
		for (const [key, value] of Object.entries(contextValue)) {
			// Skip special fields and schema definition properties (not queries)
			// Schema definition properties like 'properties', '$defs' are part of schema structure, not queries
			// Note: 'items' is a valid context query key (e.g. grid items); only skip if not a query object
			if (
				key === '$factory' ||
				key === '$id' ||
				key === '@stores' ||
				key === 'properties' ||
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

				// @scope already handled in pre-pass
				if (value.factory === '@scope') continue

				const evaluatedFilter = await evaluateFilter(
					getQueryFilterFromValue(value),
					contextWithScope,
					evaluator,
				)

				// Re-read after await: another resolve leg must not skip wiring with a stale "existing" ref
				const existingStore = queryStores.get(key)

				// Get stored query definition to compare filters
				const storedQueryDef = queryDefinitions.get(key)
				const storedFilter = storedQueryDef?.filter || null

				// Compare evaluated filters to detect changes (deep comparison)
				const filterChanged = JSON.stringify(evaluatedFilter) !== JSON.stringify(storedFilter)

				try {
					// UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema resolution for queries
					let factoryCoId = value.factory

					// Ensure factoryCoId is a string (might be an object if deep resolution happened)
					if (factoryCoId && typeof factoryCoId === 'object' && factoryCoId.$id) {
						// Schema was resolved to an object - use its $id
						factoryCoId = factoryCoId.$id
					}

					// Validate factoryCoId is a string
					if (typeof factoryCoId !== 'string') {
						debugLog('Invalid factoryCoId:', factoryCoId)
						continue
					}

					// Runtime: resolve human-readable schema refs to co-id (seed should transform; resolve handles edge cases)
					if (!factoryCoId.startsWith('co_z')) {
						try {
							const resolved = await resolveSchemaLazy(peer, factoryCoId, {
								returnType: 'coId',
								timeoutMs,
							})
							if (resolved && typeof resolved === 'string' && resolved.startsWith('co_z')) {
								factoryCoId = resolved
							}
						} catch (_) {
							log.error(
								'[createUnifiedStore] Query schema must be co-id or resolve to co-id. Got:',
								factoryCoId,
							)
							continue
						}
						if (!factoryCoId.startsWith('co_z')) continue
					}
					if (factoryCoId && typeof factoryCoId === 'string' && factoryCoId.startsWith('co_z')) {
						if (filterChanged || !existingStore) {
							if (existingStore?._queryUnsubscribe) {
								existingStore._queryUnsubscribe()
							}
							await wireQueryStoreForSchema(
								peer,
								universalRead,
								key,
								factoryCoId,
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
					debugLog(_error)
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
				lastCommittedQueryMerge.delete(key)
			}
		}

		// Enqueue update after resolving all queries
		// This ensures unified store reflects current query state
		enqueueUpdate()
	}

	// skipInitial: initial load uses await scheduleResolve() below (one leg, not subscribe + await).
	const contextUnsubscribe = contextStore.subscribe(
		() => {
			void scheduleResolve()
		},
		{ skipInitial: true },
	)

	// Set up cleanup
	const originalUnsubscribe = unifiedStore._unsubscribe
	unifiedStore._unsubscribe = () => {
		if (unifiedInnerTeardownDone) return
		unifiedInnerTeardownDone = true
		if (originalUnsubscribe) originalUnsubscribe()
		contextUnsubscribe()
		resolveChain = Promise.resolve()
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
		lastCommittedQueryMerge.clear()
	}

	// Optional: merge overrides with current context for one scheduled leg (same chain as subscribe).
	unifiedStore._resolveQueries = (overrides) => {
		const merged =
			overrides !== undefined && overrides !== null
				? { ...(contextStore.value || {}), ...overrides }
				: undefined
		return scheduleResolve(merged)
	}

	// Initial resolve: sole first leg (subscribe skipped initial — no parallel duplicate).
	await scheduleResolve()
	// Sync flush so unified.value is correct before return (actors render before microtask runs)
	flushUpdate()

	return unifiedStore
}
