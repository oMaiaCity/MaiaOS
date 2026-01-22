/**
 * Interface Module - @interface/* tools
 * Provides actor interface validation and schema management
 */

import { getToolEngine, registerToolsFromRegistry, registerModuleConfig } from '../utils/module-registration.js';

export class InterfaceModule {
  /**
   * Register interface tools with the system
   * @param {ModuleRegistry} registry - Module registry instance
   */
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'InterfaceModule');
    
    const toolNames = [
      'validateInterface'
    ];
    
    // Silent - kernel logs module summary
    
    await registerToolsFromRegistry(registry, toolEngine, 'interface', toolNames, '@interface', { silent: true });
    
    // Register module with config
    registerModuleConfig(registry, 'interface', InterfaceModule, {
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
