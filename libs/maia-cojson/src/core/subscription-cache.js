/**
 * Subscription Cache
 * 
 * Deduplicates subscriptions to the same CoValue.
 * Pattern adopted from jazz-tools but simplified.
 * 
 * Architecture:
 * - Nested Map: Map<coId, SubscriptionEntry>
 * - Each entry tracks: callbacks Set, subscriberCount, cleanup timeout
 * - 5-second cleanup delay when count reaches 0
 * - Auto-cleanup of empty entries
 * 
 * ZERO MOCKS: Works exclusively with real cojson node.subscribe()
 */

/**
 * Subscription entry for a single co-id
 * @typedef {Object} SubscriptionEntry
 * @property {Set<Function>} callbacks - All callbacks for this co-id
 * @property {number} subscriberCount - Number of active subscribers
 * @property {Function} unsubscribe - cojson unsubscribe function
 * @property {number|null} cleanupTimeoutId - Pending cleanup timeout
 */

export class SubscriptionCache {
  /**
   * Create a new SubscriptionCache
   * @param {number} cleanupTimeout - Milliseconds to wait before cleaning up (default: 5000)
   */
  constructor(cleanupTimeout = 5000) {
    // Nested structure: Map<coId, SubscriptionEntry>
    this.cache = new Map();
    this.cleanupTimeout = cleanupTimeout;
  }
  
  /**
   * Get subscription entry for a co-id
   * @param {string} coId - CoValue ID
   * @returns {SubscriptionEntry|undefined}
   */
  getEntry(coId) {
    return this.cache.get(coId);
  }
  
  /**
   * Check if entry exists for co-id
   * @param {string} coId - CoValue ID
   * @returns {boolean}
   */
  hasEntry(coId) {
    return this.cache.has(coId);
  }
  
  /**
   * Get subscriber count for a co-id
   * @param {string} coId - CoValue ID
   * @returns {number}
   */
  getSubscriberCount(coId) {
    const entry = this.cache.get(coId);
    return entry ? entry.subscriberCount : 0;
  }
  
  /**
   * Add a subscriber to a co-id
   * 
   * Uses real cojson node.subscribe() for the first subscriber.
   * Subsequent subscribers share the same cojson subscription.
   * 
   * @param {string} coId - CoValue ID
   * @param {Function} callback - Callback to invoke on updates
   * @param {LocalNode} node - Real cojson LocalNode
   */
  addSubscriber(coId, callback, node) {
    let entry = this.cache.get(coId);
    
    if (!entry) {
      // Create new entry with real cojson subscription
      const callbacks = new Set();
      
      // Subscribe to real cojson updates
      const unsubscribe = node.subscribe(coId, (value) => {
        // Trigger all callbacks when real CRDT updates
        for (const cb of callbacks) {
          try {
            cb(value);
          } catch (error) {
            console.error(`Subscription callback error for ${coId}:`, error);
          }
        }
      });
      
      entry = {
        callbacks,
        subscriberCount: 0,
        unsubscribe,
        cleanupTimeoutId: null,
      };
      
      this.cache.set(coId, entry);
    }
    
    // Cancel any pending cleanup
    if (entry.cleanupTimeoutId !== null) {
      clearTimeout(entry.cleanupTimeoutId);
      entry.cleanupTimeoutId = null;
    }
    
    // Add callback and increment count
    entry.callbacks.add(callback);
    entry.subscriberCount++;
  }
  
  /**
   * Remove a subscriber from a co-id
   * 
   * Schedules cleanup when subscriber count reaches 0.
   * 
   * @param {string} coId - CoValue ID
   * @param {Function} callback - Callback to remove
   */
  removeSubscriber(coId, callback) {
    const entry = this.cache.get(coId);
    
    if (!entry) {
      return; // Nothing to remove
    }
    
    // Remove callback and decrement count
    entry.callbacks.delete(callback);
    entry.subscriberCount--;
    
    // Schedule cleanup if no subscribers remain
    if (entry.subscriberCount === 0) {
      this.scheduleCleanup(coId, entry);
    }
  }
  
  /**
   * Schedule cleanup timeout for an entry
   * @param {string} coId - CoValue ID
   * @param {SubscriptionEntry} entry - Entry to cleanup
   */
  scheduleCleanup(coId, entry) {
    // Cancel existing timeout if any
    if (entry.cleanupTimeoutId !== null) {
      clearTimeout(entry.cleanupTimeoutId);
    }
    
    // Schedule new cleanup
    entry.cleanupTimeoutId = setTimeout(() => {
      this.destroyEntry(coId, entry);
    }, this.cleanupTimeout);
  }
  
  /**
   * Destroy an entry and unsubscribe from cojson
   * @param {string} coId - CoValue ID
   * @param {SubscriptionEntry} entry - Entry to destroy
   */
  destroyEntry(coId, entry) {
    // Cancel pending cleanup
    if (entry.cleanupTimeoutId !== null) {
      clearTimeout(entry.cleanupTimeoutId);
      entry.cleanupTimeoutId = null;
    }
    
    // Unsubscribe from real cojson
    try {
      entry.unsubscribe();
    } catch (error) {
      console.error(`Error unsubscribing from ${coId}:`, error);
    }
    
    // Remove from cache
    this.cache.delete(coId);
  }
  
  /**
   * Immediately cleanup an entry (bypass timeout)
   * @param {string} coId - CoValue ID
   */
  cleanupNow(coId) {
    const entry = this.cache.get(coId);
    if (entry) {
      this.destroyEntry(coId, entry);
    }
  }
  
  /**
   * Clear all subscriptions
   */
  clear() {
    // Collect all entries to destroy
    const entriesToDestroy = Array.from(this.cache.entries());
    
    // Destroy each entry
    for (const [coId, entry] of entriesToDestroy) {
      this.destroyEntry(coId, entry);
    }
    
    // Ensure cache is empty
    this.cache.clear();
  }
}
