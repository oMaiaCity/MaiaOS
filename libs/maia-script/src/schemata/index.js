/**
 * Schemata - Centralized JSON Schema definitions and validation for MaiaOS
 * 
 * This module provides:
 * - ValidationEngine: Unified validation API for all MaiaOS data types
 * - Schema definitions: JSON Schema files for each data type
 */

export { ValidationEngine } from './validation.engine.js';

// Schema cache (loaded dynamically to avoid JSON import issues in browser)
const schemaCache = new Map();

// Schema file paths relative to this module
const SCHEMA_PATHS = {
  actor: './actor.schema.json',
  context: './context.schema.json',
  state: './state.schema.json',
  view: './view.schema.json',
  style: './style.schema.json',
  brandStyle: './brand-style.schema.json',
  'brand.style': './brand-style.schema.json',
  'actor.style': './style.schema.json',
  interface: './interface.schema.json',
  'actor.interface': './interface.schema.json',
  tool: './tool.schema.json',
  skill: './skill.schema.json',
  vibe: './vibe.schema.json',
  message: './message.schema.json',
  common: './common.schema.json'
};

/**
 * Load a schema file dynamically
 * @param {string} type - Schema type
 * @returns {Promise<object>} Schema object
 */
async function loadSchema(type) {
  if (schemaCache.has(type)) {
    return schemaCache.get(type);
  }

  const path = SCHEMA_PATHS[type];
  if (!path) {
    throw new Error(`Unknown schema type: ${type}`);
  }

  // Resolve path relative to current module
  const moduleUrl = new URL(import.meta.url);
  const schemaUrl = new URL(path, moduleUrl);
  
  const response = await fetch(schemaUrl);
  if (!response.ok) {
    throw new Error(`Failed to load schema ${type}: ${response.statusText}`);
  }
  
  const schema = await response.json();
  schemaCache.set(type, schema);
  return schema;
}

/**
 * Get schema for a given type (synchronous - uses cache)
 * @param {string} type - Data type (e.g., 'actor', 'context', 'state')
 * @returns {object|null} Schema object or null if not found
 */
export function getSchema(type) {
  return schemaCache.get(type) || null;
}

/**
 * Preload all schemas (call this during initialization)
 * @returns {Promise<void>}
 */
export async function loadAllSchemas() {
  const types = Object.keys(SCHEMA_PATHS);
  await Promise.all(types.map(type => loadSchema(type)));
}

// Schema type mapping
export const SCHEMA_TYPES = {
  actor: 'actor',
  context: 'context',
  state: 'state',
  view: 'view',
  style: 'style',
  'brand.style': 'brandStyle',
  'actor.style': 'style',
  'actor.interface': 'interface',
  tool: 'tool',
  skill: 'skill',
  vibe: 'vibe',
  message: 'message'
};

// Export loadSchema for external use
export { loadSchema };
