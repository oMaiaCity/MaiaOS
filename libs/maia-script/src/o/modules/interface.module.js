/**
 * Interface Module - @interface/* tools
 * Provides actor interface validation and schema management
 */

export class InterfaceModule {
  /**
   * Register interface tools with the system
   * @param {ModuleRegistry} registry - Module registry instance
   * @param {ToolEngine} toolEngine - Tool engine instance (passed from kernel)
   */
  static async register(registry, toolEngine) {
    const tools = [
      'validateInterface'
    ];
    
    console.log(`[InterfaceModule] Registering ${tools.length} tools...`);
    
    for (const tool of tools) {
      await toolEngine.registerTool(`interface/${tool}`, `@interface/${tool}`);
    }
    
    // Register module with config
    registry.registerModule('interface', InterfaceModule, {
      version: '1.0.0',
      description: 'Actor interface validation and schema management',
      namespace: '@interface',
      tools: tools.map(t => `@interface/${t}`)
    });
    
    console.log('[InterfaceModule] Registration complete');
  }

  /**
   * Query method for module configuration
   * @param {string} query - Query string
   * @returns {any}
   */
  static query(query) {
    // Interface module doesn't provide additional configuration for now
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
    throw new Error('[InterfaceModule] ToolEngine not available in registry context');
  }
  
  await InterfaceModule.register(registry, toolEngine);
}
