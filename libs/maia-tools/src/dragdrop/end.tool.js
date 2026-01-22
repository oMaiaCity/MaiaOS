/**
 * dragEnd Tool - Ends a drag operation
 * Clears drag state and removes dropzone highlighting
 */
export default {
  async execute(actor, payload) {
    // Clear drag state
    const draggedId = actor.context.draggedItemId;
    actor.context.draggedItemId = null;
    actor.context.draggedEntityType = null;
    actor.context.dragOverColumn = null;
    
    // Clear this item from draggedItemIds object
    if (actor.context.draggedItemIds && draggedId) {
      delete actor.context.draggedItemIds[draggedId];
    }
    
    // Trigger re-render to update UI (hide dragging class, clear dropzone highlight)
    if (actor.actorEngine && actor.id) {
      actor.actorEngine.rerender(actor.id);
    }
  }
};
