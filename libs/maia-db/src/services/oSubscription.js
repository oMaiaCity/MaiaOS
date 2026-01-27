/**
 * oSubscription - Automatic CoValue subscription and loading
 * 
 * Provides high-level API for subscribing to CoValues with automatic loading,
 * caching, and lifecycle management. Ports Jazz's subscription patterns into
 * maia-db as a clean JavaScript abstraction.
 * 
 * Key Features:
 * - Automatic subscription to CoValues by ID
 * - Auto-loading of child CoValues (linked references)
 * - Subscription caching and deduplication
 * - Loading state management (loading, loaded, error)
 * - Automatic cleanup after inactivity
 */

import { getGlobalCache } from './oSubscriptionCache.js';

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
		autoLoadChildren = false,
		cleanupTimeout = 5000,
	} = options;

	// Pass node to getGlobalCache for node-aware caching (auto-clears on node change)
	const cache = getGlobalCache(node, cleanupTimeout);

	// Get or create subscription
	const subscription = cache.getOrCreate(id, () => {
		console.log(`📡 [SUBSCRIBE] Creating subscription for ${id.substring(0, 12)}...`);

		let currentValue = null;
		let loading = true;
		let error = null;
		let unsubscribeCallback = null;

		// Try to get CoValue from node
		try {
			const coValueCore = node.getCoValue(id);

			if (!coValueCore) {
				console.log(`⚠️  [SUBSCRIBE] CoValue ${id.substring(0, 12)}... not found in node`);
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
							console.log(`⏳ [SUBSCRIBE] CoValue ${id.substring(0, 12)}... waiting for verified state...`);
							loading = true;
							error = null;
							currentValue = null;
							return;
						}

						// CoValue is available - safe to call getCurrentContent()
						currentValue = core.getCurrentContent();
						loading = false;
						error = null;

						console.log(`✅ [SUBSCRIBE] CoValue ${id.substring(0, 12)}... loaded`);
						console.log(`   Type: ${currentValue.type}`);

						// Auto-load children if enabled
						if (autoLoadChildren && currentValue) {
							subscribeToChildren(node, currentValue, options);
						}
					} catch (err) {
						console.error(`❌ [SUBSCRIBE] Error processing update for ${id.substring(0, 12)}...`, err);
						loading = false;
						error = err;
						currentValue = null;
					}
				});

				// If not available yet, trigger loading
				if (!coValueCore.isAvailable()) {
					console.log(`📥 [SUBSCRIBE] Loading ${id.substring(0, 12)}... from storage...`);
					// Trigger load (Jazz pattern)
					node.loadCoValueCore(id).catch(err => {
						console.error(`❌ [SUBSCRIBE] Failed to load ${id.substring(0, 12)}...`, err);
						loading = false;
						error = err;
					});
				}

				console.log(`🎧 [SUBSCRIBE] Listening to ${id.substring(0, 12)}...`);
			}
		} catch (err) {
			console.error(`❌ [SUBSCRIBE] Error subscribing to ${id.substring(0, 12)}...`, err);
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
					console.log(`🔇 [SUBSCRIBE] Unsubscribed from ${id.substring(0, 12)}...`);
				}
			}
		};
	});

	return subscription;
}

/**
 * Subscribe to child CoValues referenced by a parent
 * 
 * Iterates through parent's properties and subscribes to any CoValue IDs found.
 * Uses RawCoMap ops to safely access properties.
 * 
 * @param {LocalNode} node - Jazz LocalNode
 * @param {RawCoValue} parent - Parent CoValue content
 * @param {Object} options - Subscription options
 */
function subscribeToChildren(node, parent, options) {
	if (!parent || typeof parent !== 'object') {
		return;
	}

	console.log(`👶 [SUBSCRIBE] Auto-loading children of ${parent.id?.substring(0, 12) || 'unknown'}...`);

	// For CoMaps, access properties via ops
	if (parent.type === 'comap' && parent.ops) {
		try {
			// Iterate through the ops object to find properties
			for (const [key, value] of Object.entries(parent.ops)) {
				// Skip internal properties
				if (key.startsWith('_') || key === 'id' || key === 'type' || key === 'group') {
					continue;
				}

				// Get the latest value for this key
				const latestValue = parent.latest[key];
				
				// Check if value looks like a CoValue ID
				if (typeof latestValue === 'string' && latestValue.startsWith('co_')) {
					console.log(`   🔗 Found child reference: ${key} → ${latestValue.substring(0, 12)}...`);
					subscribe(node, latestValue, options);
				}
			}
		} catch (err) {
			console.error(`❌ [SUBSCRIBE] Error loading children:`, err);
		}
	}
}

/**
 * Subscribe to all CoValues linked from a parent property
 * 
 * Example: subscribeToLinked(account, 'os')
 * - Subscribes to account.os CoMap
 * - Auto-subscribes to all children (data, groups, schemata, examples)
 * 
 * @param {LocalNode} node - Jazz LocalNode
 * @param {RawCoValue} parent - Parent CoValue (e.g., account)
 * @param {string} property - Property name (e.g., 'examples')
 * @param {Object} options - Subscription options
 * @param {boolean} options.autoLoadChildren - Auto-subscribe to children (default: true)
 * @returns {Object} { subscriptions: Map, unsubscribeAll: Function }
 */
export function subscribeToLinked(node, parent, property, options = {}) {
	const {
		autoLoadChildren = true, // Default true for linked subscriptions
		...otherOptions
	} = options;

	console.log(`🔗 [SUBSCRIBE LINKED] Subscribing to ${property} and its children...`);

	const subscriptions = new Map();

	try {
		// Get property value (should be CoValue ID)
		const propertyValue = parent.get ? parent.get(property) : parent[property];

		if (!propertyValue) {
			console.log(`⚠️  [SUBSCRIBE LINKED] Property ${property} is empty`);
			return { subscriptions, unsubscribeAll: () => {} };
		}

		if (typeof propertyValue !== 'string' || !propertyValue.startsWith('co_')) {
			console.log(`⚠️  [SUBSCRIBE LINKED] Property ${property} is not a CoValue ID: ${propertyValue}`);
			return { subscriptions, unsubscribeAll: () => {} };
		}

		console.log(`   📍 Found ${property}: ${propertyValue.substring(0, 12)}...`);

		// Subscribe to the linked CoValue with auto-loading of children
		const subscription = subscribe(node, propertyValue, {
			...otherOptions,
			autoLoadChildren
		});

		subscriptions.set(propertyValue, subscription);

		console.log(`✅ [SUBSCRIBE LINKED] Subscribed to ${property} (${subscriptions.size} total)`);

	} catch (error) {
		console.error(`❌ [SUBSCRIBE LINKED] Error subscribing to ${property}:`, error);
	}

	// Return collection with unsubscribe-all helper
	return {
		subscriptions,
		unsubscribeAll: () => {
			console.log(`🔇 [SUBSCRIBE LINKED] Unsubscribing from all (${subscriptions.size} subscriptions)`);
			for (const [id, sub] of subscriptions.entries()) {
				if (sub.unsubscribe) {
					sub.unsubscribe();
				}
			}
			subscriptions.clear();
		}
	};
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
