/**
 * Generic Drag Start Tool
 * Stores drag information in context for any schema/collection
 */
export default {
  async execute(actor, payload) {
    const { schema, id } = payload;
    
    // Store drag information in context
    actor.context.draggedItemId = id;
    actor.context.draggedEntityType = schema;
    
    console.log(`✅ [dragdrop/start] Started dragging ${schema}/${id}`);
  }
};
