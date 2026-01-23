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
  const existingUnsubscribe = subscriptionMap?.get(configCoId);
  
  if (existingUnsubscribe) {
    // Subscription already exists, reuse it
    if (!actor._subscriptions) {
      actor._subscriptions = [];
    }
    actor._subscriptions.push(existingUnsubscribe);
    return 1;
  }

  // Create new subscription via engine
  engineSubscriptions.push(
    loadMethod.call(engine, configCoId, (updatedConfig) => {
      updateHandler.call(subscriptionEngine, actor.id, updatedConfig);
    }).then(() => {
      const unsubscribe = subscriptionMap?.get(configCoId);
      if (unsubscribe) {
        if (!actor._subscriptions) {
          actor._subscriptions = [];
        }
        actor._subscriptions.push(unsubscribe);
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
 * Collect interface/context subscriptions (use pure stores from read() API)
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {Object} actor - Actor instance
 * @param {Object} config - Actor config
 * @returns {Promise<Array>} Array of subscription promises
 */
export async function collectInterfaceContextSubscriptions(subscriptionEngine, actor, config) {
  const subscriptions = [];

  // Collect interface subscription using pure store
  if (config.interface && config.interface.startsWith('co_z')) {
    try {
      const interfaceSchemaCoId = await subscriptionEngine.dbEngine.getSchemaCoId('interface');
      if (interfaceSchemaCoId) {
        subscriptions.push(
          subscriptionEngine.dbEngine.execute({
            op: 'read',
            schema: interfaceSchemaCoId,
            key: config.interface
          }).then(async (store) => {
            // Subscribe to store updates
            const unsubscribe = store.subscribe((updatedInterface) => {
              if (updatedInterface) {
                subscriptionEngine._handleInterfaceUpdate(actor.id, updatedInterface);
              }
            });
            
            // Store unsubscribe function
            if (!actor._subscriptions) {
              actor._subscriptions = [];
            }
            actor._subscriptions.push(unsubscribe);
            
            return unsubscribe;
          }).catch(error => {
            console.error(`[SubscriptionEngine] ❌ Failed to subscribe to interface for ${actor.id}:`, error);
          })
        );
      }
    } catch (error) {
      console.error(`[SubscriptionEngine] ❌ Failed to get interface schema co-id for ${actor.id}:`, error);
    }
  }

  // Collect context subscription using pure store
  if (config.context && config.context.startsWith('co_z')) {
    try {
      const contextSchemaCoId = await subscriptionEngine.dbEngine.getSchemaCoId('context');
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
      console.error(`[SubscriptionEngine] ❌ Failed to get context schema co-id for ${actor.id}:`, error);
    }
  }

  return subscriptions;
}

/**
 * Execute interface/context subscriptions and engine subscriptions in parallel
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {Object} actor - Actor instance
 * @param {Array} interfaceContextSubscriptions - Interface/context subscription promises
 * @param {Array} engineSubscriptions - Engine subscription promises
 * @returns {Promise<number>} Total subscription count
 */
export async function executeBatchSubscriptions(subscriptionEngine, actor, interfaceContextSubscriptions, engineSubscriptions) {
  let subscriptionCount = 0;

  // Execute interface/context subscriptions and engine subscriptions in parallel
  const interfaceContextPromise = interfaceContextSubscriptions.length > 0 
    ? Promise.all(interfaceContextSubscriptions).then(() => {
        // Subscriptions are already stored in actor._subscriptions by collectInterfaceContextSubscriptions (unified for data + configs)
        subscriptionCount += interfaceContextSubscriptions.length;
      }).catch(error => {
        console.error(`[SubscriptionEngine] ❌ Interface/context subscription failed for ${actor.id}:`, error);
      })
    : Promise.resolve();

  // Wait for all subscriptions (interface/context + engines) to complete
  await Promise.all([interfaceContextPromise, ...engineSubscriptions]);

  return subscriptionCount;
}
