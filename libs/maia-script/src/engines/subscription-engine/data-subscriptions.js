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
        
        // Set context to store's current value immediately (before subscribing)
        // This ensures initial render has correct data if store is already loaded
        const initialValue = store.value || [];
        actor.context[key] = initialValue;
        
        // Track that we've set initial value (even if empty) to detect when real data arrives
        if (!actor._initialDataReceived) {
          actor._initialDataReceived = new Set();
        }
        // Mark as received only if we have actual data (not empty array)
        if (initialValue && (Array.isArray(initialValue) ? initialValue.length > 0 : true)) {
          actor._initialDataReceived.add(key);
        }
        
        // Add schema to context for use in view templates (e.g., drag/drop)
        // Use the resolved schema co-id
        // Add both key-specific schema (e.g., "todosTodo" → "todosTodoSchema") 
        // and base schema name (e.g., "todosSchema") for consistency
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

  // Check if this is the first real data for this key (not just empty array)
  const hasReceivedData = actor._initialDataReceived && actor._initialDataReceived.has(contextKey);
  const isInitialData = !hasReceivedData;
  
  // Check if data actually changed
  const existingData = actor.context[contextKey];
  if (isSameData(existingData, data)) {
    // Data unchanged - skip processing
    // But if this is initial data and we haven't marked it as received, mark it now
    if (isInitialData && data && (Array.isArray(data) ? data.length > 0 : true)) {
      if (!actor._initialDataReceived) {
        actor._initialDataReceived = new Set();
      }
      actor._initialDataReceived.add(contextKey);
    }
    return; // Skip - data matches what's already in context
  }
  
  if (isInitialData) {
    // First real data for this key - always accept it
    actor.context[contextKey] = data;
    
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
