/**
 * dragEnd Tool - Ends a drag operation
 * Clears drag state and removes dropzone highlighting
 */
export default {
  async execute(actor, payload) {
    // CRDT-FIRST: Persist drag state clearing to context CoValue
    const draggedId = actor.context.draggedItemId;
    const draggedItemIds = actor.context.draggedItemIds || {};
    
    // Clear this item from draggedItemIds object
    if (draggedId && draggedItemIds[draggedId]) {
      delete draggedItemIds[draggedId];
    }
    
    // Persist cleared drag state to CRDT CoValue using operations API
    if (actor.actorEngine) {
      await actor.actorEngine.updateContextCoValue(actor, {
        draggedItemId: null,
        draggedEntityType: null,
        dragOverColumn: null,
        draggedItemIds: draggedItemIds
      });
    }
    
    // Trigger re-render to update UI (hide dragging class, clear dropzone highlight)
    if (actor.actorEngine && actor.id) {
      actor.actorEngine.rerender(actor.id);
    }
  }
};
