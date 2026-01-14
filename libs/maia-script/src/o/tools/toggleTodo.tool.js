/**
 * toggleTodo Tool - Toggles the done state of a todo
 */
export default {
  async execute(actor, payload) {
    const todo = actor.context.todos.find(t => t.id === payload.id);
    if (todo) {
      todo.done = !todo.done;
      
      // Update filtered arrays for kanban view
      actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
      actor.context.todosDone = actor.context.todos.filter(t => t.done);
      
      console.log('✅ Toggled todo:', todo);
    }
  }
};
