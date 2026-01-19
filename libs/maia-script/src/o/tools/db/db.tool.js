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
 *   {"tool": "@db", "payload": {"op": "query", "schema": "@schema/todos"}}
 *   {"tool": "@db", "payload": {"op": "create", "schema": "@schema/todos", "data": {...}}}
 *   {"tool": "@db", "payload": {"op": "update", "schema": "@schema/todos", "id": "123", "data": {...}}}
 *   {"tool": "@db", "payload": {"op": "delete", "schema": "@schema/todos", "id": "123"}}
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
    
    // Execute database operation
    const result = await os.db(payload);
    
    // For create operations, store last created ID/text for state machine access
    if (payload.op === 'create' && result) {
      actor.context.lastCreatedId = result.id;
      actor.context.lastCreatedText = result.text;
    }
    
    return result;
  }
};
