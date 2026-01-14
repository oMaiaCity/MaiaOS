/**
 * Mutation Module - Generic CRUD operations
 * Schema-agnostic data mutations for any entity type
 * Replaces todo-specific CRUD with generic operations
 */

export class MutationModule {
  /**
   * Register mutation tools with the system
   * @param {ModuleRegistry} registry - Module registry instance
   * @param {ToolEngine} toolEngine - Tool engine instance
   */
  static async register(registry, toolEngine) {
    const tools = [
      'create',
      'update',
      'delete',
      'toggle'
    ];
    
    console.log(`[MutationModule] Registering ${tools.length} tools...`);
    
    for (const tool of tools) {
      await toolEngine.registerTool(`mutation/${tool}`, `@mutation/${tool}`);
    }
    
    // Register module with config
    registry.registerModule('mutation', MutationModule, {
      version: '1.0.0',
      description: 'Generic CRUD operations for schema-based entities',
      namespace: '@mutation',
      tools: tools.map(t => `@mutation/${t}`)
    });
    
    console.log('[MutationModule] Registration complete');
  }

  /**
   * Query method for module configuration
   * @param {string} query - Query string
   * @returns {any}
   */
  static query(query) {
    // Mutation module doesn't provide additional configuration for now
    return null;
  }
}

/**
 * Register function for dynamic loading
 * @param {ModuleRegistry} registry - Module registry instance
 */
export async function register(registry) {
  // Get toolEngine from registry context (will be set by kernel)
  const toolEngine = registry._toolEngine;
  if (!toolEngine) {
    throw new Error('[MutationModule] ToolEngine not available in registry context');
  }
  
  await MutationModule.register(registry, toolEngine);
}
