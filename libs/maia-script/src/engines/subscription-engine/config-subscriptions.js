/**
 * Config Subscriptions Module
 * 
 * Handles reactive subscriptions to config CRDTs (view, style, state, interface, context, brand).
 * Makes config files runtime-editable - changes trigger actor updates.
 */

import { subscribeConfigsBatch } from '../../utils/config-loader.js';

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

  // Collect view subscription (if not already subscribed)
  if (config.view && config.view.startsWith('co_z') && subscriptionEngine.viewEngine) {
    const existingUnsubscribe = subscriptionEngine.viewEngine.viewSubscriptions?.get(config.view);
    if (existingUnsubscribe) {
      // Subscription already exists (from createActor), reuse it
      actor._configSubscriptions.push(existingUnsubscribe);
      subscriptionCount++;
    } else {
      // Need to set up subscription via engine (will use batch internally)
      engineSubscriptions.push(
        subscriptionEngine.viewEngine.loadView(config.view, (updatedView) => {
          subscriptionEngine._handleViewUpdate(actor.id, updatedView);
        }).then(() => {
          const unsubscribe = subscriptionEngine.viewEngine.viewSubscriptions?.get(config.view);
          if (unsubscribe) {
            actor._configSubscriptions.push(unsubscribe);
            subscriptionCount++;
          }
        }).catch(error => {
          console.error(`[SubscriptionEngine] ❌ Failed to subscribe to view for ${actor.id}:`, error);
        })
      );
    }
  }

  // Collect style subscription (if not already subscribed)
  if (config.style && config.style.startsWith('co_z') && subscriptionEngine.styleEngine) {
    const existingUnsubscribe = subscriptionEngine.styleEngine.styleSubscriptions?.get(config.style);
    if (existingUnsubscribe) {
      actor._configSubscriptions.push(existingUnsubscribe);
      subscriptionCount++;
    } else {
      engineSubscriptions.push(
        subscriptionEngine.styleEngine.loadStyle(config.style, (updatedStyle) => {
          subscriptionEngine._handleStyleUpdate(actor.id, updatedStyle);
        }).then(() => {
          const unsubscribe = subscriptionEngine.styleEngine.styleSubscriptions?.get(config.style);
          if (unsubscribe) {
            actor._configSubscriptions.push(unsubscribe);
            subscriptionCount++;
          }
        }).catch(error => {
          console.error(`[SubscriptionEngine] ❌ Failed to subscribe to style for ${actor.id}:`, error);
        })
      );
    }
  }

  // Collect brand subscription (if not already subscribed)
  if (config.brand && config.brand.startsWith('co_z') && subscriptionEngine.styleEngine) {
    const existingUnsubscribe = subscriptionEngine.styleEngine.styleSubscriptions?.get(config.brand);
    if (existingUnsubscribe) {
      actor._configSubscriptions.push(existingUnsubscribe);
      subscriptionCount++;
    } else {
      engineSubscriptions.push(
        subscriptionEngine.styleEngine.loadStyle(config.brand, (updatedBrand) => {
          subscriptionEngine._handleStyleUpdate(actor.id, updatedBrand);
        }).then(() => {
          const unsubscribe = subscriptionEngine.styleEngine.styleSubscriptions?.get(config.brand);
          if (unsubscribe) {
            actor._configSubscriptions.push(unsubscribe);
            subscriptionCount++;
          }
        }).catch(error => {
          console.error(`[SubscriptionEngine] ❌ Failed to subscribe to brand for ${actor.id}:`, error);
        })
      );
    }
  }

  // Collect state subscription (if not already subscribed)
  if (config.state && config.state.startsWith('co_z') && subscriptionEngine.stateEngine) {
    const existingUnsubscribe = subscriptionEngine.stateEngine.stateSubscriptions?.get(config.state);
    if (existingUnsubscribe) {
      actor._configSubscriptions.push(existingUnsubscribe);
      subscriptionCount++;
    } else {
      engineSubscriptions.push(
        subscriptionEngine.stateEngine.loadStateDef(config.state, (updatedStateDef) => {
          subscriptionEngine._handleStateUpdate(actor.id, updatedStateDef);
        }).then(() => {
          const unsubscribe = subscriptionEngine.stateEngine.stateSubscriptions?.get(config.state);
          if (unsubscribe) {
            actor._configSubscriptions.push(unsubscribe);
            subscriptionCount++;
          }
        }).catch(error => {
          console.error(`[SubscriptionEngine] ❌ Failed to subscribe to state for ${actor.id}:`, error);
        })
      );
    }
  }

  return { engineSubscriptions, subscriptionCount };
}

/**
 * Collect interface/context subscriptions (use batch API)
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {Object} actor - Actor instance
 * @param {Object} config - Actor config
 * @returns {Promise<Array>} Batch subscription requests
 */
export async function collectInterfaceContextSubscriptions(subscriptionEngine, actor, config) {
  const batchRequests = [];

  // Collect interface subscription for batch API
  if (config.interface && config.interface.startsWith('co_z')) {
    try {
      const interfaceSchemaCoId = await subscriptionEngine.dbEngine.getSchemaCoId('interface');
      if (interfaceSchemaCoId) {
        batchRequests.push({
          schemaRef: interfaceSchemaCoId,
          coId: config.interface,
          configType: 'interface',
          onUpdate: (updatedInterface) => {
            subscriptionEngine._handleInterfaceUpdate(actor.id, updatedInterface);
          },
          cache: null
        });
      }
    } catch (error) {
      console.error(`[SubscriptionEngine] ❌ Failed to get interface schema co-id for ${actor.id}:`, error);
    }
  }

  // Collect context subscription for batch API
  if (config.context && config.context.startsWith('co_z')) {
    try {
      const contextSchemaCoId = await subscriptionEngine.dbEngine.getSchemaCoId('context');
      if (contextSchemaCoId) {
        batchRequests.push({
          schemaRef: contextSchemaCoId,
          coId: config.context,
          configType: 'context',
          onUpdate: (updatedContextDef) => {
            // Extract context without metadata ($schema, $id)
            const { $schema, $id, ...context } = updatedContextDef;
            subscriptionEngine._handleContextUpdate(actor.id, context);
          },
          cache: null
        });
      }
    } catch (error) {
      console.error(`[SubscriptionEngine] ❌ Failed to get context schema co-id for ${actor.id}:`, error);
    }
  }

  return batchRequests;
}

/**
 * Execute batch subscriptions and engine subscriptions in parallel
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {Object} actor - Actor instance
 * @param {Array} batchRequests - Batch subscription requests
 * @param {Array} engineSubscriptions - Engine subscription promises
 * @returns {Promise<number>} Total subscription count
 */
export async function executeBatchSubscriptions(subscriptionEngine, actor, batchRequests, engineSubscriptions) {
  let subscriptionCount = 0;

  // Execute batch subscriptions and engine subscriptions in parallel
  const batchPromise = batchRequests.length > 0 
    ? subscribeConfigsBatch(subscriptionEngine.dbEngine, batchRequests).then(results => {
        results.forEach(({ unsubscribe }) => {
          actor._configSubscriptions.push(unsubscribe);
          subscriptionCount++;
        });
      }).catch(error => {
        console.error(`[SubscriptionEngine] ❌ Batch subscription failed for ${actor.id}:`, error);
      })
    : Promise.resolve();

  // Wait for all subscriptions (batch + engines) to complete
  await Promise.all([batchPromise, ...engineSubscriptions]);

  return subscriptionCount;
}
