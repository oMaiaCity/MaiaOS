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
export { SCHEMA_REF_PATTERN, VIBE_REF_PATTERN, isSchemaRef, isVibeRef } from './patterns.js';

// Export validation helper functions
export { getValidationEngine, validateAgainstSchema, validateAgainstSchemaOrThrow, setSchemaResolver } from './validation.helper.js';

// Meta schema is now loaded from os/meta.schema.json directly (seeding) or from backend (runtime)
// No exports needed - use ValidationEngine.getMetaSchema() for validation engine, or getMetaSchemaFromBackend() for runtime access

// Export schema loader functions (runtime) - consolidated into resolver.js
export { resolve, loadSchemasFromAccount } from '@MaiaOS/db';

// Export schema transformer functions (seeding only)
export { transformForSeeding, validateSchemaStructure } from './schema-transformer.js';

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
import messageTypeSchema from './os/messageType.schema.json';
// Import MaiaScript expression schema
import expressionSchema from './os/maia-script-expression.schema.json';
// Import CoValue schemas
import subscribersSchema from './os/subscribers.schema.json';
import inboxSchema from './os/inbox.schema.json';
import childrenSchema from './os/children.schema.json';
// Import OS infrastructure schemas
import schematasRegistrySchema from './os/schematas-registry.schema.json';
import osRegistrySchema from './os/os-registry.schema.json';
import capabilitiesSchema from './os/capabilities.schema.json';
import indexesRegistrySchema from './os/indexes-registry.schema.json';
import vibesRegistrySchema from './os/vibes-registry.schema.json';
import sparksRegistrySchema from './os/sparks-registry.schema.json';
import humansRegistrySchema from './os/humans-registry.schema.json';
import registriesSchema from './os/registries.schema.json';
// Import data schemas
import todosDataSchema from './data/todos.schema.json';
import chatDataSchema from './data/chat.schema.json';
import sparkDataSchema from './data/spark.schema.json';
// Import message type schemas
import createButtonMessageSchema from './message/CREATE_BUTTON.schema.json';
import toggleButtonMessageSchema from './message/TOGGLE_BUTTON.schema.json';
import deleteButtonMessageSchema from './message/DELETE_BUTTON.schema.json';
import updateInputMessageSchema from './message/UPDATE_INPUT.schema.json';
import switchViewMessageSchema from './message/SWITCH_VIEW.schema.json';
import successMessageSchema from './message/SUCCESS.schema.json';
import errorMessageSchema from './message/ERROR.schema.json';
import sendMessageMessageSchema from './message/SEND_MESSAGE.schema.json';
import retryMessageSchema from './message/RETRY.schema.json';
import dismissMessageSchema from './message/DISMISS.schema.json';
import selectNavMessageSchema from './message/SELECT_NAV.schema.json';
import selectRowMessageSchema from './message/SELECT_ROW.schema.json';
import selectSparkMessageSchema from './message/SELECT_SPARK.schema.json';
import loadActorMessageSchema from './message/LOAD_ACTOR.schema.json';
import updateAgentInputMessageSchema from './message/UPDATE_AGENT_INPUT.schema.json';
import addAgentMessageSchema from './message/ADD_AGENT.schema.json';
import removeMemberMessageSchema from './message/REMOVE_MEMBER.schema.json';

// Unified schema registry (os + data + message)
const SCHEMAS = {
  actor: actorSchema, context: contextSchema, state: stateSchema, view: viewSchema,
  style: styleSchema, brand: styleSchema, 'brand.style': styleSchema, 'actor.style': styleSchema,
  tool: toolSchema, vibe: vibeSchema, message: messageSchema,
  guard: guardSchema, action: actionSchema, transition: transitionSchema,
  messagePayload: messagePayloadSchema, messageType: messageTypeSchema,
  'maia-script-expression': expressionSchema,
  subscribers: subscribersSchema, inbox: inboxSchema, children: childrenSchema,
  'os/schematas-registry': schematasRegistrySchema, 'os/os-registry': osRegistrySchema,
  'os/capabilities': capabilitiesSchema, 'os/indexes-registry': indexesRegistrySchema,
  'os/vibes-registry': vibesRegistrySchema, 'os/sparks-registry': sparksRegistrySchema,
  'os/humans-registry': humansRegistrySchema, 'os/registries': registriesSchema,
  'data/todos': todosDataSchema, 'data/chat': chatDataSchema, 'data/spark': sparkDataSchema,
  'message/CREATE_BUTTON': createButtonMessageSchema, 'message/TOGGLE_BUTTON': toggleButtonMessageSchema,
  'message/DELETE_BUTTON': deleteButtonMessageSchema, 'message/UPDATE_INPUT': updateInputMessageSchema,
  'message/SWITCH_VIEW': switchViewMessageSchema, 'message/SUCCESS': successMessageSchema,
  'message/ERROR': errorMessageSchema, 'message/SEND_MESSAGE': sendMessageMessageSchema,
  'message/RETRY': retryMessageSchema, 'message/DISMISS': dismissMessageSchema,
  'message/SELECT_NAV': selectNavMessageSchema, 'message/SELECT_ROW': selectRowMessageSchema,
  'message/SELECT_SPARK': selectSparkMessageSchema, 'message/LOAD_ACTOR': loadActorMessageSchema,
  'message/UPDATE_AGENT_INPUT': updateAgentInputMessageSchema, 'message/ADD_AGENT': addAgentMessageSchema,
  'message/REMOVE_MEMBER': removeMemberMessageSchema
};

export function getSchema(type) {
  const key = type.startsWith('@maia/schema/') ? type.replace('@maia/schema/', '') : type;
  return SCHEMAS[key] || null;
}

export function getAllSchemas() {
  const msg = {};
  for (const [k, s] of Object.entries(SCHEMAS)) {
    if (k.startsWith('message/')) msg[`@maia/schema/${k}`] = s;
  }
  return { ...SCHEMAS, ...msg };
}

