import { perfDbRead } from '@MaiaOS/logs'
import { ReactiveStore } from '../../reactive-store.js'
import { observeCoValue } from '../cache/coCache.js'
import { ensureCoValueLoaded, getCoListId } from './collection-helpers.js'
import { extractCoValueData } from './data-extraction.js'
import { resolveNestedReferences } from './deep-resolution.js'
import { matchesFilter } from './filter-helpers.js'
import { applyMapTransform } from './map-transform.js'
import {
	debugLog,
	ensureDerivedLifecycle,
	getMapDependencyCoIds,
	log,
	setMaiaReadDerivedStoreLive,
} from './read-helpers.js'

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
export async function readCollection(peer, schema, filter = null, options = {}) {
	const { deepResolve = true, maxDepth = 15, timeoutMs = 5000, map = null } = options

	// Cache stores by schema+filter+options so multiple actors share same store
	const optionsKey = options?.map ? JSON.stringify({ map: options.map }) : ''
	const cacheKey = `${schema}:${JSON.stringify(filter || {})}:${optionsKey}`

	const store = peer.subscriptionCache.getOrCreateStore(cacheKey, () => {
		const s = new ReactiveStore([])
		s._cacheKey = `store:${cacheKey}`
		return s
	})

	const lc = ensureDerivedLifecycle(store)
	if (lc.live) {
		return store
	}

	// Get schema index colist ID from spark.os.indexes (keyed by schema co-id)
	const coListId = await getCoListId(peer, schema)
	if (typeof process !== 'undefined' && process.env?.DEBUG)
		log.debug('[DEBUG readCollection] schema=', schema, 'coListId=', coListId)
	if (!coListId) {
		return store
	}

	const coListCore = peer.getCoValue(coListId)
	if (!coListCore) {
		return store
	}

	const subscribedItemIds = lc.collectionSubscribedItemIds
	const subscribedResolvedRefKeys = lc.collectionSubscribedResolvedRefKeys
	const sharedVisited = lc.collectionSharedVisited

	const cache = peer.subscriptionCache

	let updateStore = async () => {}

	const runState = lc.runState

	// Subscribe to a resolved-reference CoValue (e.g. note.content = CoText).
	// When the ref changes, invalidate the parent item's cache so it re-resolves with fresh data.
	const subscribeToResolvedRef = (refCoId, parentItemId) => {
		if (!refCoId || typeof refCoId !== 'string' || !refCoId.startsWith('co_')) return
		const refKey = `subscription:ref:${refCoId}:${parentItemId}`
		if (subscribedResolvedRefKeys.has(refKey)) return
		subscribedResolvedRefKeys.add(refKey)

		const setupSub = () => {
			const unsub = observeCoValue(peer, refCoId).subscribe(() => {
				cache.invalidateResolvedData(parentItemId)
				if (updateStore) updateStore().catch((_e) => {})
			})
			peer.subscriptionCache.getOrCreate(refKey, () => ({ unsubscribe: unsub }))
		}
		const refCore = peer.getCoValue(refCoId)
		if (refCore && peer.isAvailable(refCore)) {
			setupSub()
		} else {
			ensureCoValueLoaded(peer, refCoId, { waitForAvailable: true, timeoutMs: 2000 })
				.then(() => {
					if (peer.getCoValue(refCoId)) setupSub()
				})
				.catch(() => {})
		}
	}

	const onItemChange = (id) => {
		cache.invalidateResolvedData(id)
		if (updateStore) updateStore().catch(debugLog)
	}
	const wireItemSubscription = (core, id) => {
		if (!core || !peer.isAvailable(core)) return
		observeCoValue(peer, id).subscribe(() => onItemChange(id))
		if (updateStore) updateStore().catch(debugLog)
	}
	const subscribeToItem = (itemId) => {
		if (subscribedItemIds.has(itemId)) return
		subscribedItemIds.add(itemId)
		const itemCore = peer.getCoValue(itemId)
		if (!itemCore || !peer.isAvailable(itemCore)) {
			ensureCoValueLoaded(peer, itemId, { waitForAvailable: true, timeoutMs: 2000 })
				.then(() => wireItemSubscription(peer.getCoValue(itemId), itemId))
				.catch(debugLog)
			return
		}
		wireItemSubscription(itemCore, itemId)
	}

	const runUpdateStore = async () => {
		perfDbRead.start(`updateStore schema=${schema}`)
		let resultCount = 0
		try {
			const results = []

			if (!peer.isAvailable(coListCore)) {
				ensureCoValueLoaded(peer, coListId).catch(debugLog)
				store._set(Array.isArray(store.value) ? store.value : [])
				return
			}

			const content = peer.getCurrentContent(coListCore)
			if (!content?.toJSON) {
				store._set(Array.isArray(store.value) ? store.value : [])
				return
			}

			try {
				const itemIdsArray = content.toJSON()
				const seenIds = new Set()

				for (const itemId of itemIdsArray) {
					if (typeof itemId !== 'string' || !itemId.startsWith('co_')) {
						continue
					}

					if (seenIds.has(itemId)) continue
					seenIds.add(itemId)

					subscribeToItem(itemId)

					const itemCore = peer.getCoValue(itemId)
					if (!itemCore) {
						continue
					}

					if (peer.isAvailable(itemCore)) {
						const itemCacheOptions = { deepResolve, map, maxDepth, timeoutMs }

						const currentItemCore = peer.getCoValue(itemId)
						if (!currentItemCore || !peer.isAvailable(currentItemCore)) {
							continue
						}

						const itemData = await cache.getOrCreateResolvedData(itemId, itemCacheOptions, async () => {
							let processedData = extractCoValueData(peer, currentItemCore)

							if (map) {
								const deps = getMapDependencyCoIds(processedData, map)
								for (const coId of deps) {
									subscribeToResolvedRef(coId, itemId)
								}
							}

							const dataKeys = Object.keys(processedData).filter(
								(key) => !['id', 'type', '$factory'].includes(key),
							)
							if (dataKeys.length === 0 && processedData.type === 'comap') {
								return processedData
							}

							if (deepResolve && !map && !cache.isResolved(itemId)) {
								try {
									await resolveNestedReferences(peer, processedData, sharedVisited, {
										maxDepth,
										timeoutMs,
										currentDepth: 0,
									})
								} catch (_err) {
									/* continue with partial data */
								}
							}

							if (map) {
								try {
									processedData = await applyMapTransform(peer, processedData, map, {
										timeoutMs,
									})
								} catch (_err) {
									debugLog(_err)
								}
							}

							return processedData
						})

						const dataKeys = Object.keys(itemData).filter(
							(key) => !['id', 'type', '$factory'].includes(key),
						)
						if (dataKeys.length === 0 && itemData.type === 'comap') {
							continue
						}

						if (!filter || matchesFilter(itemData, filter)) {
							results.push(itemData)
						}
					}
				}
			} catch (_e) {
				debugLog(_e)
			}

			store._set(results)
			resultCount = results.length
		} finally {
			perfDbRead.end(`updateStore results=${resultCount}`)
		}
	}

	updateStore = async () => {
		if (runState.running) {
			runState.queued = true
			return
		}
		runState.running = true
		try {
			await runUpdateStore()
		} finally {
			runState.running = false
			if (runState.queued) {
				runState.queued = false
				queueMicrotask(() => updateStore().catch(debugLog))
			}
		}
	}

	// Single colist subscription: shared observer hub fans out to updateStore.
	observeCoValue(peer, coListId).subscribe(() => {
		updateStore().catch(debugLog)
	})

	// Progressive loading: trigger load; runUpdateStore guards unavailable / no content
	if (!peer.isAvailable(coListCore)) {
		ensureCoValueLoaded(peer, coListId, { waitForAvailable: false }).catch(debugLog)
		return store
	}

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
							ensureCoValueLoaded(peer, itemId).catch(debugLog)
						}
					}
				}
			} catch (_e) {
				// Ignore errors - will be handled in updateStore()
			}
		}
	}

	// Initial load (progressive - shows available items immediately, sets up subscriptions for all items)
	await updateStore()

	if (!lc.unsubscribeHooked) {
		lc.unsubscribeHooked = true
		const previousUnsubscribe = store._unsubscribe
		store._unsubscribe = () => {
			lc.live = false
			lc.unsubscribeHooked = false
			setMaiaReadDerivedStoreLive(store, false)
			peer.subscriptionCache.scheduleCleanup(`store:${cacheKey}`)
			if (previousUnsubscribe) previousUnsubscribe()
			peer.subscriptionCache.scheduleCleanup(`observer:${coListId}`)
			for (const itemId of subscribedItemIds) {
				peer.subscriptionCache.scheduleCleanup(`observer:${itemId}`)
			}
			for (const refKey of subscribedResolvedRefKeys) {
				peer.subscriptionCache.scheduleCleanup(refKey)
			}
		}
	}

	setMaiaReadDerivedStoreLive(store, true)
	return store
}
