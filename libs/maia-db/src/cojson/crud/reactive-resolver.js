/**
 * Universal Reactive Dependency Resolver
 *
 * Provides reactive resolution for all dependency types (factories, queries, configs, nested CoValues).
 * Returns ReactiveStore instances that automatically update when dependencies become available.
 *
 * Key Principles:
 * - No blocking waits - everything is reactive
 * - Progressive by default - dependencies resolve as they become available
 * - Subscription-based - uses CoValue subscriptions to detect when dependencies become available
 * - Automatic updates - reactive stores automatically update when dependencies resolve
 * - Universal - works for any dependency type (factories, queries, configs, nested CoValues)
 */

import { ReactiveStore } from '../../reactive-store.js'
import { observeCoValue } from '../cache/coCache.js'
import { resolve } from '../factory/resolver.js'
import { ensureCoValueLoaded } from './collection-helpers.js'
import { read as universalRead } from './read.js'

export { waitForReactiveResolution } from './read-operations.js'

/**
 * Resolve factory reactively - returns ReactiveStore that updates when factory becomes available
 *
 * @param {Object} peer - Backend instance
 * @param {string} factoryKey - Factory key (°Maia/factory/data/todos) or co-id (co_z...)
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutMs=10000] - Timeout for waiting (unused in reactive mode, kept for compatibility)
 * @returns {ReactiveStore} ReactiveStore that updates when factory resolves:
 *   - Initial: { loading: true }
 *   - When resolved: { loading: false, factoryCoId: 'co_z...' }
 */
export function resolveFactoryReactive(peer, factoryKey, options = {}) {
	const { timeoutMs = 10000 } = options
	const store = new ReactiveStore({ loading: true })

	// If it's already a co-id, return immediately
	if (factoryKey.startsWith('co_z')) {
		store._set({ loading: false, factoryCoId: factoryKey })
		return store
	}

	// Track subscriptions for cleanup
	let osUnsubscribe = null
	let factoriesUnsubscribe = null

	// Set up reactive subscription to spark.os.factories for progressive resolution (account.registries.sparks[°Maia].os.factories)
	const setupReactiveSubscription = async () => {
		const { getSparkOsId } = await import('../groups/groups.js')
		const spark = peer?.systemSpark ?? '°Maia'
		const osId = await getSparkOsId(peer, spark)
		if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
			store._set({ loading: false, error: 'spark.os not found' })
			return
		}

		// Load spark.os store reactively
		const osStore = await universalRead(peer, osId, null, null, null, {
			deepResolve: false,
			timeoutMs,
		})

		// Subscribe to osStore updates
		osUnsubscribe = osStore.subscribe(async (osData) => {
			if (!osData || osData.error) {
				return // Still loading or error
			}

			// Check if factories registry is available
			const factoriesId = osData.factories
			if (!factoriesId || typeof factoriesId !== 'string' || !factoriesId.startsWith('co_z')) {
				return // factories registry not available yet
			}

			// Load factories store reactively (only if not already subscribed)
			if (!factoriesUnsubscribe) {
				const factoriesStore = await universalRead(peer, factoriesId, null, null, null, {
					deepResolve: false,
					timeoutMs,
				})

				// Subscribe to factoriesStore updates
				factoriesUnsubscribe = factoriesStore.subscribe((factoriesData) => {
					if (!factoriesData || factoriesData.error) {
						return // Still loading or error
					}

					// Check if factory is in registry
					const normalizedKey = factoryKey.startsWith('°Maia/factory/')
						? factoryKey
						: `°Maia/factory/${factoryKey}`
					const registryCoId = factoriesData[normalizedKey] || factoriesData[factoryKey]

					if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
						// Factory found - update store
						store._set({ loading: false, factoryCoId: registryCoId })
						if (factoriesUnsubscribe) {
							factoriesUnsubscribe()
							factoriesUnsubscribe = null
						}
						if (osUnsubscribe) {
							osUnsubscribe()
							osUnsubscribe = null
						}
					}
				})
			}
		})

		// Cleanup on store unsubscribe
		const originalUnsubscribe = store._unsubscribe
		store._unsubscribe = () => {
			if (originalUnsubscribe) originalUnsubscribe()
			if (factoriesUnsubscribe) {
				factoriesUnsubscribe()
				factoriesUnsubscribe = null
			}
			if (osUnsubscribe) {
				osUnsubscribe()
				osUnsubscribe = null
			}
		}
	}

	// Try to resolve factory immediately (non-blocking check)
	resolve(peer, factoryKey, { returnType: 'coId', timeoutMs: 2000 })
		.then((factoryCoId) => {
			if (factoryCoId?.startsWith('co_z')) {
				// Schema resolved immediately - update store
				store._set({ loading: false, factoryCoId })
			} else {
				// Schema not available yet - set up reactive subscription
				setupReactiveSubscription().catch((error) => {
					store._set({ loading: false, error: error.message })
				})
			}
		})
		.catch(() => {
			// Immediate resolution failed - set up reactive subscription
			setupReactiveSubscription().catch((error) => {
				store._set({ loading: false, error: error.message })
			})
		})

	return store
}

/**
 * Resolve CoValue reactively - returns ReactiveStore that updates when CoValue becomes available
 *
 * @param {Object} peer - Backend instance
 * @param {string} coId - CoValue ID
 * @param {Object} [options] - Options
 * @returns {ReactiveStore} ReactiveStore that updates when CoValue resolves:
 *   - Initial: { loading: true }
 *   - When resolved: { loading: false, coValueCore: CoValueCore }
 */
export function resolveCoValueReactive(peer, coId, _options = {}) {
	const store = new ReactiveStore({ loading: true })

	if (!coId?.startsWith('co_z')) {
		store._set({ loading: false, error: 'Invalid co-id' })
		return store
	}

	// Get CoValueCore (creates if doesn't exist)
	const coValueCore = peer.getCoValue(coId)
	if (!coValueCore) {
		store._set({ loading: false, error: 'CoValueCore not found' })
		return store
	}

	// Check if already available
	if (peer.isAvailable(coValueCore)) {
		store._set({ loading: false, coValueCore })
		return store
	}

	// Trigger loading
	ensureCoValueLoaded(peer, coId, { waitForAvailable: false }).catch((_err) => {
		// Silently handle errors - subscription will handle updates
	})

	// Subscribe via shared observer hub (same policy as read.js)
	const hubUnsub = observeCoValue(peer, coId).subscribe((core) => {
		if (peer.isAvailable(core)) {
			store._set({ loading: false, coValueCore: core })
			hubUnsub()
		}
	})

	// Cleanup on store unsubscribe
	const originalUnsubscribe = store._unsubscribe
	store._unsubscribe = () => {
		if (originalUnsubscribe) originalUnsubscribe()
		hubUnsub()
	}

	return store
}

/**
 * Resolve query reactively - returns ReactiveStore that updates when query results become available
 *
 * @param {Object} peer - Backend instance
 * @param {Object} queryDef - Query definition { factory: '°Maia/factory/data/todos', filter: {...}, options: {...} }
 * @param {Object} [options] - Options
 * @returns {ReactiveStore} ReactiveStore that updates when query resolves:
 *   - Initial: { loading: true, items: [] }
 *   - When resolved: { loading: false, items: [...] }
 */
export function resolveQueryReactive(peer, queryDef, options = {}) {
	const store = new ReactiveStore({ loading: true, items: [] })

	if (!queryDef?.factory) {
		store._set({ loading: false, items: [], error: 'Invalid query definition' })
		return store
	}

	// Resolve factory reactively
	const factoryStore = resolveFactoryReactive(peer, queryDef.factory, options)

	// Subscribe to factory resolution
	const factoryUnsubscribe = factoryStore.subscribe(async (factoryState) => {
		if (factoryState.loading) {
			return // Still loading factory
		}

		if (factoryState.error || !factoryState.factoryCoId) {
			store._set({ loading: false, items: [], error: factoryState.error || 'Factory not found' })
			factoryUnsubscribe()
			return
		}

		// Factory resolved - execute query
		try {
			const queryStore = await universalRead(
				peer,
				null,
				factoryState.factoryCoId,
				queryDef.filter || null,
				null,
				{
					...options,
					...(queryDef.options || {}),
				},
			)

			// Subscribe to query results
			const queryUnsubscribe = queryStore.subscribe((queryResults) => {
				const items = Array.isArray(queryResults) ? queryResults : queryResults?.items || []
				store._set({ loading: false, items })
			})

			// Cleanup on store unsubscribe
			const originalUnsubscribe = store._unsubscribe
			store._unsubscribe = () => {
				if (originalUnsubscribe) originalUnsubscribe()
				queryUnsubscribe()
				factoryUnsubscribe()
			}
		} catch (error) {
			store._set({ loading: false, items: [], error: error.message })
			factoryUnsubscribe()
		}
	})

	return store
}

/**
 * Universal reactive resolver - handles any dependency type
 *
 * @param {Object} peer - Backend instance
 * @param {string|Object} identifier - Identifier (co-id, factory key, or query definition)
 * @param {Object} [options] - Options
 * @returns {ReactiveStore} ReactiveStore that updates when dependency resolves
 */
export function resolveReactive(peer, identifier, options = {}) {
	// Handle query definition objects
	if (identifier && typeof identifier === 'object' && !Array.isArray(identifier)) {
		if (identifier.factory) {
			// Query definition
			return resolveQueryReactive(peer, identifier, options)
		}
		if (identifier.fromCoValue) {
			// Extract factory from CoValue reactively
			const coValueStore = resolveCoValueReactive(peer, identifier.fromCoValue, options)
			const factoryStore = new ReactiveStore({ loading: true })

			// Track subscriptions for cleanup
			let coValueUnsubscribe
			let factoryResolveUnsubscribe
			let headerUnsubscribe

			coValueUnsubscribe = coValueStore.subscribe(async (coValueState) => {
				if (coValueState.loading) {
					return
				}

				if (coValueState.error || !coValueState.coValueCore) {
					factoryStore._set({ loading: false, error: coValueState.error || 'CoValue not found' })
					if (coValueUnsubscribe) coValueUnsubscribe()
					return
				}

				// Extract factory from headerMeta
				const header = peer.getHeader(coValueState.coValueCore)
				const headerMeta = header?.meta || null
				const factoryCoId = headerMeta?.$factory || null

				if (factoryCoId && typeof factoryCoId === 'string' && factoryCoId.startsWith('co_z')) {
					// Resolve factory reactively
					const resolvedFactoryStore = resolveFactoryReactive(peer, factoryCoId, options)
					factoryResolveUnsubscribe = resolvedFactoryStore.subscribe((factoryState) => {
						factoryStore._set(factoryState)
						if (!factoryState.loading) {
							if (factoryResolveUnsubscribe) factoryResolveUnsubscribe()
							if (coValueUnsubscribe) coValueUnsubscribe()
						}
					})
				} else {
					// Subscribe to CoValueCore updates to wait for headerMeta.$factory
					headerUnsubscribe = coValueState.coValueCore.subscribe((core) => {
						const updatedHeader = peer.getHeader(core)
						const updatedHeaderMeta = updatedHeader?.meta || null
						const updatedFactoryCoId = updatedHeaderMeta?.$factory || null

						if (
							updatedFactoryCoId &&
							typeof updatedFactoryCoId === 'string' &&
							updatedFactoryCoId.startsWith('co_z')
						) {
							// Resolve factory reactively
							const resolvedFactoryStore = resolveFactoryReactive(peer, updatedFactoryCoId, options)
							factoryResolveUnsubscribe = resolvedFactoryStore.subscribe((factoryState) => {
								factoryStore._set(factoryState)
								if (!factoryState.loading) {
									if (factoryResolveUnsubscribe) factoryResolveUnsubscribe()
									if (headerUnsubscribe) headerUnsubscribe()
									if (coValueUnsubscribe) coValueUnsubscribe()
								}
							})
						}
					})
				}
			})

			// Cleanup - ensure all subscriptions are cleaned up
			const originalUnsubscribe = factoryStore._unsubscribe
			factoryStore._unsubscribe = () => {
				if (originalUnsubscribe) originalUnsubscribe()
				if (coValueUnsubscribe) coValueUnsubscribe()
				if (factoryResolveUnsubscribe) factoryResolveUnsubscribe()
				if (headerUnsubscribe) headerUnsubscribe()
			}

			return factoryStore
		}
	}

	// Handle string identifiers
	if (typeof identifier === 'string') {
		if (identifier.startsWith('co_z')) {
			// Co-id - resolve CoValue reactively
			return resolveCoValueReactive(peer, identifier, options)
		} else {
			// Factory key - resolve factory reactively
			return resolveFactoryReactive(peer, identifier, options)
		}
	}

	// Invalid identifier
	const store = new ReactiveStore({ loading: false, error: 'Invalid identifier' })
	return store
}
