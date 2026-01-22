/**
 * Module Registration Utilities
 * 
 * Shared utilities for module registration to eliminate duplication.
 * Used by all modules (core, db, dragdrop, interface) for consistent registration patterns.
 */

import { getTool } from '../tools/index.js';

/**
 * Get and validate toolEngine from registry
 * @param {Object} registry - Module registry instance
 * @param {string} moduleName - Module name for error messages (e.g., 'CoreModule', 'DBModule')
 * @returns {Object} ToolEngine instance
 * @throws {Error} If toolEngine is not available
 */
export function getToolEngine(registry, moduleName) {
  const toolEngine = registry._toolEngine;
  if (!toolEngine) {
    throw new Error(`[${moduleName}] ToolEngine not available in registry`);
  }
  return toolEngine;
}

/**
 * Register multiple tools from tool registry using getTool()
 * @param {Object} registry - Module registry instance
 * @param {Object} toolEngine - ToolEngine instance (from getToolEngine)
 * @param {string} moduleName - Module name (e.g., 'core', 'dragdrop')
 * @param {Array<string>} toolNames - Array of tool names (e.g., ['noop', 'preventDefault'])
 * @param {string} namespace - Namespace prefix (e.g., '@core', '@dragdrop')
 * @param {Object} options - Optional configuration
 * @param {boolean} options.silent - If true, suppress errors (default: false)
 * @returns {Promise<Array<string>>} Array of successfully registered tool IDs
 */
export async function registerToolsFromRegistry(registry, toolEngine, moduleName, toolNames, namespace, options = {}) {
  const { silent = false } = options;
  const registeredTools = [];
  
  for (const toolName of toolNames) {
    try {
      const namespacePath = `${moduleName}/${toolName}`;
      const tool = getTool(namespacePath);
      
      if (tool) {
        await toolEngine.registerTool(namespacePath, `${namespace}/${toolName}`, {
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

/**
 * Register a single tool from tool registry
 * @param {Object} toolEngine - ToolEngine instance
 * @param {string} namespacePath - Namespace path (e.g., 'context/update')
 * @param {string} toolId - Tool ID (e.g., '@context/update')
 * @param {Object} options - Optional configuration
 * @param {boolean} options.silent - If true, suppress errors (default: false)
 * @returns {Promise<boolean>} True if tool was registered successfully
 */
export async function registerSingleToolFromRegistry(toolEngine, namespacePath, toolId, options = {}) {
  const { silent = false } = options;
  
  try {
    const tool = getTool(namespacePath);
    if (tool) {
      await toolEngine.registerTool(namespacePath, toolId, {
        definition: tool.definition,
        function: tool.function
      });
      return true;
    }
  } catch (error) {
    if (!silent) {
      console.error(`Failed to register ${toolId}:`, error.message);
    }
  }
  
  return false;
}

/**
 * Register module configuration with registry
 * @param {Object} registry - Module registry instance
 * @param {string} moduleName - Module name (e.g., 'core', 'db')
 * @param {Function} ModuleClass - Module class constructor
 * @param {Object} config - Module configuration object
 * @param {string} config.version - Module version
 * @param {string} config.description - Module description
 * @param {string} config.namespace - Module namespace (e.g., '@core')
 * @param {Array<string>} config.tools - Array of tool IDs registered by this module
 */
export function registerModuleConfig(registry, moduleName, ModuleClass, config) {
  registry.registerModule(moduleName, ModuleClass, {
    version: config.version || '1.0.0',
    description: config.description,
    namespace: config.namespace,
    tools: config.tools || []
  });
}
