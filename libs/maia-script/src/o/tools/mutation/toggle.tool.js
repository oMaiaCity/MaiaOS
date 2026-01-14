/**
 * Generic Toggle Tool
 * Toggles a boolean field on an entity
 */
export default {
  async execute(actor, payload) {
    const { schema, id, field = 'done' } = payload;
    
    if (!schema || !id) {
      throw new Error('@mutation/toggle requires schema and id');
    }
    
    // Find and toggle entity
    const collection = actor.context[schema];
    if (!collection) {
      throw new Error(`Schema "${schema}" not found in context`);
    }
    
    const entity = collection.find(item => item.id === id);
    if (!entity) {
      console.warn(`Entity ${id} not found in ${schema}`);
      return;
    }
    
    // Toggle the field
    entity[field] = !entity[field];
    
    // Update filtered views if they exist
    if (schema === 'todos') {
      actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
      actor.context.todosDone = actor.context.todos.filter(t => t.done);
    }
    
    console.log(`✅ [mutation/toggle] Toggled ${schema}/${id}.${field}:`, entity[field]);
  }
};
