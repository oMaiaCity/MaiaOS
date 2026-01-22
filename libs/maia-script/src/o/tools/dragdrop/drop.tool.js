/**
 * Generic Drop Tool
 * Handles drop event for any schema/collection
 * Uses @db to persist changes to database
 */
export default {
  async execute(actor, payload) {
    const { schema, field = 'done', value } = payload;
    
    // Get dragged item ID from context (set by @dragdrop/start)
    const draggedId = actor.context.draggedItemId;
    if (!draggedId) {
      console.warn('[dragdrop/drop] No draggedItemId in context');
      return;
    }
    
    // Schema should already be a co-id (transformed during seeding)
    // Enforce co-id usage - no runtime resolution
    if (!schema || !schema.startsWith('co_z')) {
      throw new Error(`[dragdrop/drop] Schema must be a co-id (co_z...), got: ${schema}. Query objects should be transformed during seeding.`);
    }
    
    // Use @db to persist the change
    // This will automatically trigger reactive subscriptions and update filtered arrays
    const toolEngine = actor.actorEngine?.toolEngine;
    if (!toolEngine) {
      console.error('[dragdrop/drop] ToolEngine not available');
      return;
    }
    
    try {
      // Update the entity using @db tool
      // This will automatically trigger reactive subscriptions and update filtered arrays
      await toolEngine.execute('@db', actor, {
        op: 'update',
        schema: schema, // Use co-id directly
        id: draggedId,
        data: { [field]: value }
      });
      
      // Drag state will be cleared by @dragdrop/end in SUCCESS action
      console.log(`✅ [dragdrop/drop] Dropped ${schema}/${draggedId}, set ${field} = ${value}`);
    } catch (error) {
      console.error(`[dragdrop/drop] Failed to update ${schema}/${draggedId}:`, error);
      throw error;
    }
  }
};
