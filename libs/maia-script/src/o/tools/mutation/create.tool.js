/**
 * Generic Create Tool
 * Creates a new entity in the specified schema collection
 */
export default {
  async execute(actor, payload) {
    const { schema, data } = payload;
    
    if (!schema || !data) {
      throw new Error('@mutation/create requires schema and data');
    }
    
    // Ensure schema collection exists in context
    if (!actor.context[schema]) {
      actor.context[schema] = [];
    }
    
    // Generate ID and create entity
    const entity = {
      id: Date.now().toString(),
      ...data
    };
    
    // Add to collection
    actor.context[schema].push(entity);
    
    // Update filtered views if they exist (e.g., todosTodo, todosDone)
    const collectionName = schema;
    if (collectionName === 'todos') {
      // Special handling for todos - update filtered arrays
      actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
      actor.context.todosDone = actor.context.todos.filter(t => t.done);
      
      // Clear input if newTodoText exists
      if ('newTodoText' in actor.context) {
        actor.context.newTodoText = '';
      }
    }
    
    console.log(`✅ [mutation/create] Created ${schema}:`, entity);
  }
};
