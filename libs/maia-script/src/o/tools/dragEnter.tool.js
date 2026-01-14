export default {
  async execute(actor, payload) {
    // Visual feedback: mark the column as drag target
    // In a real app, this would update UI state for hover effects
    console.log(`Drag entered column: ${payload.column}`);
    
    // Could set a dragOverColumn property for CSS styling
    actor.context.dragOverColumn = payload.column;
  }
};
