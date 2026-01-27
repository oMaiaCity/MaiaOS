/**
 * Cache Management Helpers
 * 
 * Provides helper functions for managing backend caches.
 */

/**
 * Reset all subscription-related caches
 * 
 * Called when new backend is created to clear stale subscriptions from previous session.
 * Centralized cache management following DRY principle.
 * 
 * @param {Object} backend - Backend instance with _storeSubscriptions and _cachedUniversalGroup
 */
export function resetCaches(backend) {
  // Clear backend-specific store subscriptions Map
  // (will be empty on new backend, but ensure it's clean)
  const subscriptionCount = backend._storeSubscriptions?.size || 0;
  backend._storeSubscriptions = new Map();
  if (subscriptionCount > 0) {
    console.log(`[CoJSONBackend] Cleared ${subscriptionCount} store subscriptions on backend reset`);
  }
  // CRITICAL FIX: Invalidate cached universal group on backend reset (account change)
  // This prevents stale group references after re-login
  if (backend._cachedUniversalGroup) {
    backend._cachedUniversalGroup = null;
    console.log(`[CoJSONBackend] Invalidated cached universal group on backend reset`);
  }
  // Note: Global subscription cache is cleared automatically by getGlobalCache(node)
  // when it detects a node change, so we don't need to call resetGlobalCache() here
}
