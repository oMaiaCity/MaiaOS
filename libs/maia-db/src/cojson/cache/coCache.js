/**
 * CoCache - Unified caching and lifecycle management for CoValues
 *
 * Single source of truth for all CoValue caching, deduplication, and lifecycle management.
 * Consolidates subscription caching, store caching, resolution tracking, and resolved data caching.
 *
 * Key Features:
 * - Subscription caching (subscription:${id})
 * - Store caching (store:${key})
 * - Resolution tracking (resolution:${id})
 * - Resolved data caching (resolved:${coId}:${options})
 * - Auto-cleanup after configurable timeout (default: 5 seconds)
 * - Node-aware (clears on node change)
 * - Memory leak prevention through cleanup timers
 */

export class CoCache {
	/**
	 * Create a new unified cache
	 *
	 * @param {number} cleanupTimeout - Time in ms before cleaning up unused entries (default: 5000)
	 */
	constructor(cleanupTimeout = 5000) {
		// Unified cache: stores subscriptions, stores, resolutions, resolved data
		// Key format: namespaced keys like `subscription:${id}`, `store:${key}`, `resolution:${id}`, `resolved:${coId}:${options}`
		this.cache = new Map() // key → value (subscription, ReactiveStore, Promise, true, resolved data, etc.)
		this.cleanupTimeout = cleanupTimeout
		this.cleanupTimers = new Map() // key → timeoutId
	}

	/**
	 * Get existing entry or create new one (unified getOrCreate for all types)
	 *
	 * @param {string} key - Cache key (MUST be namespaced: `subscription:${id}`, `store:${key}`, etc.)
	 * @param {Function} factory - Function that creates new entry
	 * @returns {any} Cached or newly created entry
	 */
	getOrCreate(key, factory) {
		// Check if entry already exists
		const existing = this.cache.get(key)

		if (existing) {
			// Cancel cleanup since entry is being used
			this.cancelCleanup(key)
			return existing
		}

		// Create new entry via factory
		const entry = factory()
		this._maybeWarnSubscriptionBuildup()

		// Store in cache
		this.cache.set(key, entry)

		return entry
	}

	/**
	 * Get existing subscription or create new one (backward compatibility)
	 *
	 * @param {string} id - CoValue ID
	 * @param {Function} factory - Function that creates new subscription
	 * @returns {Object} Subscription object
	 */
	getOrCreateSubscription(id, factory) {
		return this.getOrCreate(`subscription:${id}`, factory)
	}

	/**
	 * Get existing store or create new one
	 *
	 * @param {string} key - Store cache key (schema+filter+options)
	 * @param {Function} factory - Function that creates new ReactiveStore
	 * @returns {ReactiveStore} ReactiveStore instance
	 */
	getOrCreateStore(key, factory) {
		return this.getOrCreate(`store:${key}`, factory)
	}

	/**
	 * Get existing resolution promise or create new one
	 *
	 * @param {string} coId - CoValue ID
	 * @param {Function} factory - Function that creates resolution Promise
	 * @returns {Promise|true} Resolution promise or true if already resolved
	 */
	getOrCreateResolution(coId, factory) {
		const key = `resolution:${coId}`
		const existing = this.cache.get(key)

		if (existing === true) {
			// Already resolved - return true
			return true
		}

		if (existing && typeof existing.then === 'function') {
			// Resolution in progress - return promise
			return existing
		}

		// Create new resolution promise via factory
		const promise = factory()

		// Store promise in cache
		this.cache.set(key, promise)

		return promise
	}

	/**
	 * Mark resolution as completed
	 *
	 * @param {string} coId - CoValue ID
	 */
	markResolved(coId) {
		this.cache.set(`resolution:${coId}`, true)
	}

	/**
	 * Check if CoValue is already resolved or being resolved
	 *
	 * @param {string} coId - CoValue ID
	 * @returns {boolean} True if already resolved or being resolved
	 */
	isResolved(coId) {
		const cached = this.cache.get(`resolution:${coId}`)
		return cached === true || (cached && typeof cached.then === 'function')
	}

	/**
	 * Get cached resolved+mapped data
	 *
	 * @param {string} coId - CoValue ID
	 * @param {Object} options - Options object (for cache key)
	 * @returns {any|null} Cached resolved data or null
	 */
	getResolvedData(coId, options) {
		const key = `resolved:${coId}:${JSON.stringify(options || {})}`
		const cached = this.cache.get(key)
		// If it's a promise, it's still being processed - return null to indicate not ready
		if (cached && typeof cached.then === 'function') {
			return null
		}
		return cached || null
	}

	/**
	 * Get or create resolved data (prevents concurrent processing)
	 *
	 * @param {string} coId - CoValue ID
	 * @param {Object} options - Options object (for cache key)
	 * @param {Function} factory - Async function that creates/resolves the data
	 * @returns {Promise<any>} Resolved data (from cache or factory)
	 */
	async getOrCreateResolvedData(coId, options, factory) {
		const key = `resolved:${coId}:${JSON.stringify(options || {})}`
		const existing = this.cache.get(key)

		// If already cached (and not a promise), return it immediately
		if (existing && typeof existing.then !== 'function') {
			return existing
		}

		// If there's a promise in progress, wait for it (prevents concurrent processing)
		if (existing && typeof existing.then === 'function') {
			try {
				return await existing
			} catch (_err) {
				// If promise failed, try again (fall through to create new promise)
				this.cache.delete(key)
			}
		}

		// Create new promise and store it BEFORE calling factory
		// This ensures concurrent calls will see the same promise
		const promise = (async () => {
			try {
				const data = await factory()
				// Replace promise with actual data
				this.cache.set(key, data)
				return data
			} catch (err) {
				// On error, remove the promise so it can be retried
				this.cache.delete(key)
				throw err
			}
		})()

		// Store promise immediately so concurrent calls can wait for it
		this.cache.set(key, promise)
		return promise
	}

	/**
	 * Cache resolved+mapped data
	 *
	 * @param {string} coId - CoValue ID
	 * @param {Object} options - Options object (for cache key)
	 * @param {any} data - Resolved+mapped data to cache
	 */
	setResolvedData(coId, options, data) {
		const key = `resolved:${coId}:${JSON.stringify(options || {})}`
		this.cache.set(key, data)
	}

	/**
	 * Invalidate all cached resolved data for a CoValue
	 * Used when CoValue changes to force re-processing
	 *
	 * @param {string} coId - CoValue ID
	 */
	invalidateResolvedData(coId) {
		// Find all cache keys that start with `resolved:${coId}:`
		const prefix = `resolved:${coId}:`
		const keysToDelete = []

		for (const key of this.cache.keys()) {
			if (key.startsWith(prefix)) {
				keysToDelete.push(key)
			}
		}

		// Delete all matching keys
		for (const key of keysToDelete) {
			this.cache.delete(key)
		}
	}

	/**
	 * Schedule cleanup for unused entry
	 *
	 * @param {string} key - Cache key (MUST be namespaced)
	 */
	scheduleCleanup(key) {
		// Clear any existing timer first
		this.cancelCleanup(key)

		const timerId = setTimeout(() => {
			this.destroy(key)
			this._maybeLogStats()
		}, this.cleanupTimeout)

		this.cleanupTimers.set(key, timerId)
	}

	/**
	 * Debug: Log cache stats when window._maiaDebugSubscriptions is true
	 * Helps diagnose subscription buildup / agent freeze issues
	 * @private
	 */
	_maybeLogStats() {
		if (typeof window !== 'undefined' && window._maiaDebugSubscriptions) {
			const _subs = Array.from(this.cache.keys()).filter((k) => k.startsWith('subscription:'))
			const _stores = Array.from(this.cache.keys()).filter((k) => k.startsWith('store:'))
		}
	}

	/**
	 * Debug: Warn when subscription count exceeds threshold (indicates possible leak)
	 * Set window._maiaDebugSubscriptions = true; threshold via window._maiaDebugSubscriptionThreshold (default 80)
	 * Throttled to once per 10s to avoid spam.
	 * @private
	 */
	_maybeWarnSubscriptionBuildup() {
		if (typeof window === 'undefined' || !window._maiaDebugSubscriptions) return
		const subs = Array.from(this.cache.keys()).filter((k) => k.startsWith('subscription:'))
		const threshold = window._maiaDebugSubscriptionThreshold ?? 80
		if (subs.length < threshold) return
		const now = Date.now()
		if (this._lastBuildupWarn && now - this._lastBuildupWarn < 10000) return
		this._lastBuildupWarn = now
	}

	/**
	 * Cancel scheduled cleanup
	 *
	 * @param {string} key - Cache key (MUST be namespaced)
	 */
	cancelCleanup(key) {
		const timerId = this.cleanupTimers.get(key)

		if (timerId) {
			clearTimeout(timerId)
			this.cleanupTimers.delete(key)
		}
	}

	/**
	 * Manually destroy entry and remove from cache
	 *
	 * @param {string} key - Cache key (MUST be namespaced)
	 */
	destroy(key) {
		const entry = this.cache.get(key)

		if (!entry) {
			return
		}

		// Handle different entry types
		if (entry && typeof entry === 'object') {
			// Call unsubscribe if available (for subscriptions)
			if (entry.unsubscribe && typeof entry.unsubscribe === 'function') {
				try {
					entry.unsubscribe()
				} catch (_error) {
					// Silently handle unsubscribe errors
				}
			}

			// Call _unsubscribe if available (for ReactiveStores)
			if (entry._unsubscribe && typeof entry._unsubscribe === 'function') {
				try {
					entry._unsubscribe()
				} catch (_error) {
					// Silently handle unsubscribe errors
				}
			}
		}

		// Remove from cache
		this.cache.delete(key)

		// Clear timer if exists
		this.cancelCleanup(key)
	}

	/**
	 * Check if entry exists in cache
	 *
	 * @param {string} key - Cache key (MUST be namespaced)
	 * @returns {boolean}
	 */
	has(key) {
		return this.cache.has(key)
	}

	/**
	 * Get entry from cache without creating
	 *
	 * @param {string} key - Cache key (MUST be namespaced)
	 * @returns {any|null} Entry or null
	 */
	get(key) {
		return this.cache.get(key) || null
	}

	/**
	 * Get cache size (number of active entries)
	 *
	 * @returns {number}
	 */
	get size() {
		return this.cache.size
	}

	/**
	 * Debug: Get cache stats for subscription/freeze investigation
	 * Call via: maia.dataEngine?.peer?.subscriptionCache.getStats()
	 * @returns {{ cacheSize: number, subscriptions: number, stores: number, pendingCleanups: number }}
	 */
	getStats() {
		const keys = Array.from(this.cache.keys())
		return {
			cacheSize: this.cache.size,
			subscriptions: keys.filter((k) => k.startsWith('subscription:')).length,
			stores: keys.filter((k) => k.startsWith('store:')).length,
			pendingCleanups: this.cleanupTimers.size,
		}
	}

	/**
	 * Clear all entries and timers
	 *
	 * Useful for cleanup on app shutdown or context switch
	 * CRITICAL: Properly unsubscribes from all entries before clearing
	 */
	clear() {
		// Destroy all entries (this properly unsubscribes)
		// Create a copy of keys array to avoid iteration issues during deletion
		const keys = Array.from(this.cache.keys())
		for (const key of keys) {
			this.destroy(key)
		}

		// Clear maps (should already be empty after destroy, but ensure it's clean)
		this.cache.clear()
		this.cleanupTimers.clear()
	}
}

/**
 * Global unified cache instance
 *
 * Shared across the application for unified caching and deduplication
 */
let globalCache = null

/**
 * Current node instance tracked by the cache
 *
 * Used to detect when node changes (e.g., after re-login) and clear stale cache
 */
let currentNode = null

/**
 * Get or create global unified cache (node-aware)
 *
 * Following jazz-tools pattern: cache is inherently tied to node instance.
 * When node changes, cache is automatically cleared to prevent stale entries.
 *
 * @param {Object} node - Current node instance (required for node-aware caching)
 * @param {number} cleanupTimeout - Optional cleanup timeout override
 * @returns {CoCache}
 */
export function getGlobalCoCache(node, cleanupTimeout) {
	// STRICT: Node is required - no backward compatibility layers
	if (!node) {
		throw new Error('[getGlobalCoCache] node is required for node-aware caching')
	}

	// Detect node change: if node instance is different, clear stale cache
	if (currentNode !== node) {
		if (globalCache) {
			// Clear old cache tied to previous node
			globalCache.clear()
		}
		// Track new node instance
		currentNode = node
		// Create fresh cache for new node
		globalCache = new CoCache(cleanupTimeout)
	} else if (!globalCache) {
		// First time initialization
		currentNode = node
		globalCache = new CoCache(cleanupTimeout)
	}
	return globalCache
}

/**
 * Reset global cache (primarily for testing)
 *
 * Also clears node tracking to allow fresh start
 */
export function resetGlobalCoCache() {
	if (globalCache) {
		globalCache.clear()
		globalCache = null
	}
	currentNode = null
}

/**
 * Invalidate resolved data cache when a CoValue is mutated.
 * Call from CRUD operations (update, etc.) so next read sees persisted CRDT state.
 * Keeps invalidation logic in cache layer; callers just notify.
 *
 * @param {Object} peer - Peer instance (must have subscriptionCache)
 * @param {string} coId - CoValue ID that was mutated
 */
export function invalidateResolvedDataForMutatedCoValue(peer, coId) {
	peer?.subscriptionCache?.invalidateResolvedData(coId)
}
