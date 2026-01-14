/**
 * Core Module - @core/* tools
 * Provides essential todo application functionality
 */

export class CoreModule {
  /**
   * Register core tools with the system
   * @param {ModuleRegistry} registry - Module registry instance
   * @param {ToolEngine} toolEngine - Tool engine instance (passed from kernel)
   */
  static async register(registry, toolEngine) {
    const tools = [
      'setViewMode',
      'openModal',
      'closeModal',
      'noop',
      'preventDefault'
    ];
    
    console.log(`[CoreModule] Registering ${tools.length} tools...`);
    
    for (const tool of tools) {
      await toolEngine.registerTool(`core/${tool}`, `@core/${tool}`);
    }
    
    // Register module with config
    registry.registerModule('core', CoreModule, {
      version: '1.0.0',
      description: 'Core UI tools (view modes, modals, utilities)',
      namespace: '@core',
      tools: tools.map(t => `@core/${t}`)
    });
    
    console.log('[CoreModule] Registration complete');
  }

  /**
   * Query method for module configuration
   * @param {string} query - Query string
   * @returns {any}
   */
  static query(query) {
    // Core module doesn't provide additional configuration for now
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
    throw new Error('[CoreModule] ToolEngine not available in registry context');
  }
  
  await CoreModule.register(registry, toolEngine);
}
