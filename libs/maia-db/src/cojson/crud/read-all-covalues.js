import { ReactiveStore } from '../../reactive-store.js'
import { observeCoValue } from '../cache/coCache.js'
import { ensureCoValueLoaded } from './collection-helpers.js'
import { extractCoValueData } from './data-extraction.js'
import { resolveNestedReferencesPublic } from './deep-resolution.js'
import { matchesFilter } from './filter-helpers.js'
import { debugLog, ensureDerivedLifecycle, setMaiaReadDerivedStoreLive } from './read-helpers.js'

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
export async function readAllCoValues(peer, filter = null, options = {}) {
	const { deepResolve = true, maxDepth = 15, timeoutMs = 5000 } = options
	const cacheKey = `allCoValues:${JSON.stringify(filter || {})}:${deepResolve}:${maxDepth}:${timeoutMs}`

	const store = peer.subscriptionCache.getOrCreateStore(cacheKey, () => {
		const s = new ReactiveStore([])
		s._cacheKey = `store:${cacheKey}`
		return s
	})

	const allLc = ensureDerivedLifecycle(store)
	if (allLc.live) {
		return store
	}

	const subscribedCoIds = allLc.allCoValuesSubscribedIds

	const runState = allLc.runState

	let updateStore = async () => {}

	const subscribeToCoValue = (coId) => {
		if (subscribedCoIds.has(coId)) {
			return
		}

		subscribedCoIds.add(coId)

		observeCoValue(peer, coId).subscribe(() => {
			updateStore()
		})
	}

	const runUpdateStore = async () => {
		const allCoValues = peer.getAllCoValues()
		const results = []

		for (const [coId, coValueCore] of allCoValues.entries()) {
			if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
				continue
			}

			subscribeToCoValue(coId)

			if (!peer.isAvailable(coValueCore)) {
				ensureCoValueLoaded(peer, coId).catch(debugLog)
				continue
			}

			const data = extractCoValueData(peer, coValueCore)

			const dataKeys = Object.keys(data).filter((key) => !['id', 'type', '$factory'].includes(key))
			if (dataKeys.length === 0 && data.type === 'comap') {
				continue
			}

			if (deepResolve) {
				try {
					await resolveNestedReferencesPublic(peer, data, { maxDepth, timeoutMs })
				} catch (_err) {
					/* continue with partial data */
				}
			}

			if (!filter || matchesFilter(data, filter)) {
				results.push(data)
			}
		}

		store._set(results)
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

	await updateStore()

	if (!allLc.unsubscribeHooked) {
		allLc.unsubscribeHooked = true
		const previousUnsubscribe = store._unsubscribe
		store._unsubscribe = () => {
			allLc.live = false
			allLc.unsubscribeHooked = false
			setMaiaReadDerivedStoreLive(store, false)
			if (previousUnsubscribe) previousUnsubscribe()
			for (const coId of subscribedCoIds) {
				peer.subscriptionCache.scheduleCleanup(`observer:${coId}`)
			}
		}
	}

	setMaiaReadDerivedStoreLive(store, true)
	return store
}
