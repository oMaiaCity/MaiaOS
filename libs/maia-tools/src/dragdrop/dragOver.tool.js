/**
 * Generic Drag Over Tool - Unified tool for dragEnter and dragLeave
 * Returns a generic key/value pair for updating context via state machine updateContext action
 * 
 * ARCHITECTURE: Tool returns result only - state machine uses updateContext action to update context
 * This makes the tool fully generic - works for any drag-over scenario, not just columns
 */
export default {
  async execute(actor, payload) {
    const { key, value } = payload; // key: context key to update, value: value to set (null to clear)
    
    // Return result - state machine will use updateContext action to update context
    // This ensures state machine is single source of truth for all context updates
    return {
      [key]: value
    };
  }
};
