/**
 * DB Module - @db tool
 * Provides unified database operation API
 */

// Import db tool directly
import dbTool from '../tools/db/db.tool.js';
import dbToolDef from '../tools/db/db.tool.maia';
import { getToolEngine, registerModuleConfig } from '../utils/module-registration.js';

export class DBModule {
  /**
   * Register db tool with the system
   * @param {ModuleRegistry} registry - Module registry instance
   */
  static async register(registry) {
    // Silent - kernel logs module summary
    
    const toolEngine = getToolEngine(registry, 'DBModule');
    
    // Register @db tool directly (no .maia file loading needed)
    toolEngine.tools.set('@db', {
      definition: dbToolDef,
      function: dbTool,
      namespacePath: 'db/db'
    });
    
    // Register module with config
    registerModuleConfig(registry, 'db', DBModule, {
      version: '1.0.0',
      description: 'Unified database operation API',
      namespace: '@db',
      tools: ['@db']
    });
    
    // Silent - kernel logs module summary
  }

  /**
   * Query method for module configuration
   * @param {string} query - Query string
   * @returns {any}
   */
  static query(query) {
    if (query === 'tools') {
      return ['@db'];
    }
    return null;
  }
}

/**
 * Export module registration function for dynamic loading
 * @param {ModuleRegistry} registry - Module registry
 * @returns {Promise<void>}
 */
export async function register(registry) {
  return await DBModule.register(registry);
}
