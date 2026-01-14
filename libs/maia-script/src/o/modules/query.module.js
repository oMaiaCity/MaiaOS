/**
 * Query Module - Reactive query tools for data management
 * 
 * Provides tools for querying and subscribing to collections:
 * - @query/subscribe: Reactive subscription to collections
 * - @query/get: One-time data loading
 * - @query/filter: JSON-based filtering
 * 
 * All tools interact with the ReactiveStore for observable data management.
 */

export class QueryModule {
  /**
   * Register query tools with the system
   * @param {ModuleRegistry} registry - Module registry instance
   * @param {ToolEngine} toolEngine - Tool engine instance
   */
  static async register(registry, toolEngine) {
    const tools = [
      'subscribe',
      'get',
      'filter'
    ];
    
    console.log(`[QueryModule] Registering ${tools.length} tools...`);
    
    for (const tool of tools) {
      await toolEngine.registerTool(`query/${tool}`, `@query/${tool}`);
    }
    
    // Register module with config
    registry.registerModule('query', QueryModule, {
      version: '1.0.0',
      description: 'Reactive query tools for data management',
      namespace: '@query',
      tools: tools.map(t => `@query/${t}`)
    });
    
    console.log('[QueryModule] Registration complete');
  }

  /**
   * Query method for module configuration
   * @param {string} query - Query string
   * @returns {any}
   */
  static query(query) {
    // Query module doesn't provide additional configuration for now
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
    throw new Error('[QueryModule] ToolEngine not available in registry context');
  }
  
  await QueryModule.register(registry, toolEngine);
}
