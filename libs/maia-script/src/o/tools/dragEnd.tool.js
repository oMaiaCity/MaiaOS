/**
 * dragEnd Tool - Ends a drag operation
 */
export default {
  async execute(actor, payload) {
    // Drag end is handled by drop or cancellation
    console.log('✅ Ended dragging');
  }
};
