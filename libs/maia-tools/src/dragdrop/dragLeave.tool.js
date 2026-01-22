export default {
  async execute(actor, payload) {
    const { column } = payload;
    
    if (!column) {
      console.warn('[dragdrop/dragLeave] No column specified');
      return;
    }
    
    // Only clear if this is the currently highlighted column
    // (prevents flickering when dragging over child elements)
    if (actor.context.dragOverColumn === column) {
      actor.context.dragOverColumn = null;
      
      // CRITICAL: Don't rerender during drag operations - it recreates DOM and causes loops
      // The CSS classes will be applied on the next natural rerender (after drag ends)
      // Check if there's an active drag operation (any drag, not just from this actor)
      const hasActiveDrag = actor.context.draggedItemId !== null && actor.context.draggedItemId !== undefined;
      if (!hasActiveDrag && actor.actorEngine && actor.id) {
        actor.actorEngine.rerender(actor.id);
      }
      
      console.log(`✅ [dragdrop/dragLeave] Cleared highlight for column: ${column}`);
    }
  }
};
