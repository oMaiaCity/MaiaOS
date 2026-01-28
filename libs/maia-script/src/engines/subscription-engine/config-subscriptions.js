/**
 * Config Subscriptions Module
 * 
 * Handles reactive subscriptions to config CRDTs (view, style, state, interface, context, brand).
 * Makes config files runtime-editable - changes trigger actor updates.
 * 
 * Uses pure stores from read() API - no callback handling.
 */

/**
 * Helper function to collect engine-based config subscription
 * Reduces duplication for view/style/brand/state subscriptions
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {Object} actor - Actor instance
 * @param {string} configKey - Config key (e.g., 'view', 'style', 'brand', 'state')
 * @param {string} configCoId - Config co-id (co_z...)
 * @param {Object} engine - Engine instance (viewEngine, styleEngine, or stateEngine)
 * @param {string} subscriptionMapKey - Key in engine's subscription map (e.g., 'viewSubscriptions', 'styleSubscriptions')
 * @param {Function} loadMethod - Engine's load method (e.g., loadView, loadStyle, loadStateDef)
 * @param {Function} updateHandler - Handler function for updates (e.g., _handleViewUpdate, _handleStyleUpdate)
 * @param {Array} engineSubscriptions - Array to push subscription promise to
 * @returns {number} 1 if subscription added/reused, 0 otherwise
 */
function collectEngineSubscription(
  subscriptionEngine,
  actor,
  configKey,
  configCoId,
  engine,
  subscriptionMapKey,
  loadMethod,
  updateHandler,
  engineSubscriptions
) {
  if (!configCoId || !configCoId.startsWith('co_z') || !engine) {
    return 0;
  }

  const subscriptionMap = engine[subscriptionMapKey];
  const existingSubscription = subscriptionMap?.get(configCoId);
  
  if (existingSubscription && existingSubscription.unsubscribe) {
    // Subscription already exists in new format - reuse it
    // CRITICAL: We still need to load the config to get the definition (for state machines, views, etc.)
    // AND call the update handler immediately with current config so state machines get created
    
    // Load config - engine will detect existing subscription and return config without creating duplicate
    engineSubscriptions.push(
      loadMethod.call(engine, configCoId, (updatedConfig) => {
        // Update handler for when config changes
        updateHandler.call(subscriptionEngine, actor.id, updatedConfig);
      }).then((currentConfig) => {
        // CRITICAL FIX: Call update handler immediately with current config
        // This ensures state machines get created when reusing subscriptions
        // (handleStateUpdate creates the machine, handleViewUpdate updates viewDef, etc.)
        updateHandler.call(subscriptionEngine, actor.id, currentConfig);
        
        // Increment ref count for this actor
        existingSubscription.refCount++;
        
        if (!actor._subscriptions) {
          actor._subscriptions = [];
        }
        // Wrap unsubscribe to decrement ref count
        const wrappedUnsubscribe = () => {
          const currentSubscription = subscriptionMap?.get(configCoId);
          if (currentSubscription && currentSubscription.unsubscribe) {
            currentSubscription.refCount--;
            if (currentSubscription.refCount <= 0) {
              // Last actor unsubscribed - clean up
              currentSubscription.unsubscribe();
              subscriptionMap.delete(configCoId);
            }
          }
        };
        actor._subscriptions.push(wrappedUnsubscribe);
        return 1;
      }).catch(error => {
        console.error(`[SubscriptionEngine] ❌ Failed to load ${configKey} for ${actor.id}:`, error);
        return 0;
      })
    );
    return 0; // Will be counted when promise resolves
  }

  // Create new subscription via engine
  engineSubscriptions.push(
    loadMethod.call(engine, configCoId, (updatedConfig) => {
      updateHandler.call(subscriptionEngine, actor.id, updatedConfig);
    }).then(() => {
      const subscriptionEntry = subscriptionMap?.get(configCoId);
      if (subscriptionEntry && subscriptionEntry.unsubscribe) {
        // Initialize ref count to 1 (this actor)
        subscriptionEntry.refCount = 1;
        
        if (!actor._subscriptions) {
          actor._subscriptions = [];
        }
        // Wrap unsubscribe to decrement ref count
        const wrappedUnsubscribe = () => {
          const currentEntry = subscriptionMap?.get(configCoId);
          if (currentEntry && currentEntry.unsubscribe) {
            currentEntry.refCount--;
            if (currentEntry.refCount <= 0) {
              // Last actor unsubscribed - clean up
              currentEntry.unsubscribe();
              subscriptionMap.delete(configCoId);
            }
          }
        };
        actor._subscriptions.push(wrappedUnsubscribe);
        return 1;
      }
      return 0;
    }).catch(error => {
      console.error(`[SubscriptionEngine] ❌ Failed to subscribe to ${configKey} for ${actor.id}:`, error);
      return 0;
    })
  );

  return 0; // Will be counted when promise resolves
}

/**
 * Collect view/style/state subscriptions (go through engines)
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {Object} actor - Actor instance
 * @param {Object} config - Actor config
 * @returns {Promise<{engineSubscriptions: Array<Promise>, subscriptionCount: number}>}
 */
export async function collectViewStyleStateSubscriptions(subscriptionEngine, actor, config) {
  const engineSubscriptions = [];
  let subscriptionCount = 0;

  // Collect view subscription
  subscriptionCount += collectEngineSubscription(
    subscriptionEngine,
    actor,
    'view',
    config.view,
    subscriptionEngine.viewEngine,
    'viewSubscriptions',
    subscriptionEngine.viewEngine?.loadView,
    subscriptionEngine._handleViewUpdate,
    engineSubscriptions
  );

  // Collect style subscription
  subscriptionCount += collectEngineSubscription(
    subscriptionEngine,
    actor,
    'style',
    config.style,
    subscriptionEngine.styleEngine,
    'styleSubscriptions',
    subscriptionEngine.styleEngine?.loadStyle,
    subscriptionEngine._handleStyleUpdate,
    engineSubscriptions
  );

  // Collect brand subscription (uses styleEngine)
  subscriptionCount += collectEngineSubscription(
    subscriptionEngine,
    actor,
    'brand',
    config.brand,
    subscriptionEngine.styleEngine,
    'styleSubscriptions',
    subscriptionEngine.styleEngine?.loadStyle,
    subscriptionEngine._handleStyleUpdate,
    engineSubscriptions
  );

  // Collect state subscription
  subscriptionCount += collectEngineSubscription(
    subscriptionEngine,
    actor,
    'state',
    config.state,
    subscriptionEngine.stateEngine,
    'stateSubscriptions',
    subscriptionEngine.stateEngine?.loadStateDef,
    subscriptionEngine._handleStateUpdate,
    engineSubscriptions
  );

  return { engineSubscriptions, subscriptionCount };
}

/**
 * Collect context subscriptions (use pure stores from read() API)
 * Note: Interface subscriptions removed - topics handle message routing now
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {Object} actor - Actor instance
 * @param {Object} config - Actor config
 * @returns {Promise<Array>} Array of subscription promises
 */
export async function collectInterfaceContextSubscriptions(subscriptionEngine, actor, config) {
  const subscriptions = [];

  // Note: Interface subscriptions removed - topics handle message routing now

  // Collect context subscription using pure store
  if (config.context && config.context.startsWith('co_z')) {
    try {
      // Extract schema co-id from context CoValue's headerMeta.$schema using fromCoValue pattern
      const contextSchemaStore = await subscriptionEngine.dbEngine.execute({
        op: 'schema',
        fromCoValue: config.context
      });
      const contextSchemaCoId = contextSchemaStore.value?.$id;
      if (contextSchemaCoId) {
        subscriptions.push(
          subscriptionEngine.dbEngine.execute({
            op: 'read',
            schema: contextSchemaCoId,
            key: config.context
          }).then(async (store) => {
            // Subscribe to store updates
            const unsubscribe = store.subscribe((updatedContextDef) => {
              if (updatedContextDef) {
                // Extract context without metadata ($schema, $id)
                const { $schema, $id, ...context } = updatedContextDef;
                subscriptionEngine._handleContextUpdate(actor.id, context);
              }
            });
            
            // Store unsubscribe function
            if (!actor._subscriptions) {
              actor._subscriptions = [];
            }
            actor._subscriptions.push(unsubscribe);
            
            return unsubscribe;
          }).catch(error => {
            console.error(`[SubscriptionEngine] ❌ Failed to subscribe to context for ${actor.id}:`, error);
          })
        );
      }
    } catch (error) {
      console.error(`[SubscriptionEngine] ❌ Failed to extract context schema co-id for ${actor.id}:`, error);
    }
  }

  return subscriptions;
}

/**
 * Execute context subscriptions and engine subscriptions in parallel
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {Object} actor - Actor instance
 * @param {Array} interfaceContextSubscriptions - Context subscription promises (renamed for backward compatibility)
 * @param {Array} engineSubscriptions - Engine subscription promises
 * @returns {Promise<number>} Total subscription count
 */
export async function executeBatchSubscriptions(subscriptionEngine, actor, interfaceContextSubscriptions, engineSubscriptions) {
  let subscriptionCount = 0;

  // Execute context subscriptions and engine subscriptions in parallel
  const contextPromise = interfaceContextSubscriptions.length > 0 
    ? Promise.all(interfaceContextSubscriptions).then(() => {
        // Subscriptions are already stored in actor._subscriptions by collectInterfaceContextSubscriptions (unified for data + configs)
        subscriptionCount += interfaceContextSubscriptions.length;
      }).catch(error => {
        console.error(`[SubscriptionEngine] ❌ Context subscription failed for ${actor.id}:`, error);
      })
    : Promise.resolve();

  // Wait for all subscriptions (context + engines) to complete
  await Promise.all([contextPromise, ...engineSubscriptions]);

  return subscriptionCount;
}
