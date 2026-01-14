/**
 * Query Subscribe Tool - Subscribe actor to reactive query
 * 
 * Sets up a reactive subscription to a collection. When the collection changes,
 * the actor's context is automatically updated and the actor is re-rendered.
 * 
 * Parameters:
 * - schema: Collection name (e.g., 'todos')
 * - filter: Optional filter config { field, op, value }
 * - target: Context field to update (e.g., 'todos')
 * 
 * Example:
 * {
 *   "tool": "@query/subscribe",
 *   "payload": {
 *     "schema": "todos",
 *     "filter": { "field": "done", "op": "eq", "value": false },
 *     "target": "todosTodo"
 *   }
 * }
 */
export default {
  async execute(actor, payload) {
  const { schema, filter, target } = payload;
  if (!actor) {
    throw new Error('@query/subscribe requires actor context');
  }

  if (!schema) {
    throw new Error('@query/subscribe requires schema parameter');
  }

  if (!target) {
    throw new Error('@query/subscribe requires target parameter');
  }

  const store = actor.actorEngine.reactiveStore;
  if (!store) {
    throw new Error('ReactiveStore not initialized in ActorEngine');
  }

  console.log(`[query/subscribe] Subscribing ${actor.id} to ${schema}${filter ? ' (filtered)' : ''} → context.${target}`);

  // Check if we already have a subscription for this schema+target combination
  // This prevents duplicate subscriptions when state machine re-enters loading state
  const subscriptionKey = `${schema}:${target}:${JSON.stringify(filter || null)}`;
  if (!actor._queryObserverKeys) {
    actor._queryObserverKeys = new Map();
  }
  
  // Unsubscribe existing subscription for this key if it exists
  if (actor._queryObserverKeys.has(subscriptionKey)) {
    const existingUnsubscribe = actor._queryObserverKeys.get(subscriptionKey);
    console.log(`[query/subscribe] Unsubscribing existing subscription for ${subscriptionKey}`);
    existingUnsubscribe();
    actor._queryObserverKeys.delete(subscriptionKey);
    
    // Also remove from _queryObservers array
    if (actor._queryObservers) {
      const index = actor._queryObservers.indexOf(existingUnsubscribe);
      if (index > -1) {
        actor._queryObservers.splice(index, 1);
      }
    }
  }

  // Track if this is the initial subscription (to avoid double render)
  let isInitialCall = true;
  
  // Subscribe to collection changes
  const unsubscribe = store.subscribe(schema, filter || null, (data) => {
    // Update actor context
    actor.context[target] = data;
    
    console.log(`[query/subscribe] Updated ${actor.id}.context.${target} with ${data.length} items`);
    
    // Skip re-render on initial subscription call - state machine transition will handle it
    // Only re-render on subsequent updates (when data actually changes)
    if (isInitialCall) {
      isInitialCall = false;
      console.log(`[query/subscribe] Skipping re-render on initial subscription (state machine will handle it)`);
      return;
    }
    
    // Trigger re-render for subsequent updates
    if (actor.actorEngine && actor.id) {
      actor.actorEngine.rerender(actor);
    }
  });

  // Store unsubscribe function for cleanup
  if (!actor._queryObservers) {
    actor._queryObservers = [];
  }
  actor._queryObservers.push(unsubscribe);
  actor._queryObserverKeys.set(subscriptionKey, unsubscribe);

  return {
    success: true,
    schema,
    target,
    hasFilter: !!filter
  };
  }
};
