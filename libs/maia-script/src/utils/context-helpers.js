import { ReactiveStore } from '@MaiaOS/operations/reactive-store.js';

/**
 * Get context value from ReactiveStore or plain object
 * Universal helper that handles both ReactiveStore and plain object contexts
 * Merges query stores when actor is provided
 * @param {ReactiveStore|Object} context - Context (ReactiveStore or plain object)
 * @param {Object} [actor] - Optional actor object (for query stores merging)
 * @returns {Object} Context value (merged with query stores if actor provided)
 */
export function getContextValue(context, actor = null) {
  if (context instanceof ReactiveStore) {
    const baseContextValue = (context.value && typeof context.value === 'object' && !Array.isArray(context.value)) 
      ? context.value 
      : {};
    // Merge query stores from actor if available
    const queryStores = (actor && actor._queryStores && typeof actor._queryStores === 'object') 
      ? actor._queryStores 
      : {};
    return { ...baseContextValue, ...queryStores };
  } else {
    return (context && typeof context === 'object' && !Array.isArray(context)) ? context : {};
  }
}
