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

// Export validation helper functions
export { getValidationEngine, validateAgainstSchema, validateAgainstSchemaOrThrow, setSchemaResolver } from './validation.helper.js';

// Export meta schema functions
export { getMetaSchemaDefinition, getMetaSchemaCoMapDefinition } from './meta-schema.js';

// Export schema loader functions
export { loadSchemaFromDB, loadSchemasFromAccount, getSchemaByCoId, getSchemaByName } from './schema-loader.js';

// Export co-type definitions
export { default as coTypesDefs } from './co-types.defs.json';

// Export meta schema for seeding
export function getMetaSchema() {
  return ValidationEngine.getMetaSchema();
}

// Import all schema definitions directly as JSON
import actorSchema from './os/actor.schema.json';
import contextSchema from './os/context.schema.json';
import stateSchema from './os/state.schema.json';
import viewSchema from './os/view.schema.json';
import styleSchema from './os/style.schema.json';
import interfaceSchema from './os/interface.schema.json';
import toolSchema from './os/tool.schema.json';
import vibeSchema from './os/vibe.schema.json';
import messageSchema from './os/message.schema.json';
// Import extracted $defs as separate schemas
import guardSchema from './os/guard.schema.json';
import actionSchema from './os/action.schema.json';
import transitionSchema from './os/transition.schema.json';
import messagePayloadSchema from './os/messagePayload.schema.json';
// Import MaiaScript expression schema
import expressionSchema from './os/maia-script-expression.schema.json';
// Import CoValue schemas
import subscriptionsSchema from './os/subscriptions.schema.json';
import inboxSchema from './os/inbox.schema.json';
import childrenSchema from './os/children.schema.json';
// Import data schemas
import todosDataSchema from './data/todos.schema.json';

// Schema registry
const SCHEMAS = {
  actor: actorSchema,
  context: contextSchema,
  state: stateSchema,
  view: viewSchema,
  style: styleSchema,
  brand: styleSchema,
  'brand.style': styleSchema,
  'actor.style': styleSchema,
  interface: interfaceSchema,
  'actor.interface': interfaceSchema,
  tool: toolSchema,
  vibe: vibeSchema,
  message: messageSchema,
  // Extracted $defs as separate schemas (expression is inline type definition, not a CoValue)
  guard: guardSchema,
  action: actionSchema,
  transition: transitionSchema,
  messagePayload: messagePayloadSchema,
  // MaiaScript expression schema (for validating DSL expressions)
  'maia-script-expression': expressionSchema,
  // CoValue schemas (separate CoValues referenced via $co)
  subscriptions: subscriptionsSchema,
  inbox: inboxSchema,
  children: childrenSchema
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

