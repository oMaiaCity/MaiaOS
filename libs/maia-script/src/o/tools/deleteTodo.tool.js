/**
 * deleteTodo Tool - Deletes a todo item
 */
export default {
  async execute(actor, payload) {
    const index = actor.context.todos.findIndex(t => t.id === payload.id);
    if (index !== -1) {
      const deleted = actor.context.todos.splice(index, 1)[0];
      
      // Update filtered arrays for kanban view
      actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
      actor.context.todosDone = actor.context.todos.filter(t => t.done);
      
      console.log('✅ Deleted todo:', deleted);
    }
  }
};
