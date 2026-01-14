/**
 * dragEnd Tool - Ends a drag operation
 * Clears drag state and removes dropzone highlighting
 */
export default {
  async execute(actor, payload) {
    // Clear drag state
    actor.context.draggedItemId = null;
    actor.context.draggedEntityType = null;
    actor.context.dragOverColumn = null;
    
    // Trigger re-render to update UI (hide dragging class, clear dropzone highlight)
    if (actor.actorEngine && actor.id) {
      actor.actorEngine.rerender(actor);
    }
    
    console.log('✅ [dragdrop/end] Ended dragging, cleared drag state');
  }
};
