/**
 * Universal Reactive Dependency Resolver
 *
 * Provides reactive resolution for all dependency types (schemas, queries, configs, nested CoValues).
 * Returns ReactiveStore instances that automatically update when dependencies become available.
 *
 * Key Principles:
 * - No blocking waits - everything is reactive
 * - Progressive by default - dependencies resolve as they become available
 * - Subscription-based - uses CoValue subscriptions to detect when dependencies become available
 * - Automatic updates - reactive stores automatically update when dependencies resolve
 * - Universal - works for any dependency type (schemas, queries, configs, nested CoValues)
 */

import { ReactiveStore } from '../../reactive-store.js'
import { resolve } from '../schema/resolver.js'
import { ensureCoValueLoaded } from './collection-helpers.js'
import { read as universalRead } from './read.js'

export { waitForReactiveResolution } from './read-operations.js'

/**
 * Resolve schema reactively - returns ReactiveStore that updates when schema becomes available
 *
 * @param {Object} peer - Backend instance
 * @param {string} schemaKey - Schema key (°Maia/schema/data/todos) or co-id (co_z...)
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutMs=10000] - Timeout for waiting (unused in reactive mode, kept for compatibility)
 * @returns {ReactiveStore} ReactiveStore that updates when schema resolves:
 *   - Initial: { loading: true }
 *   - When resolved: { loading: false, schemaCoId: 'co_z...' }
 */
export function resolveSchemaReactive(peer, schemaKey, options = {}) {
	const { timeoutMs = 10000 } = options
	const store = new ReactiveStore({ loading: true })

	// If it's already a co-id, return immediately
	if (schemaKey.startsWith('co_z')) {
		store._set({ loading: false, schemaCoId: schemaKey })
		return store
	}

	// Track subscriptions for cleanup
	let osUnsubscribe = null
	let schematasUnsubscribe = null

	// Set up reactive subscription to spark.os.schematas for progressive resolution (account.registries.sparks[°Maia].os.schematas)
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

			// Check if schematas is available
			const schematasId = osData.schematas
			if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
				return // schematas not available yet
			}

			// Load schematas store reactively (only if not already subscribed)
			if (!schematasUnsubscribe) {
				const schematasStore = await universalRead(peer, schematasId, null, null, null, {
					deepResolve: false,
					timeoutMs,
				})

				// Subscribe to schematasStore updates
				schematasUnsubscribe = schematasStore.subscribe((schematasData) => {
					if (!schematasData || schematasData.error) {
						return // Still loading or error
					}

					// Check if schema is in registry
					const normalizedKey = schemaKey.startsWith('°Maia/schema/')
						? schemaKey
						: `°Maia/schema/${schemaKey}`
					const registryCoId = schematasData[normalizedKey] || schematasData[schemaKey]

					if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
						// Schema found - update store
						store._set({ loading: false, schemaCoId: registryCoId })
						if (schematasUnsubscribe) {
							schematasUnsubscribe()
							schematasUnsubscribe = null
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
			if (schematasUnsubscribe) {
				schematasUnsubscribe()
				schematasUnsubscribe = null
			}
			if (osUnsubscribe) {
				osUnsubscribe()
				osUnsubscribe = null
			}
		}
	}

	// Try to resolve schema immediately (non-blocking check)
	resolve(peer, schemaKey, { returnType: 'coId', timeoutMs: 2000 })
		.then((schemaCoId) => {
			if (schemaCoId?.startsWith('co_z')) {
				// Schema resolved immediately - update store
				store._set({ loading: false, schemaCoId })
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

	if (!coId || !coId.startsWith('co_z')) {
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

	// Subscribe to CoValueCore updates
	const unsubscribe = coValueCore.subscribe((core) => {
		if (peer.isAvailable(core)) {
			store._set({ loading: false, coValueCore: core })
			unsubscribe()
		}
	})

	// Cleanup on store unsubscribe
	const originalUnsubscribe = store._unsubscribe
	store._unsubscribe = () => {
		if (originalUnsubscribe) originalUnsubscribe()
		unsubscribe()
	}

	return store
}

/**
 * Resolve query reactively - returns ReactiveStore that updates when query results become available
 *
 * @param {Object} peer - Backend instance
 * @param {Object} queryDef - Query definition { schema: '°Maia/schema/data/todos', filter: {...}, options: {...} }
 * @param {Object} [options] - Options
 * @returns {ReactiveStore} ReactiveStore that updates when query resolves:
 *   - Initial: { loading: true, items: [] }
 *   - When resolved: { loading: false, items: [...] }
 */
export function resolveQueryReactive(peer, queryDef, options = {}) {
	const store = new ReactiveStore({ loading: true, items: [] })

	if (!queryDef || !queryDef.schema) {
		store._set({ loading: false, items: [], error: 'Invalid query definition' })
		return store
	}

	// Resolve schema reactively
	const schemaStore = resolveSchemaReactive(peer, queryDef.schema, options)

	// Subscribe to schema resolution
	const schemaUnsubscribe = schemaStore.subscribe(async (schemaState) => {
		if (schemaState.loading) {
			return // Still loading schema
		}

		if (schemaState.error || !schemaState.schemaCoId) {
			store._set({ loading: false, items: [], error: schemaState.error || 'Schema not found' })
			schemaUnsubscribe()
			return
		}

		// Schema resolved - execute query
		try {
			const queryStore = await universalRead(
				peer,
				null,
				schemaState.schemaCoId,
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
				schemaUnsubscribe()
			}
		} catch (error) {
			store._set({ loading: false, items: [], error: error.message })
			schemaUnsubscribe()
		}
	})

	return store
}

/**
 * Universal reactive resolver - handles any dependency type
 *
 * @param {Object} peer - Backend instance
 * @param {string|Object} identifier - Identifier (co-id, schema key, or query definition)
 * @param {Object} [options] - Options
 * @returns {ReactiveStore} ReactiveStore that updates when dependency resolves
 */
export function resolveReactive(peer, identifier, options = {}) {
	// Handle query definition objects
	if (identifier && typeof identifier === 'object' && !Array.isArray(identifier)) {
		if (identifier.schema) {
			// Query definition
			return resolveQueryReactive(peer, identifier, options)
		}
		if (identifier.fromCoValue) {
			// Extract schema from CoValue reactively
			const coValueStore = resolveCoValueReactive(peer, identifier.fromCoValue, options)
			const schemaStore = new ReactiveStore({ loading: true })

			// Track subscriptions for cleanup
			let coValueUnsubscribe
			let schemaResolveUnsubscribe
			let headerUnsubscribe

			coValueUnsubscribe = coValueStore.subscribe(async (coValueState) => {
				if (coValueState.loading) {
					return
				}

				if (coValueState.error || !coValueState.coValueCore) {
					schemaStore._set({ loading: false, error: coValueState.error || 'CoValue not found' })
					if (coValueUnsubscribe) coValueUnsubscribe()
					return
				}

				// Extract schema from headerMeta
				const header = peer.getHeader(coValueState.coValueCore)
				const headerMeta = header?.meta || null
				const schemaCoId = headerMeta?.$schema || null

				if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
					// Resolve schema reactively
					const resolvedSchemaStore = resolveSchemaReactive(peer, schemaCoId, options)
					schemaResolveUnsubscribe = resolvedSchemaStore.subscribe((schemaState) => {
						schemaStore._set(schemaState)
						if (!schemaState.loading) {
							if (schemaResolveUnsubscribe) schemaResolveUnsubscribe()
							if (coValueUnsubscribe) coValueUnsubscribe()
						}
					})
				} else {
					// Subscribe to CoValueCore updates to wait for headerMeta.$schema
					headerUnsubscribe = coValueState.coValueCore.subscribe((core) => {
						const updatedHeader = peer.getHeader(core)
						const updatedHeaderMeta = updatedHeader?.meta || null
						const updatedSchemaCoId = updatedHeaderMeta?.$schema || null

						if (
							updatedSchemaCoId &&
							typeof updatedSchemaCoId === 'string' &&
							updatedSchemaCoId.startsWith('co_z')
						) {
							// Resolve schema reactively
							const resolvedSchemaStore = resolveSchemaReactive(peer, updatedSchemaCoId, options)
							schemaResolveUnsubscribe = resolvedSchemaStore.subscribe((schemaState) => {
								schemaStore._set(schemaState)
								if (!schemaState.loading) {
									if (schemaResolveUnsubscribe) schemaResolveUnsubscribe()
									if (headerUnsubscribe) headerUnsubscribe()
									if (coValueUnsubscribe) coValueUnsubscribe()
								}
							})
						}
					})
				}
			})

			// Cleanup - ensure all subscriptions are cleaned up
			const originalUnsubscribe = schemaStore._unsubscribe
			schemaStore._unsubscribe = () => {
				if (originalUnsubscribe) originalUnsubscribe()
				if (coValueUnsubscribe) coValueUnsubscribe()
				if (schemaResolveUnsubscribe) schemaResolveUnsubscribe()
				if (headerUnsubscribe) headerUnsubscribe()
			}

			return schemaStore
		}
	}

	// Handle string identifiers
	if (typeof identifier === 'string') {
		if (identifier.startsWith('co_z')) {
			// Co-id - resolve CoValue reactively
			return resolveCoValueReactive(peer, identifier, options)
		} else {
			// Schema key - resolve schema reactively
			return resolveSchemaReactive(peer, identifier, options)
		}
	}

	// Invalid identifier
	const store = new ReactiveStore({ loading: false, error: 'Invalid identifier' })
	return store
}
