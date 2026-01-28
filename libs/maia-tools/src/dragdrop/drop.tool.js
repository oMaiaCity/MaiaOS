/**
 * Generic Drop Tool
 * Handles drop event for any schema/collection
 * Uses @db to persist changes to database
 * Uses dynamic schema resolution - resolves human-readable schema references to co-ids
 */
export default {
  async execute(actor, payload) {
    const { schema, field = 'done', value } = payload;
    
    // Get dragged item ID from context (set by @dragdrop/start)
    // More resilient: check both draggedItemId and draggedItemIds object
    const draggedId = actor.context.draggedItemId || 
      (actor.context.draggedItemIds && Object.keys(actor.context.draggedItemIds).find(id => actor.context.draggedItemIds[id]));
    
    if (!draggedId) {
      // Silently skip if no drag operation in progress (may happen during rapid state changes)
      // This is more resilient than throwing an error
      return;
    }
    
    // Resolve schema - prefer draggedSchema from context (set by start tool), then resolve payload schema
    // More resilient: also check draggedEntityType as fallback
    let schemaCoId = actor.context.draggedSchema || actor.context.draggedEntityType;
    
    if (!schemaCoId) {
      // Fall back to payload schema
      if (!schema) {
        // More resilient: if no schema available, skip silently (may happen during rapid state changes)
        return;
      }
      
      schemaCoId = schema;
      
      // Resolve if it's a human-readable reference
      if (!schemaCoId.startsWith('co_z')) {
        // Try to resolve from context first (e.g., $todosSchema)
        const contextSchema = actor.context[`${schema}Schema`] || actor.context[schema];
        if (contextSchema && contextSchema.startsWith('co_z')) {
          schemaCoId = contextSchema;
        } else if (schema.startsWith('@schema/')) {
          // Resolve human-readable reference using dbEngine
          const dbEngine = actor.actorEngine?.dbEngine;
          if (dbEngine) {
            try {
              const resolved = await dbEngine.execute({
                op: 'resolve',
                humanReadableKey: schema
              });
              if (resolved && resolved.startsWith('co_z')) {
                schemaCoId = resolved;
              } else {
                throw new Error(`[dragdrop/drop] Could not resolve schema reference: ${schema}`);
              }
            } catch (error) {
              console.error(`[dragdrop/drop] Failed to resolve schema ${schema}:`, error);
              throw error;
            }
          } else {
            throw new Error(`[dragdrop/drop] Schema must be a co-id (co_z...) or dbEngine must be available for resolution. Got: ${schema}`);
          }
        } else {
          throw new Error(`[dragdrop/drop] Invalid schema format: ${schema}. Must be co-id (co_z...) or human-readable (@schema/...)`);
        }
      }
    }
    
    // Use @db to persist the change
    // This will automatically trigger reactive subscriptions and update filtered arrays
    const toolEngine = actor.actorEngine?.toolEngine;
    if (!toolEngine) {
      console.error('[dragdrop/drop] ToolEngine not available');
      return;
    }
    
    try {
      // Update the entity using @db tool
      // This will automatically trigger reactive subscriptions and update filtered arrays
      await toolEngine.execute('@db', actor, {
        op: 'update',
        schema: schemaCoId, // Use resolved co-id
        id: draggedId,
        data: { [field]: value }
      });
      
      // Drag state will be cleared by @dragdrop/end in SUCCESS action
    } catch (error) {
      console.error(`[dragdrop/drop] Failed to update ${schemaCoId}/${draggedId}:`, error);
      throw error;
    }
  }
};
