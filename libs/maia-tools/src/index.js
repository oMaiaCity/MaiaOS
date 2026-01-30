/**
 * Tools Registry - Central export for all tool definitions and functions
 * Uses direct JSON imports for definitions
 * 
 * Note: mutation and query tools have been replaced by the @db unified API
 */

// Import tool definitions directly as JSON
import noopDef from './core/noop.tool.maia';
import publishMessageDef from './core/publishMessage.tool.maia';

import dragStartDef from './dragdrop/start.tool.maia';
import dropDef from './dragdrop/drop.tool.maia';
import dragOverDef from './dragdrop/dragOver.tool.maia';

// Import tool functions
import noopFn from './core/noop.tool.js';
import publishMessageFn from './core/publishMessage.tool.js';

import dragStartFn from './dragdrop/start.tool.js';
import dropFn from './dragdrop/drop.tool.js';
import dragOverFn from './dragdrop/dragOver.tool.js';

/**
 * Tool registry organized by namespace
 */
export const TOOLS = {
  'core/noop': { definition: noopDef, function: noopFn },
  'core/publishMessage': { definition: publishMessageDef, function: publishMessageFn },
  
  'dragdrop/start': { definition: dragStartDef, function: dragStartFn },
  'dragdrop/drop': { definition: dropDef, function: dropFn },
  'dragdrop/dragOver': { definition: dragOverDef, function: dragOverFn }
};

/**
 * Get tool by namespace path
 * @param {string} namespacePath - e.g., "core/noop"
 * @returns {Object|null} Tool definition and function
 */
export function getTool(namespacePath) {
  return TOOLS[namespacePath] || null;
}

/**
 * Get all tools for a given namespace
 * @param {string} namespace - e.g., "core", "mutation"
 * @returns {Object} Tools in namespace
 */
export function getToolsByNamespace(namespace) {
  const result = {};
  for (const [path, tool] of Object.entries(TOOLS)) {
    if (path.startsWith(`${namespace}/`)) {
      result[path] = tool;
    }
  }
  return result;
}

/**
 * Get all tool definitions (for seeding into database)
 * @returns {Object} Tool definitions keyed by namespace path
 */
export function getAllToolDefinitions() {
  const definitions = {};
  for (const [path, tool] of Object.entries(TOOLS)) {
    definitions[path] = tool.definition;
  }
  return definitions;
}
