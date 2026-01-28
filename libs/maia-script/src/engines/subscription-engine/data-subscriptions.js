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
      // CRITICAL FIX: Check if already subscribed to prevent duplicate subscriptions
      // This prevents handleContextUpdate() from creating duplicate subscriptions
      if (actor._queries?.has(key)) {
        subscriptionEngine._log(`[SubscriptionEngine] ⏭️  ${actor.id}: Already subscribed to ${key}, skipping`);
        continue; // Skip - already subscribed
      }
      
      try {
        // Resolve schema if it's a human-readable reference (should be co-id after seeding, but handle gracefully)
        let schemaCoId = value.schema;
        if (!schemaCoId.startsWith('co_z')) {
          if (schemaCoId.startsWith('@schema/')) {
            // Try to resolve human-readable reference to co-id
            try {
              const resolved = await subscriptionEngine.dbEngine.execute({
                op: 'resolve',
                humanReadableKey: schemaCoId
              });
              if (resolved && resolved.startsWith('co_z')) {
                schemaCoId = resolved;
                console.log(`[SubscriptionEngine] ✅ Resolved schema reference ${value.schema} → ${schemaCoId}`);
              } else {
                console.error(`[SubscriptionEngine] ❌ Could not resolve schema reference: ${value.schema}`);
                continue;
              }
            } catch (error) {
              console.error(`[SubscriptionEngine] ❌ Failed to resolve schema reference ${value.schema}:`, error);
              continue;
            }
          } else {
            console.error(`[SubscriptionEngine] ❌ Query object schema is not a co-id or @schema/ reference: ${value.schema}`);
            continue;
          }
        }
        
        // Use read() operation - always returns reactive store
        const store = await subscriptionEngine.dbEngine.execute({
          op: 'read',
          schema: schemaCoId,
          filter: value.filter || null
        });
        
        // Track query-to-schema mapping for actor-level coordination
        if (!actor._querySchemaMap) {
          actor._querySchemaMap = new Map(); // schemaCoId → Set<queryKey>
        }
        if (!actor._queries) {
          actor._queries = new Map(); // queryKey → {schema, filter, store}
        }
        
        // Track this query
        if (!actor._querySchemaMap.has(schemaCoId)) {
          actor._querySchemaMap.set(schemaCoId, new Set());
        }
        actor._querySchemaMap.get(schemaCoId).add(key);
        actor._queries.set(key, { schema: schemaCoId, filter: value.filter || null, store });
        
        // CRITICAL FIX: Ensure context key exists BEFORE subscribing
        // The subscription callback fires immediately, so we need to ensure context is set first
        // Set context to store's current value immediately (before subscribing)
        // This ensures initial render has correct data if store is already loaded
        const initialValue = store.value || [];
        
        // CRITICAL: Always replace with actual array data (never keep query object)
        // READ-ONLY REACTIVE: Query results are derived/computed data, not persisted state
        // These mutations are correct - query results should NOT be persisted to context CoValue
        actor.context[key] = initialValue;
        
        // Verify it's actually an array (error only if wrong)
        const isArray = Array.isArray(actor.context[key]);
        if (!isArray && initialValue) {
          console.error(`[subscribeToContext] ❌ CRITICAL: Context ${key} is NOT an array! Value:`, actor.context[key]);
        }
        
        // CRITICAL FIX: Don't mark as received here - let handleDataUpdate mark it when it processes the data
        // This ensures that when the subscription fires immediately with the same value, we still process it
        // as initial data if this is the first time this actor is seeing it
        if (!actor._initialDataReceived) {
          actor._initialDataReceived = new Set();
        }
        // Don't mark as received here - handleDataUpdate will mark it when processing
        
        // Add schema to context for use in view templates (e.g., drag/drop)
        // Use the resolved schema co-id
        // Add both key-specific schema (e.g., "todosTodo" → "todosTodoSchema") 
        // and base schema name (e.g., "todosSchema") for consistency
        // READ-ONLY REACTIVE: Schema references are metadata, not persisted state
        const schemaKey = `${key}Schema`; // e.g., "todos" → "todosSchema", "todosTodo" → "todosTodoSchema"
        if (!actor.context[schemaKey]) {
          actor.context[schemaKey] = schemaCoId;
        }
        
        // Also add base schema name if key contains the schema name (e.g., "todosTodo" → "todosSchema")
        // Extract base name from key (remove suffixes like "Todo", "Done", etc.)
        const baseKeyMatch = key.match(/^(\w+)(Todo|Done|Active|Completed)?$/i);
        if (baseKeyMatch && baseKeyMatch[1]) {
          const baseKey = baseKeyMatch[1].toLowerCase(); // e.g., "todos"
          const baseSchemaKey = `${baseKey}Schema`; // e.g., "todosSchema"
          if (!actor.context[baseSchemaKey]) {
            actor.context[baseSchemaKey] = schemaCoId;
            subscriptionEngine._log(`[SubscriptionEngine] Added base schema ${baseSchemaKey} = ${schemaCoId.substring(0, 12)}... from query ${key}`);
          }
        }
        
        // Subscribe to store updates - callback will fire immediately with current value
        // This ensures we get data even if store.value was empty when we accessed it
        const unsubscribe = store.subscribe((data) => {
          handleDataUpdate(subscriptionEngine, actor.id, key, data);
        }, { skipInitial: false }); // Keep skipInitial: false so we get immediate callback
        
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
 * 
 * CRITICAL: This is a READ-ONLY reactive update handler
 * - Called when query subscriptions update (e.g., todos array changes)
 * - Updates in-memory actor.context[key] with query results
 * - Does NOT persist to context CoValue (query results are derived/computed data)
 * - Query results are NOT part of the context CoValue - they're derived from database queries
 * - This is correct behavior - we're updating derived data, not persisting it
 * 
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {string} actorId - Actor ID
 * @param {string} contextKey - Context key to update
 * @param {any} data - New data from subscription (query results)
 */
export function handleDataUpdate(subscriptionEngine, actorId, contextKey, data) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) {
    console.log(`[handleDataUpdate] Actor ${actorId.substring(0, 12)}... not found, skipping`);
    return; // Actor may have been destroyed
  }

  // CRITICAL FIX: Ensure context key exists (might be undefined if subscription fired before context was set)
  if (!(contextKey in actor.context)) {
    actor.context[contextKey] = undefined; // Initialize to undefined so we can detect it
  }
  
  // CRITICAL: Verify that incoming data is actually an array (not a query object)
  const isQueryObject = data && typeof data === 'object' && data.schema && typeof data.schema === 'string' && !Array.isArray(data);
  if (isQueryObject) {
    console.error(`[handleDataUpdate] ❌ CRITICAL: Received query object instead of array for ${contextKey}! Data:`, data);
    return; // Don't process query objects - they should have been resolved to arrays
  }
  
  // Check if this is the first real data for this key (not just empty array)
  const hasReceivedData = actor._initialDataReceived && actor._initialDataReceived.has(contextKey);
  const isInitialData = !hasReceivedData;
  
  // Check if data actually changed
  const existingData = actor.context[contextKey];
  
  // CRITICAL: Check if existing data is a query object (should never happen, but handle gracefully)
  const existingIsQueryObject = existingData && typeof existingData === 'object' && existingData.schema && typeof existingData.schema === 'string' && !Array.isArray(existingData);
  if (existingIsQueryObject) {
    console.error(`[handleDataUpdate] ❌ CRITICAL: Existing context ${contextKey} is a query object! Replacing with actual data.`);
  }
  
  // CRITICAL FIX: If existingData is undefined and new data is empty array, treat as initial data
  // This handles the case where subscription fires before context was set
  if (existingData === undefined && Array.isArray(data) && data.length === 0) {
    // Set to empty array and mark as initial data
    actor.context[contextKey] = data;
    if (!actor._initialDataReceived) {
      actor._initialDataReceived = new Set();
    }
    // Don't mark as received (empty array), so we'll accept real data when it arrives
    if (actor._initialRenderComplete) {
      subscriptionEngine._scheduleRerender(actorId);
    } else {
      actor._needsPostInitRerender = true;
    }
    return;
  }
  
  if (isSameData(existingData, data)) {
    // Data unchanged - but if this is the first time this actor is seeing it, we still need to process it
    // This handles the case where navigating back: cached store has data, context is set to match,
    // but subscription fires immediately and we need to ensure it's marked as received AND UI is updated
    if (isInitialData) {
      // Mark as received even though data is unchanged (this is initial data for this actor)
      if (!actor._initialDataReceived) {
        actor._initialDataReceived = new Set();
      }
      if (data && (Array.isArray(data) ? data.length > 0 : true)) {
        actor._initialDataReceived.add(contextKey);
      }
      // CRITICAL: Always update context and trigger rerender for initial data, even if unchanged
      // This ensures UI is populated when navigating back to a vibe with cached store data
      actor.context[contextKey] = data;
      const isArrayAfterUpdate = Array.isArray(actor.context[contextKey]);
      if (!isArrayAfterUpdate && data) {
        console.error(`[handleDataUpdate] ❌ CRITICAL: Context ${contextKey} is NOT an array after update! Value:`, actor.context[contextKey]);
      }
      // Always trigger rerender for initial data to ensure UI is updated (progressive rendering)
      if (actor._initialRenderComplete) {
        subscriptionEngine._scheduleRerender(actorId);
      } else {
        actor._needsPostInitRerender = true;
      }
      return;
    }
    // Data unchanged and not initial - skip processing
    return; // Skip - data matches what's already in context
  }
  
  if (isInitialData) {
    // First real data for this key - always accept it
    actor.context[contextKey] = data;
    const isArrayAfterUpdate = Array.isArray(actor.context[contextKey]);
    if (!isArrayAfterUpdate && data) {
      console.error(`[handleDataUpdate] ❌ CRITICAL: Context ${contextKey} is NOT an array after accepting initial data! Value:`, actor.context[contextKey]);
    }
    
    if (!actor._initialDataReceived) {
      actor._initialDataReceived = new Set();
    }
    // Only mark as received if we have actual data (not empty array)
    if (data && (Array.isArray(data) ? data.length > 0 : true)) {
      actor._initialDataReceived.add(contextKey);
    }
    
    // Always re-render on initial data (if initial render complete)
    if (actor._initialRenderComplete) {
      subscriptionEngine._scheduleRerender(actorId);
    } else {
      // CRITICAL FIX: Mark that data arrived during initialization
      // Actor will need a rerender after initial render completes
      actor._needsPostInitRerender = true;
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
  const isArrayAfterUpdate = Array.isArray(actor.context[contextKey]);
  if (!isArrayAfterUpdate && data) {
    console.error(`[handleDataUpdate] ❌ CRITICAL: Context ${contextKey} is NOT an array after update! Value:`, actor.context[contextKey]);
  }
  
  const dataSize = Array.isArray(data) ? data.length : typeof data;
  subscriptionEngine._log(`[SubscriptionEngine] 🔄 ${actorId}.$${contextKey} (${dataSize})`);

  // CRITICAL: Always trigger rerender on ANY context change (progressive rendering)
  // This ensures views are fully reactive and update immediately when data changes
  if (actor._initialRenderComplete) {
    subscriptionEngine._scheduleRerender(actorId);
  } else {
    // Mark for post-init rerender if initial render not complete
    actor._needsPostInitRerender = true;
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
