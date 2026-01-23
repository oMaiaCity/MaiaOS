/**
 * Data Subscriptions Module
 * 
 * Handles reactive data subscriptions from actor context query objects.
 * Auto-subscribes to data and updates actor context reactively.
 * 
 * Uses pure stores from read() API - no callback handling.
 */

/**
 * Subscribe to data from actor context query objects
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {Object} actor - Actor instance
 * @returns {Promise<void>}
 */
export async function subscribeToContext(subscriptionEngine, actor) {
  if (!actor.context || typeof actor.context !== 'object') {
    subscriptionEngine._log(`[SubscriptionEngine] No context for ${actor.id}`);
    return;
  }

  let subscriptionCount = 0;
  
  for (const [key, value] of Object.entries(actor.context)) {
    // Query object → reactive data subscription
    // Query objects have structure: {schema: "co_z...", filter: {...}}
    // Detect by structure (has schema property), not by @ prefix
    if (value && typeof value === 'object' && value.schema && typeof value.schema === 'string') {
      try {
        // CRITICAL: Mark that this key hasn't received initial data yet
        // This ensures first callback always updates, even if data is empty
        if (!actor._initialDataReceived) {
          actor._initialDataReceived = new Set();
        }
        
        // Initialize context key with empty array (views expect arrays)
        // First callback will always update (tracked by _initialDataReceived)
        actor.context[key] = [];
        
        // Schema should already be a co-id (transformed during seeding)
        // If it's still a human-readable reference, that's an error
        if (!value.schema.startsWith('co_z')) {
          console.error(`[SubscriptionEngine] ❌ Query object schema is not a co-id: ${value.schema}. Expected co-id after seeding transformation.`);
          continue;
        }
        
        // Use read() operation - always returns reactive store
        const store = await subscriptionEngine.dbEngine.execute({
          op: 'read',
          schema: value.schema,
          filter: value.filter || null
        });
        
        // Subscribe to store updates
        const unsubscribe = store.subscribe((data) => {
          handleDataUpdate(subscriptionEngine, actor.id, key, data);
        });
        
        // Store unsubscribe function
        if (!actor._subscriptions) {
          actor._subscriptions = [];
        }
        actor._subscriptions.push(unsubscribe);
        subscriptionCount++;
      } catch (error) {
        console.error(`[SubscriptionEngine] ❌ Failed ${actor.id} → ${value.schema}:`, error);
      }
    }
    
    // @ string ref → future: reactive loading (no logging needed)
  }
  
  if (subscriptionCount > 0) {
    subscriptionEngine._log(`[SubscriptionEngine] ✅ ${actor.id}: ${subscriptionCount} subscription(s)`);
  }
}

/**
 * Handle data update from subscription callback
 * Updates actor context and triggers batched re-render
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {string} actorId - Actor ID
 * @param {string} contextKey - Context key to update
 * @param {any} data - New data from subscription
 */
export function handleDataUpdate(subscriptionEngine, actorId, contextKey, data) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) {
    return; // Actor may have been destroyed
  }

  // Check if this is the first data for this key
  const isInitialData = !actor._initialDataReceived || !actor._initialDataReceived.has(contextKey);
  
  if (isInitialData) {
    // Always accept initial data (even if empty)
    actor.context[contextKey] = data;
    
    if (!actor._initialDataReceived) {
      actor._initialDataReceived = new Set();
    }
    actor._initialDataReceived.add(contextKey);
    
    // Always re-render on initial data (if initial render complete)
    if (actor._initialRenderComplete) {
      subscriptionEngine._scheduleRerender(actorId);
    }
    return;
  }

  // Deduplication: Check if data actually changed (subsequent updates only)
  const oldData = actor.context[contextKey];
  if (isSameData(oldData, data)) {
    return; // Skip if unchanged
  }

  // Update context with new data
  actor.context[contextKey] = data;
  
  const dataSize = Array.isArray(data) ? data.length : typeof data;
  subscriptionEngine._log(`[SubscriptionEngine] 🔄 ${actorId}.$${contextKey} (${dataSize})`);

  // Trigger batched re-render (only if initial render complete)
  if (actor._initialRenderComplete) {
    subscriptionEngine._scheduleRerender(actorId);
  }
}

/**
 * Check if data has changed (simple deep equality for arrays/objects)
 * @param {any} oldData - Old data
 * @param {any} newData - New data
 * @returns {boolean} True if data is the same
 */
export function isSameData(oldData, newData) {
  // Simple comparison: JSON stringify (fast for most cases)
  // Note: This won't catch all edge cases but works for todos/arrays
  try {
    return JSON.stringify(oldData) === JSON.stringify(newData);
  } catch (e) {
    // If stringify fails, assume data changed
    return false;
  }
}
