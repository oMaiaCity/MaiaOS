/**
 * Factories - Centralized factory definitions and validation for MaiaOS
 */

import { ValidationEngine } from './validation.engine.js'

export { ValidationEngine }

// Export co-id registry (seeding only)
export { CoIdRegistry } from './co-id-generator.js'
// Export co-type definitions
export { default as coTypesDefs } from './co-types.defs.json'
// Export schema transformer functions (seeding only)
export { transformForSeeding, validateFactoryStructure } from './factory-transformer.js'
export {
	ACTOR_CONFIG_REF_PATTERN,
	FACTORY_REF_PATTERN,
	INSTANCE_REF_PATTERN,
	isFactoryRef,
	isInstanceRef,
	isVibeRef,
	VIBE_ACTOR_REF_PATTERN,
	VIBE_REF_PATTERN,
} from './patterns.js'
// Export validation helper functions
export {
	getValidationEngine,
	setFactoryResolver,
	validateAgainstFactory,
	validateAgainstFactoryOrThrow,
} from './validation.helper.js'
export { validateViewDef } from './view-validator.js'

import chatDataSchema from './data/chat.factory.json'
// Import data schemas
import cobinaryDataSchema from './data/cobinary.factory.json'
import notesDataSchema from './data/notes.factory.json'
import profileDataSchema from './data/profile.factory.json'
import sparkDataSchema from './data/spark.factory.json'
import todosDataSchema from './data/todos.factory.json'
import actionSchema from './os/action.factory.json'
// Import all schema definitions directly as JSON
import actorSchema from './os/actor.factory.json'
import avenIdentitySchema from './os/aven-identity.factory.json'
import avensIdentityRegistrySchema from './os/avens-identity-registry.factory.json'
import capabilitiesStreamSchema from './os/capabilities-stream.factory.json'
import capabilitySchema from './os/capability.factory.json'
import childrenSchema from './os/children.factory.json'
import contextSchema from './os/context.factory.json'
import cotextSchema from './os/cotext.factory.json'
import eventFactory from './os/event.factory.json'
// Import OS infrastructure schemas
import factoriesRegistryFactory from './os/factories-registry.factory.json'
import groupsSchema from './os/groups.factory.json'
// Import extracted $defs as separate schemas
import guardSchema from './os/guard.factory.json'
import humanSchema from './os/human.factory.json'
import humansRegistrySchema from './os/humans-registry.factory.json'
import inboxFactory from './os/inbox.factory.json'
import indexesRegistrySchema from './os/indexes-registry.factory.json'
// Import MaiaScript expression factory
import expressionFactory from './os/maia-script-expression.factory.json'
import messagePayloadSchema from './os/messagePayload.factory.json'
import messageTypeSchema from './os/messageType.factory.json'
import osRegistrySchema from './os/os-registry.factory.json'
import processSchema from './os/process.factory.json'
import registriesSchema from './os/registries.factory.json'
import sparksRegistrySchema from './os/sparks-registry.factory.json'
import stateSchema from './os/state.factory.json'
import styleSchema from './os/style.factory.json'
// Import CoValue schemas
import subscribersSchema from './os/subscribers.factory.json'
import transitionSchema from './os/transition.factory.json'
import vibeSchema from './os/vibe.factory.json'
import vibesRegistrySchema from './os/vibes-registry.factory.json'
import viewSchema from './os/view.factory.json'
import wasmSchema from './os/wasm.factory.json'

// Unified schema registry (os + data + message)
const FACTORIES = {
	actor: actorSchema,
	context: contextSchema,
	process: processSchema,
	state: stateSchema,
	view: viewSchema,
	style: styleSchema,
	brand: styleSchema,
	'brand.style': styleSchema,
	'actor.style': styleSchema,
	vibe: vibeSchema,
	event: eventFactory,
	guard: guardSchema,
	action: actionSchema,
	transition: transitionSchema,
	messagePayload: messagePayloadSchema,
	messageType: messageTypeSchema,
	'maia-script-expression': expressionFactory,
	subscribers: subscribersSchema,
	inbox: inboxFactory,
	children: childrenSchema,
	'os/factories-registry': factoriesRegistryFactory,
	'os/os-registry': osRegistrySchema,
	'os/capability': capabilitySchema,
	'os/capabilities-stream': capabilitiesStreamSchema,
	'os/groups': groupsSchema,
	'os/indexes-registry': indexesRegistrySchema,
	'os/aven-identity': avenIdentitySchema,
	'os/avens-identity-registry': avensIdentityRegistrySchema,
	'os/vibes-registry': vibesRegistrySchema,
	'os/sparks-registry': sparksRegistrySchema,
	'os/cotext': cotextSchema,
	'os/wasm': wasmSchema,
	'os/human': humanSchema,
	'os/humans-registry': humansRegistrySchema,
	'os/registries': registriesSchema,
	'data/cobinary': cobinaryDataSchema,
	'data/notes': notesDataSchema,
	'data/profile': profileDataSchema,
	'data/todos': todosDataSchema,
	'data/chat': chatDataSchema,
	'data/spark': sparkDataSchema,
}

export function getFactory(type) {
	const key = type.startsWith('°Maia/factory/') ? type.replace('°Maia/factory/', '') : type
	return FACTORIES[key] || null
}

export function getAllFactories() {
	return { ...FACTORIES }
}
