export default {
  async execute(actor, payload) {
    // Remove visual feedback when leaving drop zone
    console.log(`Drag left column: ${payload.column}`);
    
    // Clear dragOverColumn if it matches
    if (actor.context.dragOverColumn === payload.column) {
      actor.context.dragOverColumn = null;
    }
  }
};
