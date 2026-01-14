/**
 * MaiaScript Module Registry
 * Central plugin system for MaiaScript extensions
 * Ported from v1 registry.ts - JavaScript version for v0.3
 */

export class ModuleRegistry {
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
      console.warn(`[ModuleRegistry] Module "${name}" already registered, overwriting`);
    }
    
    this.modules.set(name, module);
    this.moduleConfigs.set(name, {
      name,
      version: config.version || '1.0.0',
      description: config.description || '',
      ...config
    });
    
    console.log(`[ModuleRegistry] Registered module: ${name}`);
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
   * Clear all registered modules (for testing)
   */
  clear() {
    this.modules.clear();
    this.moduleConfigs.clear();
    console.log('[ModuleRegistry] Cleared all modules');
  }

  /**
   * Load a module (imports and registers)
   * @param {string} moduleName - Module name to load
   * @param {string} modulePath - Path to module file (optional, defaults to o/modules/{name}.module.js)
   * @returns {Promise<void>}
   */
  async loadModule(moduleName, modulePath = null) {
    if (this.hasModule(moduleName)) {
      console.log(`[ModuleRegistry] Module "${moduleName}" already loaded`);
      return;
    }

    // Path relative to o/engines/ (where ModuleRegistry.js is located)
    const path = modulePath || `../modules/${moduleName}.module.js`;
    
    try {
      const module = await import(path);
      
      // Module should have a register method or export a class with static register
      if (module.default && typeof module.default.register === 'function') {
        // Class with static register method
        await module.default.register(this);
      } else if (typeof module.register === 'function') {
        // Exported register function
        await module.register(this);
      } else {
        console.warn(`[ModuleRegistry] Module "${moduleName}" has no register method`);
      }
    } catch (error) {
      console.error(`[ModuleRegistry] Failed to load module "${moduleName}":`, error);
      throw error;
    }
  }

  /**
   * Query module for configuration/data
   * Generic method for modules to expose queryable data
   * @param {string} moduleName - Module name
   * @param {string} query - Query string (e.g., 'dragConfig', 'allowedTags')
   * @returns {any} Query result or null
   */
  query(moduleName, query) {
    const module = this.getModule(moduleName);
    if (!module) {
      console.warn(`[ModuleRegistry] Module "${moduleName}" not found for query: ${query}`);
      return null;
    }

    // Module can implement a query method
    if (typeof module.query === 'function') {
      return module.query(query);
    }

    // Or expose config directly
    if (module.config && query in module.config) {
      return module.config[query];
    }

    console.warn(`[ModuleRegistry] Module "${moduleName}" does not support query: ${query}`);
    return null;
  }
}
