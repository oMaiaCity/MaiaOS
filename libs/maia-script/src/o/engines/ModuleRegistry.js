/**
 * ModuleRegistry - Universal plugin system
 * Handles BOTH DSL operations AND tool actions
 */
export class ModuleRegistry {
  constructor() {
    this.dslOperations = new Map(); // For MaiaScript: $eq, $filter, etc.
    this.toolActions = new Map();   // For ToolEngine: @core/*, @context/*
    this.modules = new Map();       // All registered modules
  }

  /**
   * Register a module (can contain DSL ops, tool actions, or both)
   */
  register(module) {
    if (this.modules.has(module.name)) {
      console.warn(`Module "${module.name}" already registered`);
      return;
    }
    
    this.modules.set(module.name, module);
    
    // Register DSL operations (for MaiaScriptEvaluator)
    if (module.operations) {
      for (const [opName, operation] of Object.entries(module.operations)) {
        this.dslOperations.set(opName, operation);
      }
    }
    
    // Register tool actions (for ToolEngine)
    if (module.tools) {
      for (const [actionName, tool] of Object.entries(module.tools)) {
        this.toolActions.set(actionName, tool);
      }
    }
  }

  // DSL operation lookup (used by MaiaScriptEvaluator)
  getDSLOperation(name) {
    return this.dslOperations.get(name);
  }

  // Tool action lookup (used by ToolEngine)
  getToolAction(name) {
    return this.toolActions.get(name);
  }

  hasDSLOperation(name) {
    return this.dslOperations.has(name);
  }

  hasToolAction(name) {
    return this.toolActions.has(name);
  }
}
