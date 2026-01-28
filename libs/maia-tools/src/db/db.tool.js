/**
 * Database Tool - @db
 * 
 * Unified API for all database operations
 * Routes operations to maia.db() operation engine
 * 
 * Note: Reactive subscriptions are now handled by SubscriptionEngine via context query objects.
 * State machines should use context-driven approach instead of manual @db subscriptions.
 * 
 * Usage in state machines:
 *   {"tool": "@db", "payload": {"op": "create", "schema": "co_z...", "data": {...}}}
 *   {"tool": "@db", "payload": {"op": "update", "schema": "co_z...", "id": "co_z...", "data": {...}}}
 *   {"tool": "@db", "payload": {"op": "delete", "schema": "co_z...", "id": "co_z..."}}
 * 
 * Note: 100% migration to co-ids - NO human-readable fallbacks.
 * State machine entry actions MUST be transformed during seeding (payload.schema → co-id).
 * This tool ONLY accepts co-ids (co_z...) for data collection operations.
 */
export default {
  async execute(actor, payload) {
    if (!actor) {
      throw new Error('[@db] Actor context required');
    }
    
    // Get MaiaOS instance from actor engine
    const os = actor.actorEngine.os;
    if (!os || !os.db) {
      throw new Error('[@db] Database engine not available');
    }
    
    // For data collection operations (create, update, delete), schema MUST be a co-id
    // 100% migration: NO human-readable fallbacks - all schemas must be transformed during seeding
    const dataCollectionOps = ['create', 'update', 'delete'];
    if (dataCollectionOps.includes(payload.op) && payload.schema) {
      // Schema MUST be a co-id (transformed during seeding)
      // If it's not a co-id, that's an error - transformation should have happened during seeding
      if (!payload.schema.startsWith('co_z')) {
        throw new Error(`[@db] Schema must be a co-id (co_z...), got: ${payload.schema}. State machine entry actions should be transformed during seeding. No human-readable fallbacks allowed.`);
      }
      // Schema is already a co-id, use it directly
    }
    
    // Execute database operation
    const result = await os.db(payload);
    
    // For create operations, store last created ID/text for state machine access
    // CRDT-FIRST: Persist to context CoValue instead of mutating in-memory
    if (payload.op === 'create' && result && actor.actorEngine) {
      const lastCreatedId = result.id || result.$id || result;
      const lastCreatedText = result.text || result.data?.text || payload.data?.text || '';
      
      // Persist to CRDT CoValue using operations API
      await actor.actorEngine.updateContextCoValue(actor, {
        lastCreatedId,
        lastCreatedText
      });
    }
    
    return result;
  }
};
