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
    
    // CRDT-FIRST: Persist drag state to context CoValue
    // Initialize draggedItemIds object if needed
    const draggedItemIds = actor.context.draggedItemIds || {};
    draggedItemIds[id] = true;
    
    // Persist drag information to CRDT CoValue using operations API
    if (actor.actorEngine) {
      await actor.actorEngine.updateContextCoValue(actor, {
        draggedItemId: id,
        draggedEntityType: schemaCoId,
        draggedSchema: schemaCoId, // Store resolved schema for use in drop
        draggedItemIds: draggedItemIds
      });
    } else {
      throw new Error('[dragdrop/start] ActorEngine not available');
    }
  }
};
