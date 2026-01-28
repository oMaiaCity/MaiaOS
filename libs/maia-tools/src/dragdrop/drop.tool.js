/**
 * Generic Drop Tool
 * Handles drop event for any schema/collection
 * Uses @db to persist changes to database
 * 
 * Schema is extracted from CoValue headerMeta by update operation internally
 * NO schema handling needed in tools - operations handle it "under the hood"
 */
export default {
  async execute(actor, payload) {
    console.log('[dragdrop/drop] Executing with payload:', payload, 'context:', actor.context);
    const { field = 'done', value } = payload;
    
    // Get dragged item ID from context (set by @dragdrop/start)
    // More resilient: check both draggedItemId and draggedItemIds object
    const draggedId = actor.context.draggedItemId || 
      (actor.context.draggedItemIds && Object.keys(actor.context.draggedItemIds).find(id => actor.context.draggedItemIds[id]));
    
    console.log('[dragdrop/drop] Dragged ID:', draggedId);
    
    if (!draggedId) {
      // Silently skip if no drag operation in progress (may happen during rapid state changes)
      // This is more resilient than throwing an error
      console.warn('[dragdrop/drop] No dragged item found in context, skipping');
      return;
    }
    
    // Use @db to persist the change
    // This will automatically trigger reactive subscriptions and update filtered arrays
    // Schema is automatically extracted from CoValue headerMeta by update operation
    const toolEngine = actor.actorEngine?.toolEngine;
    if (!toolEngine) {
      console.error('[dragdrop/drop] ToolEngine not available');
      return;
    }
    
    try {
      console.log('[dragdrop/drop] Updating entity:', { id: draggedId, field, value });
      // Update the entity using @db tool
      // Schema is automatically extracted from CoValue headerMeta by update operation
      await toolEngine.execute('@db', actor, {
        op: 'update',
        id: draggedId,
        data: { [field]: value }
      });
      
      console.log('[dragdrop/drop] Update successful');
      // Drag state will be cleared by @dragdrop/end in SUCCESS action
    } catch (error) {
      console.error(`[dragdrop/drop] Failed to update ${draggedId}:`, error);
      throw error;
    }
  }
};
