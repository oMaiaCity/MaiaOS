/**
 * dragdropDrop Tool - Handles drop event for kanban
 */
export default {
  async execute(actor, payload) {
    // Get dragged item ID from context (set by dragstart)
    const draggedId = actor.context.draggedItemId;
    if (!draggedId) return;
    
    const todo = actor.context.todos.find(t => t.id === draggedId);
    if (!todo) return;
    
    // Update done state based on target column
    todo.done = payload.targetColumn === 'done';
    
    // Update filtered arrays
    actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
    actor.context.todosDone = actor.context.todos.filter(t => t.done);
    
    // Clear drag state
    actor.context.draggedItemId = null;
    
    console.log('✅ Dropped todo:', todo, 'to', payload.targetColumn);
  }
};
