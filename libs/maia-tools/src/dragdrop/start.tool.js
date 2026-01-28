/**
 * Generic Drag Start Tool
 * Stores drag information in context for any schema/collection
 * Maintains draggedItemIds object for item-specific lookups (no template comparisons needed)
 * 
 * Schema is extracted from CoValue headerMeta by operations internally (update/delete operations)
 * NO schema handling needed in tools - operations handle it "under the hood"
 */

export default {
  async execute(actor, payload) {
    console.log('[dragdrop/start] Executing with payload:', payload);
    const { id } = payload;
    
    if (!id) {
      console.error('[dragdrop/start] ID is required in payload');
      throw new Error('[dragdrop/start] ID is required in payload');
    }
    
    // Return drag state - state machines handle context updates via updateContext actions in SUCCESS handlers
    // Tools should not directly manipulate context - all updates flow through state machines
    // Initialize draggedItemIds object if needed
    const draggedItemIds = actor.context.draggedItemIds || {};
    
    // Idempotent: If this item is already being dragged, return existing state
    if (draggedItemIds[id] && actor.context.draggedItemId === id) {
      console.log('[dragdrop/start] Item already being dragged, returning existing state');
      return {
        draggedItemId: id,
        draggedItemIds: draggedItemIds
      };
    }
    
    // Start new drag operation
    draggedItemIds[id] = true;
    
    const result = {
      draggedItemId: id,
      draggedItemIds: draggedItemIds
    };
    
    console.log('[dragdrop/start] Returning result:', result);
    return result;
  }
};
