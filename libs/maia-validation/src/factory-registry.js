/**
 * Factory schema registry — single source: FACTORY_SCHEMAS from universe codegen.
 * Dev (browser): GET /__maia_dev/factories.json when available (HMR).
 */

import { withCanonicalFactorySchema } from './identity-from-maia-path.js'

/** Basename → key in getAllFactories() return object. */
const FACTORY_BASENAME_TO_REGISTRY_KEY = {
	'actor.factory.maia': 'actor',
	'capability.factory.maia': 'os/capability',
	'context.factory.maia': 'context',
	'cotext.factory.maia': 'os/cotext',
	'event.factory.maia': 'event',
	'factories-registry.factory.maia': 'os/factories-registry',
	'groups.factory.maia': 'os/groups',
	'identity.factory.maia': 'os/identity',
	'icon.factory.maia': 'data/icon',
	'inbox.factory.maia': 'inbox',
	'indexes-registry.factory.maia': 'os/indexes-registry',
	'maia-script-expression.factory.maia': 'maia-script-expression',
	'note.factory.maia': 'data/notes',
	'os-registry.factory.maia': 'os/os-registry',
	'process.factory.maia': 'process',
	'sparks-registry.factory.maia': 'os/sparks-registry',
	'style.factory.maia': 'style',
	'todo.factory.maia': 'data/todos',
	'vibe.factory.maia': 'vibe',
	'vibes-registry.factory.maia': 'os/vibes-registry',
	'view.factory.maia': 'view',
	'wasm.factory.maia': 'os/wasm',
	'chat.factory.maia': 'data/chat',
	'cobinary.factory.maia': 'data/cobinary',
	'profile.factory.maia': 'data/profile',
	'spark.factory.maia': 'data/spark',
}

/** @type {Record<string, object> | null} */
let FACTORIES = null

/**
 * @param {Record<string, object>} rawByBasename
 */
function buildFactories(rawByBasename) {
	const p = (pathKey) => {
		const raw = rawByBasename[pathKey]
		if (!raw || typeof raw !== 'object') {
			throw new Error(`[factory-registry] missing schema for ${pathKey}`)
		}
		return withCanonicalFactorySchema(
			typeof structuredClone === 'function' ? structuredClone(raw) : JSON.parse(JSON.stringify(raw)),
			pathKey,
		)
	}

	const actorSchema = p('actor.factory.maia')
	const capabilitySchema = p('capability.factory.maia')
	const chatDataSchema = p('chat.factory.maia')
	const cobinaryDataSchema = p('cobinary.factory.maia')
	const contextSchema = p('context.factory.maia')
	const cotextSchema = p('cotext.factory.maia')
	const eventFactory = p('event.factory.maia')
	const factoriesRegistryFactory = p('factories-registry.factory.maia')
	const groupsSchema = p('groups.factory.maia')
	const identitySchema = p('identity.factory.maia')
	const inboxFactory = p('inbox.factory.maia')
	const indexesRegistrySchema = p('indexes-registry.factory.maia')
	const maiaScriptExpressionSchema = p('maia-script-expression.factory.maia')
	const iconDataSchema = p('icon.factory.maia')
	const notesDataSchema = p('note.factory.maia')
	const osRegistrySchema = p('os-registry.factory.maia')
	const processSchema = p('process.factory.maia')
	const profileDataSchema = p('profile.factory.maia')
	const sparkDataSchema = p('spark.factory.maia')
	const sparksRegistrySchema = p('sparks-registry.factory.maia')
	const styleSchema = p('style.factory.maia')
	const todosDataSchema = p('todo.factory.maia')
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
		'os/identity': identitySchema,
		'os/vibes-registry': vibesRegistrySchema,
		'os/sparks-registry': sparksRegistrySchema,
		'os/cotext': cotextSchema,
		'os/wasm': wasmSchema,
		'maia-script-expression': maiaScriptExpressionSchema,
		'data/cobinary': cobinaryDataSchema,
		'data/notes': notesDataSchema,
		'data/icon': iconDataSchema,
		'data/profile': profileDataSchema,
		'data/todos': todosDataSchema,
		'data/chat': chatDataSchema,
		'data/spark': sparkDataSchema,
	}
}

async function loadRawByBasename() {
	const origin = typeof globalThis.location !== 'undefined' ? globalThis.location.origin : ''
	if (origin) {
		const r = await fetch(`${origin}/__maia_dev/factories.json`, { credentials: 'same-origin' })
		if (r.ok) {
			return await r.json()
		}
	}
	const { FACTORY_SCHEMAS } = await import('@MaiaOS/universe/generated/registry.js')
	return FACTORY_SCHEMAS
}

export async function ensureFactoriesLoaded() {
	if (FACTORIES) return
	const raw = await loadRawByBasename()
	FACTORIES = buildFactories(raw)
}

/**
 * Resolve short stem (e.g. `note` → `note.factory.maia`) when not a full basename.
 * @param {string} rest
 */
function basenameFromFactoryRef(rest) {
	if (rest.endsWith('.factory.maia')) return rest
	const map = {
		actor: 'actor.factory.maia',
		note: 'note.factory.maia',
		todo: 'todo.factory.maia',
		icon: 'icon.factory.maia',
		vibe: 'vibe.factory.maia',
		view: 'view.factory.maia',
	}
	return map[rest] ?? `${rest}.factory.maia`
}

export function getFactory(type) {
	if (!FACTORIES) {
		throw new Error('[factories] Call ensureFactoriesLoaded() before getFactory()')
	}
	if (type.startsWith('°maia/factory/')) {
		let rest = type.slice('°maia/factory/'.length)
		rest = basenameFromFactoryRef(rest)
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
