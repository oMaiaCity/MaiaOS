/**
 * Factory schema registry — single source: FACTORY_SCHEMAS from universe codegen.
 * Dev (browser): GET /__maia_dev/factories.json when available (HMR).
 */

import { withCanonicalFactorySchema } from './identity-from-maia-path.js'

/** Basename → key in getAllFactories() return object. */
const FACTORY_BASENAME_TO_REGISTRY_KEY = {
	'actor.factory.json': 'actor',
	'capability.factory.json': 'os/capability',
	'context.factory.json': 'context',
	'cotext.factory.json': 'os/cotext',
	'event.factory.json': 'event',
	'factories-registry.factory.json': 'os/factories-registry',
	'groups.factory.json': 'os/groups',
	'identity.factory.json': 'os/identity',
	'icon.factory.json': 'data/icon',
	'inbox.factory.json': 'inbox',
	'indexes-registry.factory.json': 'os/indexes-registry',
	'maia-script-expression.factory.json': 'maia-script-expression',
	'note.factory.json': 'data/notes',
	'os-registry.factory.json': 'os/os-registry',
	'process.factory.json': 'process',
	'sparks-registry.factory.json': 'os/sparks-registry',
	'style.factory.json': 'style',
	'todo.factory.json': 'data/todos',
	'vibe.factory.json': 'vibe',
	'vibes-registry.factory.json': 'os/vibes-registry',
	'view.factory.json': 'view',
	'wasm.factory.json': 'os/wasm',
	'chat.factory.json': 'data/chat',
	'cobinary.factory.json': 'data/cobinary',
	'profile.factory.json': 'data/profile',
	'spark.factory.json': 'data/spark',
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

	const actorSchema = p('actor.factory.json')
	const capabilitySchema = p('capability.factory.json')
	const chatDataSchema = p('chat.factory.json')
	const cobinaryDataSchema = p('cobinary.factory.json')
	const contextSchema = p('context.factory.json')
	const cotextSchema = p('cotext.factory.json')
	const eventFactory = p('event.factory.json')
	const factoriesRegistryFactory = p('factories-registry.factory.json')
	const groupsSchema = p('groups.factory.json')
	const identitySchema = p('identity.factory.json')
	const inboxFactory = p('inbox.factory.json')
	const indexesRegistrySchema = p('indexes-registry.factory.json')
	const maiaScriptExpressionSchema = p('maia-script-expression.factory.json')
	const iconDataSchema = p('icon.factory.json')
	const notesDataSchema = p('note.factory.json')
	const osRegistrySchema = p('os-registry.factory.json')
	const processSchema = p('process.factory.json')
	const profileDataSchema = p('profile.factory.json')
	const sparkDataSchema = p('spark.factory.json')
	const sparksRegistrySchema = p('sparks-registry.factory.json')
	const styleSchema = p('style.factory.json')
	const todosDataSchema = p('todo.factory.json')
	const vibeSchema = p('vibe.factory.json')
	const vibesRegistrySchema = p('vibes-registry.factory.json')
	const viewSchema = p('view.factory.json')
	const wasmSchema = p('wasm.factory.json')

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
	const { FACTORY_SCHEMAS } = await import(
		new URL('../../universe/src/avens/maia/migrations/002-factories/generated.js', import.meta.url)
			.href
	)
	return FACTORY_SCHEMAS
}

export async function ensureFactoriesLoaded() {
	if (FACTORIES) return
	const raw = await loadRawByBasename()
	FACTORIES = buildFactories(raw)
}

/**
 * Resolve short stem (e.g. `note` → `note.factory.json`) when not a full basename.
 * @param {string} rest
 */
function basenameFromFactoryRef(rest) {
	if (rest.endsWith('.factory.json')) return rest
	const map = {
		actor: 'actor.factory.json',
		note: 'note.factory.json',
		todo: 'todo.factory.json',
		icon: 'icon.factory.json',
		vibe: 'vibe.factory.json',
		view: 'view.factory.json',
	}
	return map[rest] ?? `${rest}.factory.json`
}

export function getFactory(type) {
	if (!FACTORIES) {
		throw new Error('[factories] Call ensureFactoriesLoaded() before getFactory()')
	}
	if (type.startsWith('°maia/factory/')) {
		let rest = type.slice('°maia/factory/'.length)
		rest = basenameFromFactoryRef(rest)
		if (!rest.endsWith('.factory.json')) return null
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
