/**
 * Core Module - @core/* tools
 * Provides essential todo application functionality
 */

// Import tools from registry
import { getTool } from '../tools/index.js';

export class CoreModule {
  /**
   * Register core tools with the system
   * @param {ModuleRegistry} registry - Module registry instance
   */
  static async register(registry) {
    // Get toolEngine from registry (stored by kernel during boot)
    const toolEngine = registry._toolEngine;
    if (!toolEngine) {
      throw new Error('[CoreModule] ToolEngine not available in registry');
    }
    
    const toolNames = [
      'noop',
      'preventDefault',
      'publishMessage'
    ];
    
    // Silent - kernel logs module summary
    
    for (const toolName of toolNames) {
      const namespacePath = `core/${toolName}`;
      const tool = getTool(namespacePath);
      
      if (tool) {
        await toolEngine.registerTool(namespacePath, `@core/${toolName}`, {
          definition: tool.definition,
          function: tool.function
        });
      }
    }
    
    // Register module with config
    registry.registerModule('core', CoreModule, {
      version: '1.0.0',
      description: 'Core UI tools (view modes, modals, utilities)',
      namespace: '@core',
      tools: toolNames.map(t => `@core/${t}`)
    });
    
    // Silent - kernel logs module summary
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
  await CoreModule.register(registry);
}
