/**
 * Database Tool - @db
 * 
 * Unified API for all database operations
 * Routes operations to maia.db() operation engine
 * 
 * Note: Reactive subscriptions are handled via direct read() + ReactiveStore subscriptions.
 * State machines should use context-driven approach instead of manual @db subscriptions.
 * 
 * Usage in state machines:
 *   {"tool": "@db", "payload": {"op": "create", "schema": "co_z...", "data": {...}}}
 *   {"tool": "@db", "payload": {"op": "update", "id": "co_z...", "data": {...}}}
 *   {"tool": "@db", "payload": {"op": "delete", "id": "co_z..."}}
 * 
 * Note: For update/delete operations, schema is extracted from CoValue headerMeta internally.
 * Only create operations require schema parameter (no CoValue exists yet).
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
    
    // For create operations, schema MUST be a co-id (no CoValue exists yet to extract schema from)
    // For update/delete operations, schema is extracted from CoValue headerMeta by operations internally
    // 100% migration: NO human-readable fallbacks - all schemas must be transformed during seeding
    if (payload.op === 'create' && payload.schema) {
      // Schema MUST be a co-id (transformed during seeding)
      // If it's not a co-id, that's an error - transformation should have happened during seeding
      if (!payload.schema.startsWith('co_z')) {
        throw new Error(`[@db] Schema must be a co-id (co_z...), got: ${payload.schema}. State machine entry actions should be transformed during seeding. No human-readable fallbacks allowed.`);
      }
      // Schema is already a co-id, use it directly
    }
    // For update/delete operations, schema is optional - operations extract it from CoValue headerMeta internally
    
    // Execute database operation
    const result = await os.db(payload);
    
    // Return result - state machines handle context updates via updateContext actions in SUCCESS handlers
    // Tools should not directly manipulate context - all updates flow through state machines
    return result;
  }
};
