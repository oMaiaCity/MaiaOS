/**
 * Query Subscribe Tool - Subscribe actor to reactive query
 * 
 * Sets up a reactive subscription to a collection. When the collection changes,
 * the actor's context is automatically updated and the actor is re-rendered.
 * 
 * Fully reactive: Context updates automatically trigger re-renders regardless of timing.
 * 
 * Parameters:
 * - schema: Collection name (e.g., 'todos')
 * - filter: Optional filter config { field, op, value }
 * - target: Context field to update (e.g., 'todos')
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

    // Check if we already have a subscription for this schema+target combination
    // This prevents duplicate subscriptions when the same message is processed multiple times
    const subscriptionKey = `${schema}:${target}:${JSON.stringify(filter || null)}`;
    if (!actor._queryObserverKeys) {
      actor._queryObserverKeys = new Map();
    }
    
    // Unsubscribe existing subscription for this key if it exists
    if (actor._queryObserverKeys.has(subscriptionKey)) {
      const existingUnsubscribe = actor._queryObserverKeys.get(subscriptionKey);
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

    // Track last rendered data to prevent unnecessary re-renders
    if (!actor._lastRenderedData) {
      actor._lastRenderedData = new Map();
    }
    
    // Subscribe to collection changes - fully reactive
    const unsubscribe = store.subscribe(schema, filter || null, (data) => {
      // Update actor context
      const previousData = actor.context[target];
      actor.context[target] = data;
      
      // Check if data actually changed (deep comparison for arrays)
      const dataChanged = JSON.stringify(previousData) !== JSON.stringify(data);
      
      // Always re-render when data changes (fully reactive, timing-independent)
      if (dataChanged && actor.actorEngine && actor.id) {
        // Use requestAnimationFrame to batch multiple rapid updates
        if (actor._pendingRerender) {
          cancelAnimationFrame(actor._pendingRerender);
        }
        actor._pendingRerender = requestAnimationFrame(() => {
          actor._pendingRerender = null;
          actor.actorEngine.rerender(actor);
        });
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
