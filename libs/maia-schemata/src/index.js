/**
 * Schemata - Centralized JSON Schema definitions and validation for MaiaOS
 * 
 * This module provides:
 * - ValidationEngine: Unified validation API for all MaiaOS data types
 * - Schema definitions: Imported directly from JSON files
 */

// Import ValidationEngine for getMetaSchema (must import before using)
import { ValidationEngine } from './validation.engine.js';

export { ValidationEngine };

// Export meta schema for seeding
export function getMetaSchema() {
  return ValidationEngine.getMetaSchema();
}

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
// Import extracted $defs as separate schemas
import guardSchema from './guard.schema.json';
import actionSchema from './action.schema.json';
import transitionSchema from './transition.schema.json';
import messagePayloadSchema from './messagePayload.schema.json';
// Import CoValue schemas
import tokensComapSchema from './tokens-comap.schema.json';
import componentsComapSchema from './components-comap.schema.json';
import subscriptionsColistSchema from './subscriptions-colist.schema.json';
import inboxCostreamSchema from './inbox-costream.schema.json';
import todosSchema from './todos-colist.schema.json';
// Import data schemas
import todosDataSchema from './data/todos.schema.json';

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
  common: commonSchema,
  // Extracted $defs as separate schemas (expression is inline type definition, not a CoValue)
  guard: guardSchema,
  action: actionSchema,
  transition: transitionSchema,
  messagePayload: messagePayloadSchema,
  // CoValue schemas (separate CoValues referenced via $co)
  'tokens-comap': tokensComapSchema,
  'components-comap': componentsComapSchema,
  'subscriptions-colist': subscriptionsColistSchema,
  'inbox-costream': inboxCostreamSchema,
  todos: todosSchema
};

// Data schemas registry (for application data validation)
const DATA_SCHEMAS = {
  'data/todos': todosDataSchema
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
 * Get all schemas (including data schemas)
 * @returns {object} All schema definitions
 */
export function getAllSchemas() {
  return { ...SCHEMAS, ...DATA_SCHEMAS };
}

/**
 * Get all data schemas
 * @returns {object} Data schema definitions
 */
export function getDataSchemas() {
  return { ...DATA_SCHEMAS };
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
