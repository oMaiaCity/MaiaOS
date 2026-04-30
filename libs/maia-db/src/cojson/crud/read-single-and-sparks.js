import { ReactiveStore } from '../../reactive-store.js'
import { observeCoValue } from '../cache/coCache.js'
import { getSparksRegistryId } from '../groups/groups.js'
import { ensureCoValueLoaded } from './collection-helpers.js'
import { extractCoValueData } from './data-extraction.js'
import { deepResolveCoValue } from './deep-resolution.js'
import { applyMapTransform } from './map-transform.js'
import {
	debugLog,
	ensureDerivedLifecycle,
	getMapDependencyCoIds,
	isQueryObject,
	makeSingleCoCleanup,
} from './read-helpers.js'
import { waitForStoreReady } from './read-operations.js'
import { createUnifiedStore } from './read-unified.js'

/**
 * Process CoValue data: extract, resolve, and map
 * Helper function to avoid duplication and enable caching
 *
 * @param {Object} peer - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @param {string} [schemaHint] - Schema hint for special types
 * @param {Object} [options] - Options for processing
 * @returns {Promise<Object>} Processed CoValue data
 */
async function processCoValueData(peer, coValueCore, schemaHint, options) {
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
			debugLog(_err)
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
 * @param {Object} [options] - Options for deep resolution; must include universalRead when queries are present
 * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data (with query objects merged if present)
 */
export async function readSingleCoValue(peer, coId, schemaHint = null, options = {}) {
	if (typeof options.universalRead !== 'function') {
		throw new Error('[read] universalRead required in options for readSingleCoValue')
	}

	const { deepResolve = true, maxDepth = 15, timeoutMs = 5000, map = null } = options

	const cache = peer.subscriptionCache
	const cacheOptions = { deepResolve, map, maxDepth, timeoutMs }

	// Return cached store if one already exists for this co-id + options
	const storeCacheKey = `readStore:${coId}:${JSON.stringify(cacheOptions)}`
	const cachedStoreEntry = cache.get(storeCacheKey)
	if (cachedStoreEntry) {
		if (cachedStoreEntry._maiaReadReactiveDead === true) {
			cache.evict(storeCacheKey)
		} else {
			return cachedStoreEntry
		}
	}

	const cachedData = cache.getResolvedData(coId, cacheOptions)

	if (cachedData) {
		const hasQueryObjects =
			cachedData && typeof cachedData === 'object' && Object.values(cachedData).some(isQueryObject)
		const ctxStore = new ReactiveStore(cachedData)
		const coValueCore = peer.getCoValue(coId)
		if (coValueCore) {
			const processAndCacheCached = async (core) => {
				const newData = await processCoValueData(peer, core, schemaHint, options)
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
					const unsub = observeCoValue(peer, depCoId).subscribe(async () => {
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
			setupMapDepSubs(coValueCore)
			const cacheCoUnsub = observeCoValue(peer, coId).subscribe(async (core) => {
				if (core.isAvailable()) {
					const newData = await processAndCacheCached(core)
					setupMapDepSubs(core)
					ctxStore._set(newData)
				}
			})

			if (hasQueryObjects) {
				const unified = await createUnifiedStore(peer, ctxStore, options)
				unified._unsubscribe = makeSingleCoCleanup(
					peer,
					coId,
					cacheCoUnsub,
					cacheDepUnsubs,
					unified._unsubscribe,
					null,
					storeCacheKey,
					unified,
				)
				cache.set(storeCacheKey, unified)
				return unified
			}
			ctxStore._unsubscribe = makeSingleCoCleanup(
				peer,
				coId,
				cacheCoUnsub,
				cacheDepUnsubs,
				ctxStore._unsubscribe,
				null,
				storeCacheKey,
				ctxStore,
			)
		}
		cache.set(storeCacheKey, ctxStore)
		return ctxStore
	}

	const coValueCore = peer.getCoValue(coId)

	if (!coValueCore) {
		const errStore = new ReactiveStore({ error: 'CoValue not found', id: coId })
		return errStore
	}

	// Helper to process and cache CoValue data (fresh visited set per run for correct re-processing)
	const processAndCache = async (core) => {
		const processedData = await processCoValueData(peer, core, schemaHint, options)

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
			const unsub = observeCoValue(peer, depCoId).subscribe(async () => {
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

	const coUnsubscribe = observeCoValue(peer, coId).subscribe(async (core) => {
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
				// Caller still holds `store` (CoValue was not available on first read); mirror unified into it.
				unifiedPipeUnsub = unified.subscribe((v) => store._set(v))
			} else {
				queryCtxStore._set(data)
			}
		} else {
			store._set(data)
		}
	})

	if (coValueCore.isAvailable()) {
		const data = await processAndCache(coValueCore)
		setupMapDependencySubscriptions(coValueCore)
		const hasQueryObjects =
			data && typeof data === 'object' && Object.values(data).some(isQueryObject)
		if (hasQueryObjects) {
			queryCtxStore = new ReactiveStore(data)
			const unified = await createUnifiedStore(peer, queryCtxStore, options)
			unified._unsubscribe = makeSingleCoCleanup(
				peer,
				coId,
				coUnsubscribe,
				depUnsubscribes,
				unified._unsubscribe,
				null,
				storeCacheKey,
				unified,
			)
			cache.set(storeCacheKey, unified)
			return unified
		}
		store._set(data)
		store._unsubscribe = makeSingleCoCleanup(
			peer,
			coId,
			coUnsubscribe,
			depUnsubscribes,
			store._unsubscribe,
			null,
			storeCacheKey,
			store,
		)
		cache.set(storeCacheKey, store)
		return store
	}

	store._set({ id: coId, loading: true })
	ensureCoValueLoaded(peer, coId)
		.then(() => {})
		.catch((err) => {
			store._set({ error: err.message, id: coId })
		})

	store._unsubscribe = makeSingleCoCleanup(
		peer,
		coId,
		coUnsubscribe,
		depUnsubscribes,
		store._unsubscribe,
		() => {
			if (unifiedPipeUnsub) {
				unifiedPipeUnsub()
				unifiedPipeUnsub = null
			}
		},
		storeCacheKey,
		store,
	)
	cache.set(storeCacheKey, store)
	return store
}

/**
 * Read sparks from account.sparks CoMap.
 * Used when schema is spark schema - index colist only has user-created sparks.
 * @param {Object} peer - Backend instance
 * @param {Object} options - Read options (must include universalRead)
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of spark items {id, name, ...}
 */
export async function readSparksFromAccount(peer, options = {}) {
	if (typeof options.universalRead !== 'function') {
		throw new Error('[read] universalRead required in options for readSparksFromAccount')
	}

	const { deepResolve = true, maxDepth = 15, timeoutMs = 5000 } = options
	const store = peer.subscriptionCache.getOrCreateStore('sparks:account', () => {
		const s = new ReactiveStore([])
		s._cacheKey = 'store:sparks:account'
		return s
	})

	const sparksLc = ensureDerivedLifecycle(store)
	if (sparksLc.registryReaderWired) {
		return store
	}

	const sparksId = await getSparksRegistryId(peer)
	if (!sparksId?.startsWith('co_')) {
		return store
	}

	const updateSparks = async () => {
		const sparksStore = await readSingleCoValue(peer, sparksId, null, {
			deepResolve: false,
			universalRead: options.universalRead,
		})
		try {
			await waitForStoreReady(sparksStore, sparksId, timeoutMs)
		} catch {
			return
		}
		const sparksData = sparksStore?.value ?? {}
		if (sparksData?.error) return

		const sparkCoIds = []
		for (const k of Object.keys(sparksData)) {
			if (k === 'id' || k === 'loading' || k === 'error' || k === '$factory' || k === 'type') continue
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
					universalRead: options.universalRead,
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
	const sparksStore = await readSingleCoValue(peer, sparksId, null, {
		deepResolve: false,
		universalRead: options.universalRead,
	})
	const unsub = sparksStore?.subscribe?.(() => updateSparks())
	if (unsub) {
		peer.subscriptionCache.getOrCreate(`subscription:sparks:${sparksId}`, () => ({
			unsubscribe: unsub,
		}))
	}
	sparksLc.registryReaderWired = true
	return store
}
