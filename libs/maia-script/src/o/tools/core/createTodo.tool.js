/**
 * createTodo Tool - Creates a new todo item
 */
export default {
  async execute(actor, payload) {
    const newTodo = {
      id: Date.now().toString(),
      text: payload.text,
      done: false
    };
    
    actor.context.todos.push(newTodo);
    
    // Update filtered arrays for kanban view
    actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
    actor.context.todosDone = actor.context.todos.filter(t => t.done);
    
    // Clear input
    actor.context.newTodoText = '';
    
    console.log('✅ Created todo:', newTodo);
  }
};
