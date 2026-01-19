/**
 * Schemata - Centralized JSON Schema definitions and validation for MaiaOS
 * 
 * This module provides:
 * - ValidationEngine: Unified validation API for all MaiaOS data types
 * - Schema definitions: Imported directly from JSON files
 */

export { ValidationEngine } from './validation.engine.js';

// Import all schema definitions directly as JSON
import actorSchema from './actor.schema.json';
import contextSchema from './context.schema.json';
import stateSchema from './state.schema.json';
import viewSchema from './view.schema.json';
import styleSchema from './style.schema.json';
import brandStyleSchema from './brandStyle.schema.json';
import interfaceSchema from './interface.schema.json';
import toolSchema from './tool.schema.json';
import vibeSchema from './vibe.schema.json';
import messageSchema from './message.schema.json';
import commonSchema from './common.schema.json';

// Schema registry
const SCHEMAS = {
  actor: actorSchema,
  context: contextSchema,
  state: stateSchema,
  view: viewSchema,
  style: styleSchema,
  brandStyle: brandStyleSchema,
  'brand.style': brandStyleSchema,
  'actor.style': styleSchema,
  interface: interfaceSchema,
  'actor.interface': interfaceSchema,
  tool: toolSchema,
  vibe: vibeSchema,
  message: messageSchema,
  common: commonSchema
};

/**
 * Get schema for a given type (synchronous)
 * @param {string} type - Data type (e.g., 'actor', 'context', 'state')
 * @returns {object|null} Schema object or null if not found
 */
export function getSchema(type) {
  return SCHEMAS[type] || null;
}

/**
 * Get all schemas
 * @returns {object} All schema definitions
 */
export function getAllSchemas() {
  return { ...SCHEMAS };
}

/**
 * Load a schema (for backwards compatibility - now synchronous)
 * @param {string} type - Schema type
 * @returns {Promise<object>} Schema object
 */
export async function loadSchema(type) {
  const schema = getSchema(type);
  if (!schema) {
    throw new Error(`Unknown schema type: ${type}`);
  }
  return schema;
}

/**
 * Preload all schemas (no-op now that schemas are imported)
 * @returns {Promise<void>}
 */
export async function loadAllSchemas() {
  // No-op - schemas are already loaded via imports
  return Promise.resolve();
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
  vibe: 'vibe'
};
