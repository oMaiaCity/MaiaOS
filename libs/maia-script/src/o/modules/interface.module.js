/**
 * Interface Module - @interface/* tools
 * Provides actor interface validation and schema management
 */

// Import tools from registry
import { getTool } from '../tools/index.js';

export class InterfaceModule {
  /**
   * Register interface tools with the system
   * @param {ModuleRegistry} registry - Module registry instance
   */
  static async register(registry) {
    // Get toolEngine from registry (stored by kernel during boot)
    const toolEngine = registry._toolEngine;
    if (!toolEngine) {
      throw new Error('[InterfaceModule] ToolEngine not available in registry');
    }
    
    const toolNames = [
      'validateInterface'
    ];
    
    // Silent - kernel logs module summary
    
    for (const toolName of toolNames) {
      const namespacePath = `interface/${toolName}`;
      const tool = getTool(namespacePath);
      
      if (tool) {
        await toolEngine.registerTool(namespacePath, `@interface/${toolName}`, {
          definition: tool.definition,
          function: tool.function
        });
      }
    }
    
    // Register module with config
    registry.registerModule('interface', InterfaceModule, {
      version: '1.0.0',
      description: 'Actor interface validation and schema management',
      namespace: '@interface',
      tools: toolNames.map(t => `@interface/${t}`)
    });
    
    // Silent - kernel logs module summary
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
  await InterfaceModule.register(registry);
}
