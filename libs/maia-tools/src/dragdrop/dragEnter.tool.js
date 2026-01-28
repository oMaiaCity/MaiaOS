export default {
  async execute(actor, payload) {
    const { column } = payload;
    
    if (!column) {
      console.warn('[dragdrop/dragEnter] No column specified');
      return;
    }
    
    // CRDT-FIRST: Persist dragOverColumn to context CoValue
    if (actor.actorEngine) {
      await actor.actorEngine.updateContextCoValue(actor, {
        dragOverColumn: column
      });
    }
    
    // CRITICAL: Don't rerender during drag operations - it recreates DOM and causes loops
    // The CSS classes will be applied on the next natural rerender (after drag ends)
    // Check if there's an active drag operation (any drag, not just from this actor)
    const hasActiveDrag = actor.context.draggedItemId !== null && actor.context.draggedItemId !== undefined;
    if (!hasActiveDrag && actor.actorEngine && actor.id) {
      actor.actorEngine.rerender(actor.id);
    }
  }
};
