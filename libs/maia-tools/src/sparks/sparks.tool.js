/**
 * Sparks Tool - @sparks
 * 
 * Domain-specific tool for managing Sparks (collaborative spaces/groups)
 * Routes operations to maia.db() operation engine with spark-specific operations
 * 
 * Usage in state machines:
 *   {"tool": "@sparks", "payload": {"op": "createSpark", "name": "My Spark"}}
 *   {"tool": "@sparks", "payload": {"op": "readSpark"}}
 *   {"tool": "@sparks", "payload": {"op": "readSpark", "id": "co_z..."}}
 *   {"tool": "@sparks", "payload": {"op": "updateSpark", "id": "co_z...", "data": {...}}}
 *   {"tool": "@sparks", "payload": {"op": "deleteSpark", "id": "co_z..."}}
 * 
 * Future operations (to be added):
 *   {"tool": "@sparks", "payload": {"op": "addMember", "id": "co_z...", "memberId": "co_z..."}}
 *   {"tool": "@sparks", "payload": {"op": "removeMember", "id": "co_z...", "memberId": "co_z..."}}
 *   {"tool": "@sparks", "payload": {"op": "updatePermissions", "id": "co_z...", "memberId": "co_z...", "role": "admin"}}
 *   {"tool": "@sparks", "payload": {"op": "getMembers", "id": "co_z..."}}
 */
export default {
  async execute(actor, payload) {
    if (!actor) {
      throw new Error('[@sparks] Actor context required');
    }
    
    // Get MaiaOS instance from actor engine
    const os = actor.actorEngine.os;
    if (!os || !os.db) {
      throw new Error('[@sparks] Database engine not available');
    }
    
    // Execute spark operation via DBEngine
    // The payload is passed directly to os.db() which routes to spark operations
    const result = await os.db(payload);
    
    // Return result - state machines handle context updates via updateContext actions in SUCCESS handlers
    // Tools should not directly manipulate context - all updates flow through state machines
    return result;
  }
};
