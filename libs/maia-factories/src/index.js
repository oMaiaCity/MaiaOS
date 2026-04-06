/**
 * Factories - Centralized factory definitions and validation for MaiaOS
 * M4: $id is injected via factory-identity.js (canonical °maia/factory/... per file path).
 */

import { withCanonicalFactorySchema } from './factory-identity.js'
import { ValidationEngine } from './validation.engine.js'

// Export schema transformer functions (seeding only)
export { annotateMaiaConfig } from './annotate-maia.js'
// Export co-id registry (seeding only)
export { CoIdRegistry } from './co-id-generator.js'
// Export co-type definitions
export { default as coTypesDefs } from './co-types.defs.json'
export { executableKeyFromMaiaPath } from './executable-key-from-maia-path.js'
export { FACTORY_PATH_TO_REF, withCanonicalFactorySchema } from './factory-identity.js'
export { transformForSeeding, validateFactoryStructure } from './factory-transformer.js'
export { maiaRefFromPathKey, nanoidFromPath, normalizeMaiaPathKey } from './nanoid.js'
export {
	FACTORY_REF_PATTERN,
	INSTANCE_REF_PATTERN,
	isFactoryRef,
	isInstanceRef,
	isVibeRef,
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
export { ValidationEngine }

import chatDataSchemaRaw from './data/chat.factory.json'
import cobinaryDataSchemaRaw from './data/cobinary.factory.json'
import notesDataSchemaRaw from './data/notes.factory.json'
import profileDataSchemaRaw from './data/profile.factory.json'
import sparkDataSchemaRaw from './data/spark.factory.json'
import todosDataSchemaRaw from './data/todos.factory.json'
import actorSchemaRaw from './os/actor.factory.json'
import avenIdentitySchemaRaw from './os/aven-identity.factory.json'
import avensIdentityRegistrySchemaRaw from './os/avens-identity-registry.factory.json'
import capabilitiesStreamSchemaRaw from './os/capabilities-stream.factory.json'
import capabilitySchemaRaw from './os/capability.factory.json'
import contextSchemaRaw from './os/context.factory.json'
import cotextSchemaRaw from './os/cotext.factory.json'
import eventFactoryRaw from './os/event.factory.json'
import factoriesRegistryFactoryRaw from './os/factories-registry.factory.json'
import groupsSchemaRaw from './os/groups.factory.json'
import humanSchemaRaw from './os/human.factory.json'
import humansRegistrySchemaRaw from './os/humans-registry.factory.json'
import inboxFactoryRaw from './os/inbox.factory.json'
import indexesRegistrySchemaRaw from './os/indexes-registry.factory.json'
import maiaScriptExpressionSchemaRaw from './os/maia-script-expression.factory.json'
import osRegistrySchemaRaw from './os/os-registry.factory.json'
import processSchemaRaw from './os/process.factory.json'
import registriesSchemaRaw from './os/registries.factory.json'
import sparksRegistrySchemaRaw from './os/sparks-registry.factory.json'
import styleSchemaRaw from './os/style.factory.json'
import vibeSchemaRaw from './os/vibe.factory.json'
import vibesRegistrySchemaRaw from './os/vibes-registry.factory.json'
import viewSchemaRaw from './os/view.factory.json'
import wasmSchemaRaw from './os/wasm.factory.json'

const chatDataSchema = withCanonicalFactorySchema(chatDataSchemaRaw, 'data/chat.factory.json')
const cobinaryDataSchema = withCanonicalFactorySchema(
	cobinaryDataSchemaRaw,
	'data/cobinary.factory.json',
)
const notesDataSchema = withCanonicalFactorySchema(notesDataSchemaRaw, 'data/notes.factory.json')
const profileDataSchema = withCanonicalFactorySchema(
	profileDataSchemaRaw,
	'data/profile.factory.json',
)
const sparkDataSchema = withCanonicalFactorySchema(sparkDataSchemaRaw, 'data/spark.factory.json')
const todosDataSchema = withCanonicalFactorySchema(todosDataSchemaRaw, 'data/todos.factory.json')
const actorSchema = withCanonicalFactorySchema(actorSchemaRaw, 'os/actor.factory.json')
const avenIdentitySchema = withCanonicalFactorySchema(
	avenIdentitySchemaRaw,
	'os/aven-identity.factory.json',
)
const avensIdentityRegistrySchema = withCanonicalFactorySchema(
	avensIdentityRegistrySchemaRaw,
	'os/avens-identity-registry.factory.json',
)
const capabilitiesStreamSchema = withCanonicalFactorySchema(
	capabilitiesStreamSchemaRaw,
	'os/capabilities-stream.factory.json',
)
const capabilitySchema = withCanonicalFactorySchema(
	capabilitySchemaRaw,
	'os/capability.factory.json',
)
const contextSchema = withCanonicalFactorySchema(contextSchemaRaw, 'os/context.factory.json')
const cotextSchema = withCanonicalFactorySchema(cotextSchemaRaw, 'os/cotext.factory.json')
const eventFactory = withCanonicalFactorySchema(eventFactoryRaw, 'os/event.factory.json')
const factoriesRegistryFactory = withCanonicalFactorySchema(
	factoriesRegistryFactoryRaw,
	'os/factories-registry.factory.json',
)
const groupsSchema = withCanonicalFactorySchema(groupsSchemaRaw, 'os/groups.factory.json')
const humanSchema = withCanonicalFactorySchema(humanSchemaRaw, 'os/human.factory.json')
const humansRegistrySchema = withCanonicalFactorySchema(
	humansRegistrySchemaRaw,
	'os/humans-registry.factory.json',
)
const inboxFactory = withCanonicalFactorySchema(inboxFactoryRaw, 'os/inbox.factory.json')
const indexesRegistrySchema = withCanonicalFactorySchema(
	indexesRegistrySchemaRaw,
	'os/indexes-registry.factory.json',
)
const maiaScriptExpressionSchema = withCanonicalFactorySchema(
	maiaScriptExpressionSchemaRaw,
	'os/maia-script-expression.factory.json',
)
const osRegistrySchema = withCanonicalFactorySchema(
	osRegistrySchemaRaw,
	'os/os-registry.factory.json',
)
const processSchema = withCanonicalFactorySchema(processSchemaRaw, 'os/process.factory.json')
const registriesSchema = withCanonicalFactorySchema(
	registriesSchemaRaw,
	'os/registries.factory.json',
)
const sparksRegistrySchema = withCanonicalFactorySchema(
	sparksRegistrySchemaRaw,
	'os/sparks-registry.factory.json',
)
const styleSchema = withCanonicalFactorySchema(styleSchemaRaw, 'os/style.factory.json')
const vibeSchema = withCanonicalFactorySchema(vibeSchemaRaw, 'os/vibe.factory.json')
const vibesRegistrySchema = withCanonicalFactorySchema(
	vibesRegistrySchemaRaw,
	'os/vibes-registry.factory.json',
)
const viewSchema = withCanonicalFactorySchema(viewSchemaRaw, 'os/view.factory.json')
const wasmSchema = withCanonicalFactorySchema(wasmSchemaRaw, 'os/wasm.factory.json')

// Unified schema registry (os + data + message)
const FACTORIES = {
	actor: actorSchema,
	context: contextSchema,
	process: processSchema,
	view: viewSchema,
	style: styleSchema,
	brand: styleSchema,
	'brand.style': styleSchema,
	'actor.style': styleSchema,
	vibe: vibeSchema,
	event: eventFactory,
	inbox: inboxFactory,
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
	'maia-script-expression': maiaScriptExpressionSchema,
	'data/cobinary': cobinaryDataSchema,
	'data/notes': notesDataSchema,
	'data/profile': profileDataSchema,
	'data/todos': todosDataSchema,
	'data/chat': chatDataSchema,
	'data/spark': sparkDataSchema,
}

export function getFactory(type) {
	const key = type.startsWith('°maia/factory/') ? type.replace('°maia/factory/', '') : type
	return FACTORIES[key] || null
}

export function getAllFactories() {
	return { ...FACTORIES }
}
