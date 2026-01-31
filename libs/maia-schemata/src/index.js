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

// Meta schema is now loaded from os/meta.schema.json directly (seeding) or from backend (runtime)
// No exports needed - use ValidationEngine.getMetaSchema() for validation engine, or getMetaSchemaFromBackend() for runtime access

// Export schema loader functions (runtime) - consolidated into resolver.js
export { resolve, loadSchemasFromAccount } from '@MaiaOS/db';

// Export schema transformer functions (seeding only)
export { transformForSeeding, validateSchemaStructure, verifyNoSchemaReferences, validateNoNestedCoTypes } from './schema-transformer.js';

// Export co-id registry (seeding only)
export { CoIdRegistry } from './co-id-generator.js';

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
import subscribersSchema from './os/subscribers.schema.json';
import inboxSchema from './os/inbox.schema.json';
import childrenSchema from './os/children.schema.json';
// Import OS infrastructure schemas
import schematasRegistrySchema from './os/schematas-registry.schema.json';
// Import data schemas
import todosDataSchema from './data/todos.schema.json';
import chatDataSchema from './data/chat.schema.json';

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
  subscribers: subscribersSchema,
  inbox: inboxSchema,
  children: childrenSchema,
  // OS infrastructure schemas
  'os/schematas-registry': schematasRegistrySchema
};

// Data schemas registry (for application data validation)
const DATA_SCHEMAS = {
  'data/todos': todosDataSchema,
  'data/chat': chatDataSchema
};

/**
 * Get schema for a given type (SEEDING/MIGRATIONS ONLY - synchronous)
 * Used to build registrySchemas for seeding
 * @param {string} type - Data type (e.g., 'actor', 'context', 'state')
 * @returns {object|null} Schema object or null if not found
 */
export function getSchema(type) {
  return SCHEMAS[type] || DATA_SCHEMAS[type] || null;
}

/**
 * Get all schemas including data schemas (SEEDING/MIGRATIONS ONLY)
 * Used to build registrySchemas for seeding
 * @returns {object} All schema definitions
 */
export function getAllSchemas() {
  return { ...SCHEMAS, ...DATA_SCHEMAS };
}

