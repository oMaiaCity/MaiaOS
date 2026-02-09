/**
 * Sparks Tool - @sparks
 * 
 * Domain-specific tool for managing Sparks (collaborative spaces/groups)
 * Routes operations to maia.db() operation engine with spark-specific operations
 * 
 * CRUD Operations:
 *   {"tool": "@sparks", "payload": {"op": "createSpark", "name": "My Spark"}}
 *   {"tool": "@sparks", "payload": {"op": "readSpark"}}
 *   {"tool": "@sparks", "payload": {"op": "readSpark", "id": "co_z..."}}
 *   {"tool": "@sparks", "payload": {"op": "updateSpark", "id": "co_z...", "data": {...}}}
 *   {"tool": "@sparks", "payload": {"op": "deleteSpark", "id": "co_z..."}}
 * 
 * Member Management:
 *   {"tool": "@sparks", "payload": {"op": "addSparkMember", "id": "co_z...", "memberId": "co_z...", "role": "writer"}}
 *   {"tool": "@sparks", "payload": {"op": "removeSparkMember", "id": "co_z...", "memberId": "co_z..."}}
 *   {"tool": "@sparks", "payload": {"op": "updateSparkMemberRole", "id": "co_z...", "memberId": "co_z...", "role": "admin"}}
 *   {"tool": "@sparks", "payload": {"op": "getSparkMembers", "id": "co_z..."}}
 * 
 * Parent Group Management (Hierarchical Access):
 *   {"tool": "@sparks", "payload": {"op": "addSparkParentGroup", "id": "co_z...", "parentGroupId": "co_z...", "role": "extend"}}
 *   {"tool": "@sparks", "payload": {"op": "removeSparkParentGroup", "id": "co_z...", "parentGroupId": "co_z..."}}
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
