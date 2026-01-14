/**
 * Generic Drop Tool
 * Handles drop event for any schema/collection
 * Uses @mutation/update to persist changes to ReactiveStore
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
    
    // Use @mutation/update to persist the change to ReactiveStore
    // This will automatically trigger reactive subscriptions and update filtered arrays
    const toolEngine = actor.actorEngine?.toolEngine;
    if (!toolEngine) {
      console.error('[dragdrop/drop] ToolEngine not available');
      return;
    }
    
    try {
      // Update the entity using mutation tool (persists to localStorage)
      await toolEngine.execute('@mutation/update', actor, {
        schema,
        id: draggedId,
        data: { [field]: value }
      });
      
      // Clear drag state (dragOverColumn will be cleared by @dragdrop/end)
      actor.context.draggedItemId = null;
      actor.context.draggedEntityType = null;
      
      console.log(`✅ [dragdrop/drop] Dropped ${schema}/${draggedId}, set ${field} = ${value}`);
    } catch (error) {
      console.error(`[dragdrop/drop] Failed to update ${schema}/${draggedId}:`, error);
      throw error;
    }
  }
};
