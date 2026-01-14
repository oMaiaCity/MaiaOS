/**
 * Generic Update Tool
 * Updates an entity in the specified schema collection
 */
export default {
  async execute(actor, payload) {
    const { schema, id, data } = payload;
    
    if (!schema || !id || !data) {
      throw new Error('@mutation/update requires schema, id, and data');
    }
    
    // Find and update entity
    const collection = actor.context[schema];
    if (!collection) {
      throw new Error(`Schema "${schema}" not found in context`);
    }
    
    const entity = collection.find(item => item.id === id);
    if (!entity) {
      console.warn(`Entity ${id} not found in ${schema}`);
      return;
    }
    
    // Merge update data
    Object.assign(entity, data);
    
    // Update filtered views if they exist
    if (schema === 'todos') {
      actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
      actor.context.todosDone = actor.context.todos.filter(t => t.done);
    }
    
    console.log(`✅ [mutation/update] Updated ${schema}/${id}:`, entity);
  }
};
