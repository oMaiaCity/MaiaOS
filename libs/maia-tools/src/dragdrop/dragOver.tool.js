/**
 * Drag Over Tool - Unified tool for dragEnter and dragLeave
 * Sets dragOverColumn to the column name when entering, null when leaving
 * 
 * Consolidates dragEnter and dragLeave into a single tool (eliminates duplication)
 */
export default {
  async execute(actor, payload) {
    const { column } = payload; // null to clear (dragLeave), string to set (dragEnter)
    
    return {
      dragOverColumn: column
    };
  }
};
