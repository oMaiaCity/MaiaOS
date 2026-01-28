/**
 * Generic Drop Tool
 * Handles drop event for any schema/collection
 * Uses @db to persist changes to database
 * 
 * Schema is extracted from CoValue headerMeta by update operation internally
 * NO schema handling needed in tools - operations handle it "under the hood"
 * 
 * CRDT-COMPATIBLE IDEMPOTENT PATTERN:
 * - Returns structured results instead of throwing errors for missing prerequisites
 * - Can be called safely even when prerequisites aren't met (idempotent no-op)
 * - State machines handle results gracefully without guards
 */
export default {
  async execute(actor, payload) {
    const { field, value } = payload;
    
    // Validate required payload fields
    if (!field) {
      // Return structured result for missing field (idempotent no-op)
      return {
        success: false,
        skipped: true,
        reason: 'Field is required in payload',
        draggedItemId: null
      };
    }
    
    // Get dragged item ID from context (set by state machine via updateContext action)
    // ARCHITECTURE: Context is single source of truth, managed by state machine
    const draggedId = actor.context.draggedItemId || 
      (actor.context.draggedItemIds && Object.keys(actor.context.draggedItemIds).find(id => actor.context.draggedItemIds[id]));
    
    // Handle missing draggedItemId gracefully (idempotent no-op)
    // This allows DROP events to arrive out-of-order (e.g., before DRAG_START)
    // State machine will receive SUCCESS event with skipped: true, can handle gracefully
    if (!draggedId) {
      return {
        success: false,
        skipped: true,
        reason: 'No dragged item found in context. Ensure DRAG_START was called and draggedItemId was set via state machine updateContext action.',
        draggedItemId: null
      };
    }
    
    // Use @db to persist the change
    // This will automatically trigger reactive subscriptions and update filtered arrays
    // Schema is automatically extracted from CoValue headerMeta by update operation
    const toolEngine = actor.actorEngine?.toolEngine;
    if (!toolEngine) {
      // ToolEngine unavailable - return structured error (idempotent no-op)
      return {
        success: false,
        skipped: true,
        reason: 'ToolEngine not available',
        draggedItemId: draggedId
      };
    }
    
    try {
      // Update the entity using @db tool
      // Schema is automatically extracted from CoValue headerMeta by update operation
      await toolEngine.execute('@db', actor, {
        op: 'update',
        id: draggedId,
        data: { [field]: value }
      });
      
      // Return success result - state machine will handle context updates via SUCCESS handler
      return {
        success: true,
        skipped: false,
        draggedItemId: draggedId,
        updated: { [field]: value }
      };
    } catch (error) {
      // Database operation failed - this is a real error, not a missing prerequisite
      // Return structured error result (state machine can handle via ERROR event or SUCCESS with success: false)
      // For now, we'll return structured result so state machine can handle gracefully
      // If state machine needs to distinguish real errors, it can check result.success === false && result.skipped === false
      return {
        success: false,
        skipped: false,
        reason: `Failed to update ${draggedId}: ${error.message}`,
        draggedItemId: draggedId,
        error: error.message
      };
    }
  }
};
