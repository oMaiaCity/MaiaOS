/**
 * Factory schema registry — loaded asynchronously so Bun HTML + HMR never evaluates
 * static `.maia` imports at module init (empty exports). Dev: GET /__maia_dev/factories.json.
 */

import { withCanonicalFactorySchema } from './identity-from-maia-path.js'

/** Basename → key in getAllFactories() return object. */
const FACTORY_BASENAME_TO_REGISTRY_KEY = {
	'actor.factory.maia': 'actor',
	'aven-identity.factory.maia': 'os/aven-identity',
	'avens-identity-registry.factory.maia': 'os/avens-identity-registry',
	'capability.factory.maia': 'os/capability',
	'context.factory.maia': 'context',
	'cotext.factory.maia': 'os/cotext',
	'event.factory.maia': 'event',
	'factories-registry.factory.maia': 'os/factories-registry',
	'groups.factory.maia': 'os/groups',
	'human.factory.maia': 'os/human',
	'humans-registry.factory.maia': 'os/humans-registry',
	'inbox.factory.maia': 'inbox',
	'indexes-registry.factory.maia': 'os/indexes-registry',
	'maia-script-expression.factory.maia': 'maia-script-expression',
	'os-registry.factory.maia': 'os/os-registry',
	'process.factory.maia': 'process',
	'registries.factory.maia': 'os/registries',
	'sparks-registry.factory.maia': 'os/sparks-registry',
	'style.factory.maia': 'style',
	'vibe.factory.maia': 'vibe',
	'vibes-registry.factory.maia': 'os/vibes-registry',
	'view.factory.maia': 'view',
	'wasm.factory.maia': 'os/wasm',
	'chat.factory.maia': 'data/chat',
	'cobinary.factory.maia': 'data/cobinary',
	'notes.factory.maia': 'data/notes',
	'profile.factory.maia': 'data/profile',
	'spark.factory.maia': 'data/spark',
	'todos.factory.maia': 'data/todos',
}

/** @type {Record<string, object> | null} */
let FACTORIES = null

/** Factory disk basenames → °maia/factory/<basename> via maiaFactoryLabel (maiaIdentity). */
const UNIQUE_PATH_KEYS = [
	'actor.factory.maia',
	'aven-identity.factory.maia',
	'avens-identity-registry.factory.maia',
	'capability.factory.maia',
	'chat.factory.maia',
	'cobinary.factory.maia',
	'context.factory.maia',
	'cotext.factory.maia',
	'event.factory.maia',
	'factories-registry.factory.maia',
	'groups.factory.maia',
	'human.factory.maia',
	'humans-registry.factory.maia',
	'inbox.factory.maia',
	'indexes-registry.factory.maia',
	'maia-script-expression.factory.maia',
	'notes.factory.maia',
	'os-registry.factory.maia',
	'process.factory.maia',
	'profile.factory.maia',
	'registries.factory.maia',
	'spark.factory.maia',
	'sparks-registry.factory.maia',
	'style.factory.maia',
	'todos.factory.maia',
	'vibe.factory.maia',
	'vibes-registry.factory.maia',
	'view.factory.maia',
	'wasm.factory.maia',
]

const UNIVERSE_FACTORY_IMPORTS = {
	'actor.factory.maia': () => import('@MaiaOS/universe/factories/actor.factory.maia'),
	'aven-identity.factory.maia': () =>
		import('@MaiaOS/universe/factories/aven-identity.factory.maia'),
	'avens-identity-registry.factory.maia': () =>
		import('@MaiaOS/universe/factories/avens-identity-registry.factory.maia'),
	'capability.factory.maia': () => import('@MaiaOS/universe/factories/capability.factory.maia'),
	'chat.factory.maia': () => import('@MaiaOS/universe/factories/chat.factory.maia'),
	'cobinary.factory.maia': () => import('@MaiaOS/universe/factories/cobinary.factory.maia'),
	'context.factory.maia': () => import('@MaiaOS/universe/factories/context.factory.maia'),
	'cotext.factory.maia': () => import('@MaiaOS/universe/factories/cotext.factory.maia'),
	'event.factory.maia': () => import('@MaiaOS/universe/factories/event.factory.maia'),
	'factories-registry.factory.maia': () =>
		import('@MaiaOS/universe/factories/factories-registry.factory.maia'),
	'groups.factory.maia': () => import('@MaiaOS/universe/factories/groups.factory.maia'),
	'human.factory.maia': () => import('@MaiaOS/universe/factories/human.factory.maia'),
	'humans-registry.factory.maia': () =>
		import('@MaiaOS/universe/factories/humans-registry.factory.maia'),
	'inbox.factory.maia': () => import('@MaiaOS/universe/factories/inbox.factory.maia'),
	'indexes-registry.factory.maia': () =>
		import('@MaiaOS/universe/factories/indexes-registry.factory.maia'),
	'maia-script-expression.factory.maia': () =>
		import('@MaiaOS/universe/factories/maia-script-expression.factory.maia'),
	'notes.factory.maia': () => import('@MaiaOS/universe/factories/notes.factory.maia'),
	'os-registry.factory.maia': () => import('@MaiaOS/universe/factories/os-registry.factory.maia'),
	'process.factory.maia': () => import('@MaiaOS/universe/factories/process.factory.maia'),
	'profile.factory.maia': () => import('@MaiaOS/universe/factories/profile.factory.maia'),
	'registries.factory.maia': () => import('@MaiaOS/universe/factories/registries.factory.maia'),
	'spark.factory.maia': () => import('@MaiaOS/universe/factories/spark.factory.maia'),
	'sparks-registry.factory.maia': () =>
		import('@MaiaOS/universe/factories/sparks-registry.factory.maia'),
	'style.factory.maia': () => import('@MaiaOS/universe/factories/style.factory.maia'),
	'todos.factory.maia': () => import('@MaiaOS/universe/factories/todos.factory.maia'),
	'vibe.factory.maia': () => import('@MaiaOS/universe/factories/vibe.factory.maia'),
	'vibes-registry.factory.maia': () =>
		import('@MaiaOS/universe/factories/vibes-registry.factory.maia'),
	'view.factory.maia': () => import('@MaiaOS/universe/factories/view.factory.maia'),
	'wasm.factory.maia': () => import('@MaiaOS/universe/factories/wasm.factory.maia'),
}

async function importUniverseFactory(pathKey) {
	const loader = UNIVERSE_FACTORY_IMPORTS[pathKey]
	if (!loader) {
		throw new Error(`[factory-registry] unknown pathKey: ${pathKey}`)
	}
	const mod = await loader()
	const raw = mod.default ?? mod
	if (!raw || typeof raw !== 'object') {
		throw new Error(`[factory-registry] ${pathKey} did not load as an object`)
	}
	return raw
}

/**
 * @returns {Promise<Record<string, object>>} pathKey → parsed JSON
 */
async function loadRawByPathKey() {
	const origin = typeof globalThis.location !== 'undefined' ? globalThis.location.origin : ''
	if (origin) {
		const r = await fetch(`${origin}/__maia_dev/factories.json`, { credentials: 'same-origin' })
		if (r.ok) {
			return await r.json()
		}
	}

	const out = {}
	await Promise.all(
		UNIQUE_PATH_KEYS.map(async (pathKey) => {
			out[pathKey] = await importUniverseFactory(pathKey)
		}),
	)
	return out
}

function buildFactories(rawByPathKey) {
	const p = (pathKey) => {
		const raw = rawByPathKey[pathKey]
		if (!raw || typeof raw !== 'object') {
			throw new Error(`[factory-registry] missing schema for ${pathKey}`)
		}
		return withCanonicalFactorySchema(
			typeof structuredClone === 'function' ? structuredClone(raw) : JSON.parse(JSON.stringify(raw)),
			pathKey,
		)
	}

	const actorSchema = p('actor.factory.maia')
	const avenIdentitySchema = p('aven-identity.factory.maia')
	const avensIdentityRegistrySchema = p('avens-identity-registry.factory.maia')
	const capabilitySchema = p('capability.factory.maia')
	const chatDataSchema = p('chat.factory.maia')
	const cobinaryDataSchema = p('cobinary.factory.maia')
	const contextSchema = p('context.factory.maia')
	const cotextSchema = p('cotext.factory.maia')
	const eventFactory = p('event.factory.maia')
	const factoriesRegistryFactory = p('factories-registry.factory.maia')
	const groupsSchema = p('groups.factory.maia')
	const humanSchema = p('human.factory.maia')
	const humansRegistrySchema = p('humans-registry.factory.maia')
	const inboxFactory = p('inbox.factory.maia')
	const indexesRegistrySchema = p('indexes-registry.factory.maia')
	const maiaScriptExpressionSchema = p('maia-script-expression.factory.maia')
	const notesDataSchema = p('notes.factory.maia')
	const osRegistrySchema = p('os-registry.factory.maia')
	const processSchema = p('process.factory.maia')
	const profileDataSchema = p('profile.factory.maia')
	const registriesSchema = p('registries.factory.maia')
	const sparkDataSchema = p('spark.factory.maia')
	const sparksRegistrySchema = p('sparks-registry.factory.maia')
	const styleSchema = p('style.factory.maia')
	const todosDataSchema = p('todos.factory.maia')
	const vibeSchema = p('vibe.factory.maia')
	const vibesRegistrySchema = p('vibes-registry.factory.maia')
	const viewSchema = p('view.factory.maia')
	const wasmSchema = p('wasm.factory.maia')

	return {
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
}

export async function ensureFactoriesLoaded() {
	if (FACTORIES) return
	const rawByPathKey = await loadRawByPathKey()
	FACTORIES = buildFactories(rawByPathKey)
}

export function getFactory(type) {
	if (!FACTORIES) {
		throw new Error('[factories] Call ensureFactoriesLoaded() before getFactory()')
	}
	if (type.startsWith('°maia/factory/')) {
		const rest = type.slice('°maia/factory/'.length)
		if (!rest.endsWith('.factory.maia')) return null
		const regKey = FACTORY_BASENAME_TO_REGISTRY_KEY[rest]
		return regKey ? (FACTORIES[regKey] ?? null) : null
	}
	return FACTORIES[type] ?? null
}

export function getAllFactories() {
	if (!FACTORIES) {
		throw new Error('[factories] Call ensureFactoriesLoaded() before getAllFactories()')
	}
	return { ...FACTORIES }
}
