/**
 * Query Get Tool - One-time (non-reactive) query
 * 
 * Loads data from a collection into actor context once. Unlike @query/subscribe,
 * this does NOT set up reactive updates. Use for one-time data loading.
 * 
 * Parameters:
 * - schema: Collection name (e.g., 'todos')
 * - target: Context field to populate (e.g., 'todos')
 * 
 * Example:
 * {
 *   "tool": "@query/get",
 *   "payload": {
 *     "schema": "todos",
 *     "target": "todos"
 *   }
 * }
 */
export default {
  async execute(actor, payload) {
  const { schema, target } = payload;
  if (!actor) {
    throw new Error('@query/get requires actor context');
  }

  if (!schema) {
    throw new Error('@query/get requires schema parameter');
  }

  if (!target) {
    throw new Error('@query/get requires target parameter');
  }

  const store = actor.actorEngine.reactiveStore;
  if (!store) {
    throw new Error('ReactiveStore not initialized in ActorEngine');
  }

  // Get collection data
  const data = store.getCollection(schema);
  
  // Update actor context
  actor.context[target] = data;
  
  console.log(`✅ [query/get] Loaded ${data.length} items from ${schema} → ${actor.id}.context.${target}`);

  return {
    success: true,
    schema,
    target,
    count: data.length
  };
  }
};
