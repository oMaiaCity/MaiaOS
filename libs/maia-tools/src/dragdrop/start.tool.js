/**
 * Generic Drag Start Tool
 * Stores drag information in context for any schema/collection
 * Maintains draggedItemIds object for item-specific lookups (no template comparisons needed)
 */
export default {
  async execute(actor, payload) {
    const { schema, id } = payload;
    
    // Store drag information in context
    actor.context.draggedItemId = id;
    actor.context.draggedEntityType = schema;
    
    // Initialize draggedItemIds object if needed
    if (!actor.context.draggedItemIds) {
      actor.context.draggedItemIds = {};
    }
    
    // Set this item as dragged (for item-specific data-attribute lookups)
    actor.context.draggedItemIds[id] = true;
    
    console.log(`✅ [dragdrop/start] Started dragging ${schema}/${id}`);
  }
};
