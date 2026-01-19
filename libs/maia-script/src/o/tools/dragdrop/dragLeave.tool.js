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
      
      // Trigger re-render to update CSS classes
      if (actor.actorEngine && actor.id) {
        actor.actorEngine.rerender(actor.id);
      }
      
      console.log(`✅ [dragdrop/dragLeave] Cleared highlight for column: ${column}`);
    }
  }
};
