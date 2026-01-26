/**
 * Generic Drag Start Tool
 * Stores drag information in context for any schema/collection
 * Maintains draggedItemIds object for item-specific lookups (no template comparisons needed)
 * Uses dynamic schema resolution - resolves human-readable schema references to co-ids
 */
export default {
  async execute(actor, payload) {
    const { schema, id } = payload;
    
    if (!schema) {
      throw new Error('[dragdrop/start] Schema is required in payload');
    }
    
    if (!id) {
      throw new Error('[dragdrop/start] ID is required in payload');
    }
    
    // Resolve schema if it's a human-readable reference (e.g., @schema/data/todos)
    let schemaCoId = schema;
    if (!schema.startsWith('co_z')) {
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
              throw new Error(`[dragdrop/start] Could not resolve schema reference: ${schema}`);
            }
          } catch (error) {
            console.error(`[dragdrop/start] Failed to resolve schema ${schema}:`, error);
            throw error;
          }
        } else {
          throw new Error(`[dragdrop/start] Schema must be a co-id (co_z...) or dbEngine must be available for resolution. Got: ${schema}`);
        }
      } else {
        throw new Error(`[dragdrop/start] Invalid schema format: ${schema}. Must be co-id (co_z...) or human-readable (@schema/...)`);
      }
    }
    
    // Store drag information in context (use resolved co-id)
    actor.context.draggedItemId = id;
    actor.context.draggedEntityType = schemaCoId;
    actor.context.draggedSchema = schemaCoId; // Store resolved schema for use in drop
    
    // Initialize draggedItemIds object if needed
    if (!actor.context.draggedItemIds) {
      actor.context.draggedItemIds = {};
    }
    
    // Set this item as dragged (for item-specific data-attribute lookups)
    actor.context.draggedItemIds[id] = true;
  }
};
