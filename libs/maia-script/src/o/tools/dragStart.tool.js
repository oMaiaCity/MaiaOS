/**
 * dragStart Tool - Starts a drag operation
 */
export default {
  async execute(actor, payload) {
    actor.context.draggedItemId = payload.id;
    console.log('✅ Started dragging:', payload.id);
  }
};
