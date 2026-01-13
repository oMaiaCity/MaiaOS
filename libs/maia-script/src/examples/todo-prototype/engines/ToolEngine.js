/**
 * ToolEngine - Action dispatcher
 * Adapted from legacy services/me ActorEngine pattern
 * Executes tool actions (@core/*, @context/*, @dragdrop/*)
 */
export class ToolEngine {
  constructor(moduleRegistry) {
    this.registry = moduleRegistry;
  }

  /**
   * Execute a tool action
   * @param {string} actionName - e.g., '@core/createEntity'
   * @param {object} actor - Actor instance with context
   * @param {any} payload - Action payload
   */
  async execute(actionName, actor, payload) {
    const tool = this.registry.getToolAction(actionName);
    
    if (!tool) {
      console.warn(`No tool registered for action: ${actionName}`);
      return;
    }

    try {
      // Tool executes and mutates actor.context directly
      await tool.execute(actor, payload);
    } catch (error) {
      console.error(`Tool execution error (${actionName}):`, error);
      // Set error on actor context
      actor.context.error = error.message || 'Tool execution failed';
    }
  }
}
