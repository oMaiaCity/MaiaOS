/**
 * Core Module - @core/* tools
 * Provides core UI tools (view modes, modals, utilities)
 */

import { getToolEngine, registerToolsFromRegistry, registerModuleConfig } from '../utils/module-registration.js';

export class CoreModule {
  /**
   * Register core tools with the system
   * @param {ModuleRegistry} registry - Module registry instance
   */
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'CoreModule');
    
    const toolNames = [
      'noop',
      'preventDefault',
      'publishMessage',
      'focus'
    ];
    
    // Silent - kernel logs module summary
    
    await registerToolsFromRegistry(registry, toolEngine, 'core', toolNames, '@core', { silent: true });
    
    // Register module with config
    registerModuleConfig(registry, 'core', CoreModule, {
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
