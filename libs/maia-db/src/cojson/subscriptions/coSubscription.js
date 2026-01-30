/**
 * CoSubscription - Automatic CoValue subscription and loading
 * 
 * Provides high-level API for subscribing to CoValues with automatic loading,
 * caching, and lifecycle management. Ports Jazz's subscription patterns into
 * maia-db as a clean JavaScript abstraction.
 * 
 * Key Features:
 * - Automatic subscription to CoValues by ID
 * - Subscription caching and deduplication
 * - Loading state management (loading, loaded, error)
 * - Automatic cleanup after inactivity
 */

import { getGlobalCache } from './coSubscriptionCache.js';

/**
 * Subscribe to a CoValue and automatically load it from IndexedDB
 * 
 * Creates or reuses cached subscription. Handles loading states and errors.
 * Optionally auto-subscribes to child CoValues.
 * 
 * @param {LocalNode} node - Jazz LocalNode instance
 * @param {string} id - CoValue ID to subscribe to
 * @param {Object} options - Subscription options
 * @param {boolean} options.autoLoadChildren - Auto-subscribe to child refs (default: false)
 * @param {number} options.cleanupTimeout - Cleanup after ms (default: 5000)
 * @returns {Object} { value, loading, error, unsubscribe }
 */
export function subscribe(node, id, options = {}) {
	const {
		cleanupTimeout = 5000,
	} = options;

	// Pass node to getGlobalCache for node-aware caching (auto-clears on node change)
	const cache = getGlobalCache(node, cleanupTimeout);

	// Get or create subscription
	const subscription = cache.getOrCreate(id, () => {
		let currentValue = null;
		let loading = true;
		let error = null;
		let unsubscribeCallback = null;

		// Try to get CoValue from node
		try {
			const coValueCore = node.getCoValue(id);

			if (!coValueCore) {
				loading = false;
				error = new Error(`CoValue ${id} not found`);
			} else {
				// Subscribe to CoValue updates
				// CRITICAL: Jazz pattern - check isAvailable() before getCurrentContent()!
				unsubscribeCallback = coValueCore.subscribe((core) => {
					try {
						// Check if CoValue has verified state (Jazz pattern)
						if (!core.isAvailable()) {
							// CoValue not yet available (no verified state)
							loading = true;
							error = null;
							currentValue = null;
							return;
						}

						// CoValue is available - safe to call getCurrentContent()
						currentValue = core.getCurrentContent();
						loading = false;
						error = null;
					} catch (err) {
						loading = false;
						error = err;
						currentValue = null;
					}
				});

				// If not available yet, trigger loading
				if (!coValueCore.isAvailable()) {
					// Trigger load (Jazz pattern)
					node.loadCoValueCore(id).catch(err => {
						loading = false;
						error = err;
					});
				}
			}
		} catch (err) {
			loading = false;
			error = err;
		}

		return {
			id,
			get value() { return currentValue; },
			get loading() { return loading; },
			get error() { return error; },
			unsubscribe: () => {
				if (unsubscribeCallback) {
					unsubscribeCallback();
				}
			}
		};
	});

	return subscription;
}


/**
 * Get current subscription for a CoValue (if exists)
 * 
 * @param {LocalNode} node - Jazz LocalNode instance (required for node-aware caching)
 * @param {string} id - CoValue ID
 * @returns {Object|null} Subscription or null
 */
export function getSubscription(node, id) {
	const cache = getGlobalCache(node);
	return cache.get(id);
}

/**
 * Check if CoValue has active subscription
 * 
 * @param {LocalNode} node - Jazz LocalNode instance (required for node-aware caching)
 * @param {string} id - CoValue ID
 * @returns {boolean}
 */
export function hasSubscription(node, id) {
	const cache = getGlobalCache(node);
	return cache.has(id);
}

/**
 * Manually unsubscribe from a CoValue
 * 
 * @param {LocalNode} node - Jazz LocalNode instance (required for node-aware caching)
 * @param {string} id - CoValue ID
 */
export function unsubscribe(node, id) {
	const cache = getGlobalCache(node);
	const subscription = cache.get(id);

	if (subscription && subscription.unsubscribe) {
		subscription.unsubscribe();
	}

	cache.destroy(id);
}

/**
 * Get subscription cache statistics
 * 
 * @param {LocalNode} node - Jazz LocalNode instance (required for node-aware caching)
 * @returns {Object} { size, ids }
 */
export function getSubscriptionStats(node) {
	const cache = getGlobalCache(node);
	return {
		size: cache.size,
		ids: Array.from(cache.cache.keys()).map(id => id.substring(0, 12) + '...')
	};
}
