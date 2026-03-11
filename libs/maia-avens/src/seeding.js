/**
 * Avens Seeding API - Cycle-free entry for moai genesis
 *
 * No dependency on @MaiaOS/loader - safe for static import in bundled moai-server.mjs.
 * Used by loader for getAllAvenRegistries, buildSeedConfig, filterAvensForSeeding.
 */

import { ChatAvenRegistry } from './chat/registry.js'
import { LogsAvenRegistry } from './creator/registry.js'
import { HumansAvenRegistry } from './humans/registry.js'
import { SparksAvenRegistry } from './sparks/registry.js'
import { TodosAvenRegistry } from './todos/registry.js'

const ALL_REGISTRIES = [
	TodosAvenRegistry,
	ChatAvenRegistry,
	SparksAvenRegistry,
	LogsAvenRegistry,
	HumansAvenRegistry,
]

function getAvenKey(aven) {
	if (!aven) return null
	const originalAvenId = aven.$id || ''
	if (originalAvenId.startsWith('°Maia/aven/')) {
		return originalAvenId.replace('°Maia/aven/', '')
	}
	return (aven.name || 'default').toLowerCase().replace(/\s+/g, '-')
}

const AVEN_SCHEMA = '°Maia/schema/aven'
const INBOX_SCHEMA = '°Maia/schema/inbox'

/** Derive inbox namekey from actor $id (same convention as engine). */
function deriveInboxId(actorId) {
	if (!actorId || typeof actorId !== 'string') return null
	if (actorId.includes('/actor/') && !actorId.startsWith('°Maia/actor/')) {
		return actorId.replace('/actor/', '/inbox/')
	}
	if (actorId.includes('/')) return `${actorId}/inbox`
	return null
}

function normalizeAvenForSeeding(aven) {
	if (!aven || typeof aven !== 'object') {
		throw new Error('[avens] Aven must be a non-null object')
	}
	const key = getAvenKey(aven)
	const normalized = { ...aven }
	if (!normalized.$schema || typeof normalized.$schema !== 'string') {
		normalized.$schema = AVEN_SCHEMA
	}
	if (!normalized.$id || !normalized.$id.startsWith('°Maia/aven/')) {
		normalized.$id = `°Maia/aven/${key}`
	}
	if (!Array.isArray(normalized.runtime)) {
		normalized.runtime = ['browser']
	}
	return normalized
}

export async function getAllAvenRegistries() {
	return ALL_REGISTRIES.filter((R) => R?.aven)
}

export function buildSeedConfig(avenRegistries) {
	const validRegistries = avenRegistries.filter((r) => r?.aven && typeof r.aven === 'object')
	if (avenRegistries.length > 0 && validRegistries.length === 0) {
		throw new Error(
			'[avens] All aven manifests invalid (null or not object). Ensure .maia files load as JSON (bunfig.toml: [loader] ".maia" = "json")',
		)
	}
	const merged = {
		styles: {},
		actors: {},
		views: {},
		contexts: {},
		processes: {},
		states: {},
		inboxes: {},
		avens: validRegistries.map((r) => normalizeAvenForSeeding(r.aven)),
		data: {},
	}
	for (const registry of avenRegistries) {
		Object.assign(merged.styles, registry.styles || {})
		Object.assign(merged.actors, registry.actors || {})
		Object.assign(merged.views, registry.views || {})
		Object.assign(merged.contexts, registry.contexts || {})
		Object.assign(merged.processes, registry.processes || {})
		Object.assign(merged.data, registry.data || {})
	}
	// Inbox by convention: derive from actors (no registry.inboxes)
	for (const [actorId, config] of Object.entries(merged.actors)) {
		const inboxId = deriveInboxId(actorId)
		if (inboxId) {
			config.inbox = inboxId
			merged.inboxes[inboxId] = { $schema: INBOX_SCHEMA, $id: inboxId }
		}
	}
	return { configs: merged, data: merged.data || {} }
}

/**
 * Get union of dependencies for given aven keys.
 * Each aven manifest declares dependencies: actor $ids to watch.
 * @param {string[]} avenKeys - e.g. ['todos', 'chat']
 * @returns {string[]} Deduped union of actor refs
 */
export function getDependenciesForAvens(avenKeys) {
	const registryByKey = new Map()
	for (const r of ALL_REGISTRIES) {
		if (!r?.aven) continue
		const key = getAvenKey(r.aven)
		if (key) registryByKey.set(key, r)
	}
	const union = new Set()
	for (const key of avenKeys) {
		const reg = registryByKey.get(key)
		const deps = reg?.aven?.dependencies
		if (Array.isArray(deps)) {
			for (const ref of deps) union.add(ref)
		}
	}
	return [...union]
}

/**
 * Build a merged map of all actor configs from all aven registries.
 * Genesis seed only (buildSeedConfig). Runtime loads actor config from DB.
 */
export function getAvenActorConfigs() {
	const map = {}
	for (const registry of ALL_REGISTRIES) {
		if (!registry?.actors) continue
		for (const [id, config] of Object.entries(registry.actors)) {
			map[id] = config
		}
	}
	return map
}

export function filterAvensForSeeding(avenRegistries, config = null) {
	if (config === null || config === undefined || (Array.isArray(config) && config.length === 0)) {
		return []
	}
	if (config === 'all') {
		return avenRegistries
	}
	if (Array.isArray(config)) {
		const configKeys = config.map((k) => k.toLowerCase().trim())
		return avenRegistries.filter((registry) => {
			if (!registry.aven) return false
			const avenKey = getAvenKey(registry.aven)
			return configKeys.includes(avenKey)
		})
	}
	return []
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
