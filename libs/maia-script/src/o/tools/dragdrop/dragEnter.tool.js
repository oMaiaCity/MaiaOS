export default {
  async execute(actor, payload) {
    const { column } = payload;
    
    if (!column) {
      console.warn('[dragdrop/dragEnter] No column specified');
      return;
    }
    
    // Update context to highlight this dropzone
    actor.context.dragOverColumn = column;
    
    // Trigger re-render to update CSS classes
    if (actor.actorEngine && actor.id) {
      actor.actorEngine.rerender(actor);
    }
    
    console.log(`✅ [dragdrop/dragEnter] Highlighting column: ${column}`);
  }
};
