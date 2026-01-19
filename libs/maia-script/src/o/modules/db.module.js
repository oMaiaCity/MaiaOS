/**
 * DB Module - @db tool
 * Provides unified database operation API
 */

// Import db tool directly
import dbTool from '../tools/db/db.tool.js';
import dbToolDef from '../tools/db/db.tool.maia';

export class DBModule {
  /**
   * Register db tool with the system
   * @param {ModuleRegistry} registry - Module registry instance
   */
  static async register(registry) {
    console.log(`[DBModule] Registering 1 tool...`);
    
    // Get toolEngine from registry (stored by kernel during boot)
    const toolEngine = registry._toolEngine;
    if (!toolEngine) {
      throw new Error('[DBModule] ToolEngine not available in registry');
    }
    
    // Register @db tool directly (no .maia file loading needed)
    toolEngine.tools.set('@db', {
      definition: dbToolDef,
      function: dbTool,
      namespacePath: 'db/db'
    });
    
    console.log(`[ToolEngine] Registered tool: @db`);
    
    // Register module with config
    registry.registerModule('db', DBModule, {
      version: '1.0.0',
      description: 'Unified database operation API',
      namespace: '@db',
      tools: ['@db']
    });
    
    console.log('[ModuleRegistry] Registered module: db');
    console.log('[DBModule] Registration complete');
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
