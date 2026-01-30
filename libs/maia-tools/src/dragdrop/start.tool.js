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
    const { id } = payload;
    
    if (!id) {
      throw new Error('[dragdrop/start] ID is required in payload');
    }
    
    // Return drag state - state machines handle context updates via updateContext actions in SUCCESS handlers
    // Tools should not directly manipulate context - all updates flow through state machines
    // Initialize draggedItemIds object if needed
    const draggedItemIds = actor.context.draggedItemIds || {};
    
    // Start new drag operation (sequential processing ensures no parallel drag starts)
    draggedItemIds[id] = true;
    
    const result = {
      draggedItemId: id,
      draggedItemIds: draggedItemIds
    };
    
    return result;
  }
};

