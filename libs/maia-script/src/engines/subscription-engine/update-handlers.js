/**
 * Config Update Handlers Module
 * 
 * Handles updates to config CRDTs and triggers appropriate actor updates.
 */

/**
 * Handle view update - invalidate cache, update actor, re-render
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {string} actorId - Actor ID
 * @param {Object} newViewDef - Updated view definition
 */
export function handleViewUpdate(subscriptionEngine, actorId, newViewDef) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) return;

  // Update actor's view definition
  actor.viewDef = newViewDef;

  // Trigger re-render
  subscriptionEngine._scheduleRerender(actorId);
}

/**
 * Handle style update - invalidate cache, reload stylesheets, re-render
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {string} actorId - Actor ID
 * @param {Object} newStyleDef - Updated style definition
 */
export async function handleStyleUpdate(subscriptionEngine, actorId, newStyleDef) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) return;

  // Cache is already updated by loadStyle subscription callback
  // Reload stylesheets and re-render
  try {
    const styleSheets = await subscriptionEngine.styleEngine.getStyleSheets(actor.config);
    // Update shadow root stylesheets
    actor.shadowRoot.adoptedStyleSheets = styleSheets;
    
    // Trigger re-render (styles changed, need to re-render to apply)
    subscriptionEngine._scheduleRerender(actorId);
  } catch (error) {
    console.error(`[SubscriptionEngine] Failed to update styles for ${actorId}:`, error);
  }
}

/**
 * Handle state update - destroy old machine, create new machine
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {string} actorId - Actor ID
 * @param {Object} newStateDef - Updated state definition
 */
export async function handleStateUpdate(subscriptionEngine, actorId, newStateDef) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor || !subscriptionEngine.stateEngine) return;

  try {
    // Destroy old machine
    if (actor.machine) {
      subscriptionEngine.stateEngine.destroyMachine(actor.machine.id);
    }

    // Create new machine
    actor.machine = await subscriptionEngine.stateEngine.createMachine(newStateDef, actor);

    // Trigger re-render (state machine changes may affect UI)
    subscriptionEngine._scheduleRerender(actorId);
  } catch (error) {
    console.error(`[SubscriptionEngine] Failed to update state machine for ${actorId}:`, error);
  }
}

/**
 * Handle interface update - reload interface, re-validate
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {string} actorId - Actor ID
 * @param {Object} newInterfaceDef - Updated interface definition
 */
export async function handleInterfaceUpdate(subscriptionEngine, actorId, newInterfaceDef) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) return;

  // Update actor's interface
  actor.interface = newInterfaceDef;

  // Re-validate interface (non-blocking)
  try {
    await subscriptionEngine.actorEngine.toolEngine.execute('@interface/validateInterface', actor, {
      interfaceDef: newInterfaceDef,
      actorId
    });
  } catch (error) {
    console.warn(`[SubscriptionEngine] Interface validation failed for ${actorId}:`, error);
  }

  // Note: Interface changes don't require re-render (only affects message validation)
}

/**
 * Handle context update - merge with existing context, preserve query subscriptions
 * @param {Object} subscriptionEngine - SubscriptionEngine instance
 * @param {string} actorId - Actor ID
 * @param {Object} newContext - Updated context (without $schema/$id)
 */
export async function handleContextUpdate(subscriptionEngine, actorId, newContext) {
  const actor = subscriptionEngine.actorEngine.getActor(actorId);
  if (!actor) return;

  // Merge new context with existing context
  // Preserve query subscriptions (they're managed separately)
  const existingContext = actor.context || {};
  
  // Merge contexts (new values override existing)
  actor.context = { ...existingContext, ...newContext };

  // Re-subscribe to any new query objects in the updated context
  // This handles new query objects added to context
  const { subscribeToContext } = await import('./data-subscriptions.js');
  await subscribeToContext(subscriptionEngine, actor);

  // Trigger re-render
  subscriptionEngine._scheduleRerender(actorId);
}
