/**
 * Generic Delete Tool
 * Deletes an entity from the specified schema collection
 */
export default {
  async execute(actor, payload) {
    const { schema, id } = payload;
    
    if (!schema || !id) {
      throw new Error('@mutation/delete requires schema and id');
    }
    
    // Find and remove entity
    const collection = actor.context[schema];
    if (!collection) {
      throw new Error(`Schema "${schema}" not found in context`);
    }
    
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) {
      console.warn(`Entity ${id} not found in ${schema}`);
      return;
    }
    
    collection.splice(index, 1);
    
    // Update filtered views if they exist
    if (schema === 'todos') {
      actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
      actor.context.todosDone = actor.context.todos.filter(t => t.done);
    }
    
    console.log(`✅ [mutation/delete] Deleted ${schema}/${id}`);
  }
};
