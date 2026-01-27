/**
 * CoSubscriptionCache - Subscription lifecycle and caching management
 * 
 * Simplified port of Jazz's SubscriptionCache pattern for maia-db.
 * Manages subscription lifecycle, deduplication, and automatic cleanup.
 * 
 * Key Features:
 * - Caches active subscriptions by CoValue ID
 * - Auto-cleanup after configurable timeout (default: 5 seconds)
 * - Prevents duplicate subscriptions to same CoValue
 * - Memory leak prevention through cleanup timers
 */

export class SubscriptionCache {
	/**
	 * Create a new subscription cache
	 * 
	 * @param {number} cleanupTimeout - Time in ms before cleaning up unused subscription (default: 5000)
	 */
	constructor(cleanupTimeout = 5000) {
		this.cache = new Map(); // id → subscription object
		this.cleanupTimeout = cleanupTimeout;
		this.cleanupTimers = new Map(); // id → timeoutId
	}

	/**
	 * Get existing subscription or create new one
	 * 
	 * If subscription exists, cancels any pending cleanup and returns it.
	 * If not, creates new subscription via factory function.
	 * 
	 * @param {string} id - CoValue ID
	 * @param {Function} factory - Function that creates new subscription
	 * @returns {Object} Subscription object
	 */
	getOrCreate(id, factory) {
		// Check if subscription already exists
		const existing = this.cache.get(id);
		
		if (existing) {
			// Cancel cleanup since subscription is being used
			this.cancelCleanup(id);
			return existing;
		}

		// Create new subscription via factory
		const subscription = factory();
		
		// Store in cache
		this.cache.set(id, subscription);
		
		return subscription;
	}

	/**
	 * Schedule cleanup for unused subscription
	 * 
	 * Starts a timer that will destroy the subscription after cleanupTimeout.
	 * Called when a subscription loses its last subscriber.
	 * 
	 * @param {string} id - CoValue ID
	 */
	scheduleCleanup(id) {
		// Clear any existing timer first
		this.cancelCleanup(id);

		const timerId = setTimeout(() => {
			this.destroy(id);
		}, this.cleanupTimeout);

		this.cleanupTimers.set(id, timerId);
	}

	/**
	 * Cancel scheduled cleanup
	 * 
	 * Clears cleanup timer for a subscription that's being used again.
	 * 
	 * @param {string} id - CoValue ID
	 */
	cancelCleanup(id) {
		const timerId = this.cleanupTimers.get(id);
		
		if (timerId) {
			clearTimeout(timerId);
			this.cleanupTimers.delete(id);
		}
	}

	/**
	 * Manually destroy subscription and remove from cache
	 * 
	 * @param {string} id - CoValue ID
	 */
	destroy(id) {
		const subscription = this.cache.get(id);
		
		if (!subscription) {
			return;
		}

		// Call unsubscribe if available
		if (subscription.unsubscribe && typeof subscription.unsubscribe === 'function') {
			try {
				subscription.unsubscribe();
			} catch (error) {
				console.error(`❌ [SUB CACHE] Error unsubscribing from ${id.substring(0, 12)}...`, error);
			}
		}

		// Remove from cache
		this.cache.delete(id);
		
		// Clear timer if exists
		this.cancelCleanup(id);
	}

	/**
	 * Check if subscription exists in cache
	 * 
	 * @param {string} id - CoValue ID
	 * @returns {boolean}
	 */
	has(id) {
		return this.cache.has(id);
	}

	/**
	 * Get subscription from cache without creating
	 * 
	 * @param {string} id - CoValue ID
	 * @returns {Object|null} Subscription or null
	 */
	get(id) {
		return this.cache.get(id) || null;
	}

	/**
	 * Get cache size (number of active subscriptions)
	 * 
	 * @returns {number}
	 */
	get size() {
		return this.cache.size;
	}

	/**
	 * Clear all subscriptions and timers
	 * 
	 * Useful for cleanup on app shutdown or context switch
	 * CRITICAL: Properly unsubscribes from all CoValueCores before clearing
	 */
	clear() {
		// Destroy all subscriptions (this properly unsubscribes from CoValueCores)
		// Create a copy of keys array to avoid iteration issues during deletion
		const ids = Array.from(this.cache.keys());
		for (const id of ids) {
			this.destroy(id);
		}

		// Clear maps (should already be empty after destroy, but ensure it's clean)
		this.cache.clear();
		this.cleanupTimers.clear();
	}
}

/**
 * Global subscription cache instance
 * 
 * Shared across the application for subscription deduplication
 */
let globalCache = null;

/**
 * Current node instance tracked by the cache
 * 
 * Used to detect when node changes (e.g., after re-login) and clear stale subscriptions
 */
let currentNode = null;

/**
 * Get or create global subscription cache (node-aware)
 * 
 * Following jazz-tools pattern: subscriptions are inherently tied to node instance.
 * When node changes, cache is automatically cleared to prevent stale subscriptions.
 * 
 * @param {Object} node - Current node instance (required for node-aware caching)
 * @param {number} cleanupTimeout - Optional cleanup timeout override
 * @returns {SubscriptionCache}
 */
export function getGlobalCache(node, cleanupTimeout) {
	// Handle backward compatibility: if first arg is number, treat as cleanupTimeout (old signature)
	// This allows old code to still work, but node-aware caching won't work without node
	if (typeof node === 'number') {
		cleanupTimeout = node;
		node = null;
		console.warn('[oSubscriptionCache] getGlobalCache called without node parameter. Node-aware caching disabled.');
	}
	
	// Detect node change: if node instance is different, clear stale cache
	if (node && currentNode !== node) {
		if (globalCache) {
			const cacheSize = globalCache.size;
			// Clear old cache tied to previous node
			globalCache.clear();
			console.log(`[oSubscriptionCache] Node changed - cleared ${cacheSize} stale subscriptions`);
		}
		// Track new node instance
		currentNode = node;
		// Create fresh cache for new node
		globalCache = new SubscriptionCache(cleanupTimeout);
		console.log(`[oSubscriptionCache] Created new subscription cache for new node`);
	} else if (!globalCache) {
		// First time initialization
		if (node) {
			currentNode = node;
		}
		globalCache = new SubscriptionCache(cleanupTimeout);
	}
	return globalCache;
}

/**
 * Reset global cache (primarily for testing)
 * 
 * Also clears node tracking to allow fresh start
 */
export function resetGlobalCache() {
	if (globalCache) {
		globalCache.clear();
		globalCache = null;
	}
	currentNode = null;
}
