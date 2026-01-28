/**
 * dragEnd Tool - Ends a drag operation
 * Clears drag state and removes dropzone highlighting
 */
export default {
  async execute(actor, payload) {
    console.log('[dragdrop/end] Executing, context:', actor.context);
    // Return cleared drag state - state machines handle context updates via updateContext actions in SUCCESS handlers
    // Tools should not directly manipulate context - all updates flow through state machines
    const draggedId = actor.context.draggedItemId;
    const draggedItemIds = actor.context.draggedItemIds || {};
    
    // Clear this item from draggedItemIds object
    if (draggedId && draggedItemIds[draggedId]) {
      delete draggedItemIds[draggedId];
    }
    
    // Return cleared drag state for state machine to update context
    const result = {
      draggedItemId: null,
      dragOverColumn: null,
      draggedItemIds: draggedItemIds
    };
    console.log('[dragdrop/end] Returning result:', result);
    return result;
  }
};
