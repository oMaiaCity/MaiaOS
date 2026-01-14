/**
 * Query Filter Tool - Apply JSON-based filter to query results
 * 
 * Performs a one-time filtered query on a collection. Non-reactive.
 * For reactive filtered queries, use @query/subscribe with filter parameter.
 * 
 * Parameters:
 * - schema: Collection name (e.g., 'todos')
 * - filter: Filter config { field, op, value }
 * - target: Context field to populate with filtered results
 * 
 * Supported operators:
 * - eq: equals (===)
 * - ne: not equals (!==)
 * - gt: greater than (>)
 * - lt: less than (<)
 * - gte: greater than or equal (>=)
 * - lte: less than or equal (<=)
 * - in: value in array
 * - contains: string contains substring
 * 
 * Example:
 * {
 *   "tool": "@query/filter",
 *   "payload": {
 *     "schema": "todos",
 *     "filter": { "field": "done", "op": "eq", "value": false },
 *     "target": "incompleteTodos"
 *   }
 * }
 */
export default {
  async execute(actor, payload) {
  const { schema, filter, target } = payload;
  if (!actor) {
    throw new Error('@query/filter requires actor context');
  }

  if (!schema) {
    throw new Error('@query/filter requires schema parameter');
  }

  if (!filter) {
    throw new Error('@query/filter requires filter parameter');
  }

  if (!target) {
    throw new Error('@query/filter requires target parameter');
  }

  const store = actor.actorEngine.reactiveStore;
  if (!store) {
    throw new Error('ReactiveStore not initialized in ActorEngine');
  }

  // Query with filter
  const data = store.query(schema, filter);
  
  // Update actor context
  actor.context[target] = data;
  
  console.log(`✅ [query/filter] Filtered ${schema} (${filter.field} ${filter.op} ${filter.value}) → ${actor.id}.context.${target} (${data.length} items)`);

  return {
    success: true,
    schema,
    target,
    filter,
    count: data.length
  };
  }
};
