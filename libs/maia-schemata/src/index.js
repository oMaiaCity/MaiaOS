/**
 * Schemata - Centralized JSON Schema definitions and validation for MaiaOS
 *
 * This module provides:
 * - ValidationEngine: Unified validation API for all MaiaOS data types
 * - Schema definitions: Imported directly from JSON files
 */

// Import ValidationEngine for getMetaSchema (must import before using)
import { ValidationEngine } from './validation.engine.js'

export { ValidationEngine }
export {
	ACTOR_CONFIG_REF_PATTERN,
	AGENT_ACTOR_REF_PATTERN,
	AGENT_REF_PATTERN,
	INSTANCE_REF_PATTERN,
	isAgentRef,
	isInstanceRef,
	isSchemaRef,
	SCHEMA_REF_PATTERN,
} from './patterns.js'
// Export validation helper functions
export {
	getValidationEngine,
	setSchemaResolver,
	validateAgainstSchema,
	validateAgainstSchemaOrThrow,
} from './validation.helper.js'
export { ValidationPluginRegistry } from './validation-plugin-registry.js'
export { validateViewDef } from './view-validator.js'

// Meta schema is now loaded from os/meta.schema.json directly (seeding) or from backend (runtime)
// No exports needed - use ValidationEngine.getMetaSchema() for validation engine, or getMetaSchemaFromPeer() for runtime access

// loadSchemasFromAccount, resolve: import from @MaiaOS/db directly (schemata must not depend on db)
// Export co-id registry (seeding only)
export { CoIdRegistry } from './co-id-generator.js'
// Export co-type definitions
export { default as coTypesDefs } from './co-types.defs.json'
// Export schema transformer functions (seeding only)
export { transformForSeeding, validateSchemaStructure } from './schema-transformer.js'

// Export meta schema for seeding
export function getMetaSchema() {
	return ValidationEngine.getMetaSchema()
}

import chatDataSchema from './data/chat.schema.json'
// Import data schemas
import cotextDataSchema from './data/cotext.schema.json'
import humanDataSchema from './data/human.schema.json'
import notesDataSchema from './data/notes.schema.json'
import sparkDataSchema from './data/spark.schema.json'
import todosDataSchema from './data/todos.schema.json'
import addAgentEventSchema from './event/ADD_AGENT.schema.json'
import chatEventSchema from './event/CHAT.schema.json'
import closePopupEventSchema from './event/CLOSE_POPUP.schema.json'
import copyLogsEventSchema from './event/COPY_LOGS.schema.json'
import createButtonEventSchema from './event/CREATE_BUTTON.schema.json'
import dbOpEventSchema from './event/DB_OP.schema.json'
import deleteButtonEventSchema from './event/DELETE_BUTTON.schema.json'
import dismissEventSchema from './event/DISMISS.schema.json'
import errorEventSchema from './event/ERROR.schema.json'
import formSubmitEventSchema from './event/FORM_SUBMIT.schema.json'
import loadActorEventSchema from './event/LOAD_ACTOR.schema.json'
import openPopupEventSchema from './event/OPEN_POPUP.schema.json'
import randomizePaperEventSchema from './event/RANDOMIZE_PAPER.schema.json'
import removeMemberEventSchema from './event/REMOVE_MEMBER.schema.json'
import retryEventSchema from './event/RETRY.schema.json'
import selectActorEventSchema from './event/SELECT_ACTOR.schema.json'
import selectNavEventSchema from './event/SELECT_NAV.schema.json'
import selectRowEventSchema from './event/SELECT_ROW.schema.json'
import selectSchemaEventSchema from './event/SELECT_SCHEMA.schema.json'
import selectSparkEventSchema from './event/SELECT_SPARK.schema.json'
import sendMessageEventSchema from './event/SEND_MESSAGE.schema.json'
import sparkOpEventSchema from './event/SPARK_OP.schema.json'
import statusUpdateEventSchema from './event/STATUS_UPDATE.schema.json'
import successEventSchema from './event/SUCCESS.schema.json'
import switchViewEventSchema from './event/SWITCH_VIEW.schema.json'
import toggleButtonEventSchema from './event/TOGGLE_BUTTON.schema.json'
import updateAgentInputEventSchema from './event/UPDATE_AGENT_INPUT.schema.json'
import updateInputEventSchema from './event/UPDATE_INPUT.schema.json'
import updatePaperEventSchema from './event/UPDATE_PAPER.schema.json'
import actionSchema from './os/action.schema.json'
// Import all schema definitions directly as JSON
import actorSchema from './os/actor.schema.json'
import agentSchema from './os/agent.schema.json'
import agentsRegistrySchema from './os/agents-registry.schema.json'
import capabilitiesSchema from './os/capabilities.schema.json'
import childrenSchema from './os/children.schema.json'
import contextSchema from './os/context.schema.json'
import eventSchema from './os/event.schema.json'
// Import extracted $defs as separate schemas
import guardSchema from './os/guard.schema.json'
import humanSchema from './os/human.schema.json'
import humansRegistrySchema from './os/humans-registry.schema.json'
import inboxSchema from './os/inbox.schema.json'
import indexesRegistrySchema from './os/indexes-registry.schema.json'
// Import MaiaScript expression schema
import expressionSchema from './os/maia-script-expression.schema.json'
import messagePayloadSchema from './os/messagePayload.schema.json'
import messageTypeSchema from './os/messageType.schema.json'
import osRegistrySchema from './os/os-registry.schema.json'
import processSchema from './os/process.schema.json'
import registriesSchema from './os/registries.schema.json'
// Import OS infrastructure schemas
import schematasRegistrySchema from './os/schematas-registry.schema.json'
import sparksRegistrySchema from './os/sparks-registry.schema.json'
import stateSchema from './os/state.schema.json'
import styleSchema from './os/style.schema.json'
// Import CoValue schemas
import subscribersSchema from './os/subscribers.schema.json'
import toolSchema from './os/tool.schema.json'
import transitionSchema from './os/transition.schema.json'
import viewSchema from './os/view.schema.json'

// Unified schema registry (os + data + message)
const SCHEMAS = {
	actor: actorSchema,
	tool: toolSchema,
	context: contextSchema,
	process: processSchema,
	state: stateSchema,
	view: viewSchema,
	style: styleSchema,
	brand: styleSchema,
	'brand.style': styleSchema,
	'actor.style': styleSchema,
	agent: agentSchema,
	event: eventSchema,
	guard: guardSchema,
	action: actionSchema,
	transition: transitionSchema,
	messagePayload: messagePayloadSchema,
	messageType: messageTypeSchema,
	'maia-script-expression': expressionSchema,
	subscribers: subscribersSchema,
	inbox: inboxSchema,
	children: childrenSchema,
	'os/schematas-registry': schematasRegistrySchema,
	'os/os-registry': osRegistrySchema,
	'os/capabilities': capabilitiesSchema,
	'os/indexes-registry': indexesRegistrySchema,
	'os/agents-registry': agentsRegistrySchema,
	'os/sparks-registry': sparksRegistrySchema,
	'os/human': humanSchema,
	'os/humans-registry': humansRegistrySchema,
	'os/registries': registriesSchema,
	'data/cotext': cotextDataSchema,
	'data/notes': notesDataSchema,
	'data/todos': todosDataSchema,
	'data/chat': chatDataSchema,
	'data/human': humanDataSchema,
	'data/spark': sparkDataSchema,
	'event/CREATE_BUTTON': createButtonEventSchema,
	'event/FORM_SUBMIT': formSubmitEventSchema,
	'event/CHAT': chatEventSchema,
	'event/DB_OP': dbOpEventSchema,
	'event/SPARK_OP': sparkOpEventSchema,
	'event/TOGGLE_BUTTON': toggleButtonEventSchema,
	'event/DELETE_BUTTON': deleteButtonEventSchema,
	'event/UPDATE_INPUT': updateInputEventSchema,
	'event/UPDATE_PAPER': updatePaperEventSchema,
	'event/RANDOMIZE_PAPER': randomizePaperEventSchema,
	'event/SWITCH_VIEW': switchViewEventSchema,
	'event/SUCCESS': successEventSchema,
	'event/ERROR': errorEventSchema,
	'event/SEND_MESSAGE': sendMessageEventSchema,
	'event/STATUS_UPDATE': statusUpdateEventSchema,
	'event/RETRY': retryEventSchema,
	'event/DISMISS': dismissEventSchema,
	'event/SELECT_NAV': selectNavEventSchema,
	'event/SELECT_ROW': selectRowEventSchema,
	'event/SELECT_ACTOR': selectActorEventSchema,
	'event/SELECT_SCHEMA': selectSchemaEventSchema,
	'event/SELECT_SPARK': selectSparkEventSchema,
	'event/LOAD_ACTOR': loadActorEventSchema,
	'event/UPDATE_AGENT_INPUT': updateAgentInputEventSchema,
	'event/ADD_AGENT': addAgentEventSchema,
	'event/REMOVE_MEMBER': removeMemberEventSchema,
	'event/OPEN_POPUP': openPopupEventSchema,
	'event/CLOSE_POPUP': closePopupEventSchema,
	'event/COPY_LOGS': copyLogsEventSchema,
}

export function getSchema(type) {
	const key = type.startsWith('°Maia/schema/') ? type.replace('°Maia/schema/', '') : type
	return SCHEMAS[key] || null
}

export function getAllSchemas() {
	const msg = {}
	for (const [k, s] of Object.entries(SCHEMAS)) {
		if (k.startsWith('event/')) msg[`°Maia/schema/${k}`] = s
	}
	return { ...SCHEMAS, ...msg }
}
