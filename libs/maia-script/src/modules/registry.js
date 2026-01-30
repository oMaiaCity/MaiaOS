/**
 * Registry - Central plugin system for MaiaScript module extensions
 */

import { getTool } from '@MaiaOS/tools';

export class Registry {
  constructor() {
    this.modules = new Map(); // moduleName → module instance
    this.moduleConfigs = new Map(); // moduleName → config/metadata
  }

  /**
   * Register a MaiaScript module
   * @param {string} name - Module name (e.g., 'core', 'dragdrop')
   * @param {Object} module - Module instance or class
   * @param {Object} config - Optional module configuration/metadata
   */
  registerModule(name, module, config = {}) {
    if (this.modules.has(name)) {
      console.warn(`[Registry] Module "${name}" already registered, overwriting`);
    }
    
    this.modules.set(name, module);
    this.moduleConfigs.set(name, {
      name,
      version: config.version || '1.0.0',
      description: config.description || '',
      ...config
    });
    
    // Silent - kernel logs module summary
  }

  /**
   * Get a module by name
   * @param {string} name - Module name
   * @returns {Object|null} Module instance or null
   */
  getModule(name) {
    return this.modules.get(name) || null;
  }

  /**
   * Get module configuration
   * @param {string} name - Module name
   * @returns {Object|null} Module config or null
   */
  getModuleConfig(name) {
    return this.moduleConfigs.get(name) || null;
  }

  /**
   * Check if a module exists
   * @param {string} name - Module name
   * @returns {boolean}
   */
  hasModule(name) {
    return this.modules.has(name);
  }

  /**
   * List all registered modules
   * @returns {Array<string>} Array of module names
   */
  listModules() {
    return Array.from(this.modules.keys());
    }
    
  /**
   * List all module configs
   * @returns {Array<Object>} Array of module configurations
   */
  listModuleConfigs() {
    return Array.from(this.moduleConfigs.values());
  }

  /**
   * Clear all registered modules
   * @internal For testing purposes only
   */
  clear() {
    this.modules.clear();
    this.moduleConfigs.clear();
    console.log('[Registry] Cleared all modules');
  }

  /**
   * Load a module (imports and registers)
   * @param {string} moduleName - Module name to load
   * @param {string} modulePath - Path to module file (optional, defaults to modules/{name}.module.js)
   * @returns {Promise<void>}
   */
  async loadModule(moduleName, modulePath = null) {
    if (this.hasModule(moduleName)) {
      console.log(`[Registry] Module "${moduleName}" already loaded`);
      return;
  }

    // Path relative to modules/ (where registry.js is located)
    const path = modulePath || `./${moduleName}.module.js`;
    
    try {
      const module = await import(/* @vite-ignore */ path);
      
      // Module should have a register method or export a class with static register
      if (module.default && typeof module.default.register === 'function') {
        // Class with static register method
        await module.default.register(this);
      } else if (typeof module.register === 'function') {
        // Exported register function
        await module.register(this);
      } else {
        console.warn(`[Registry] Module "${moduleName}" has no register method`);
      }
    } catch (error) {
      console.error(`[Registry] Failed to load module "${moduleName}":`, error);
      throw error;
    }
  }

  /**
   * Query module for configuration/data
   * @param {string} moduleName - Module name
   * @param {string} query - Query string
   * @returns {any} Query result or null
   */
  query(moduleName, query) {
    const module = this.getModule(moduleName);
    if (!module) return null;
    if (typeof module.query === 'function') return module.query(query);
    if (module.config && query in module.config) return module.config[query];
    return null;
  }

  /**
   * Get tool engine from registry
   * @param {string} moduleName - Module name for error messages
   * @returns {Object} ToolEngine instance
   */
  _getToolEngine(moduleName) {
    const toolEngine = this._toolEngine;
    if (!toolEngine) {
      throw new Error(`[${moduleName}] ToolEngine not available in registry`);
    }
    return toolEngine;
  }

  /**
   * Register tools from tools registry
   * @param {string} moduleName - Module name
   * @param {Array<string>} toolNames - Array of tool names
   * @param {string} namespace - Namespace prefix (e.g., '@core')
   * @param {Object} options - Options (silent, etc.)
   * @returns {Promise<Array<string>>} Array of registered tool names
   */
  async _registerToolsFromRegistry(moduleName, toolNames, namespace, options = {}) {
    const { silent = false } = options;
    const toolEngine = this._getToolEngine(moduleName);
    const registeredTools = [];
    
    for (const toolName of toolNames) {
      try {
        const tool = getTool(`${moduleName}/${toolName}`);
        if (tool) {
          await toolEngine.registerTool(`${moduleName}/${toolName}`, `${namespace}/${toolName}`, {
            definition: tool.definition,
            function: tool.function
          });
          registeredTools.push(`${namespace}/${toolName}`);
        }
      } catch (error) {
        if (!silent) {
          console.error(`[${moduleName}] Failed to register ${namespace}/${toolName}:`, error.message);
        }
      }
    }
    
    return registeredTools;
  }
}
