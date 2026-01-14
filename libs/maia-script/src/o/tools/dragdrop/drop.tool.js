/**
 * Generic Drop Tool
 * Handles drop event for any schema/collection
 */
export default {
  async execute(actor, payload) {
    const { schema, field = 'done', value } = payload;
    
    // Get dragged item ID from context (set by @dragdrop/start)
    const draggedId = actor.context.draggedItemId;
    if (!draggedId) {
      console.warn('[dragdrop/drop] No draggedItemId in context');
      return;
    }
    
    // Find the collection
    const collection = actor.context[schema];
    if (!collection) {
      console.error(`[dragdrop/drop] Schema "${schema}" not found in context`);
      return;
    }
    
    // Find the entity
    const entity = collection.find(item => item.id === draggedId);
    if (!entity) {
      console.warn(`[dragdrop/drop] Entity ${draggedId} not found in ${schema}`);
      return;
    }
    
    // Update the field
    entity[field] = value;
    
    // Update filtered arrays if they exist (e.g., todosTodo, todosDone)
    // This is schema-specific convention: {schema}{CapitalizedValue}
    if (schema === 'todos' && field === 'done') {
      // Special handling for todos - update filtered arrays
    actor.context.todosTodo = actor.context.todos.filter(t => !t.done);
    actor.context.todosDone = actor.context.todos.filter(t => t.done);
    }
    
    // Clear drag state
    actor.context.draggedItemId = null;
    actor.context.draggedEntityType = null;
    
    console.log(`✅ [dragdrop/drop] Dropped ${schema}/${draggedId}, set ${field} = ${value}`);
  }
};
