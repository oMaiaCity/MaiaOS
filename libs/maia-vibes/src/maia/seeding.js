/**
 * Vibes Seeding API - Cycle-free entry for sync genesis
 *
 * No dependency on @MaiaOS/loader - safe for static import in bundled sync-server.mjs.
 * Used by loader for getAllVibeRegistries, buildSeedConfig, filterVibesForSeeding.
 */

import { iconInstanceRefFromKey } from '@MaiaOS/factories/icon-instance-ref'
import { deriveInboxId } from '@MaiaOS/factories/seeding-utils'
import { getVibeKey } from '@MaiaOS/factories/vibe-keys'
import { ChatVibeRegistry } from './chat/registry.js'
import { LogsVibeRegistry } from './creator/registry.js'
import { dashboardIconCotextSeedRows } from './dashboard-icon-svgs.js'
import { RegistriesVibeRegistry } from './humans/registry.js'
import { PaperVibeRegistry } from './paper/registry.js'
import { ProfileVibeRegistry } from './profile/registry.js'
import { QuickjsAddVibeRegistry } from './quickjs-add/registry.js'
import { SparksVibeRegistry } from './sparks/registry.js'
import { TodosVibeRegistry } from './todos/registry.js'

const ALL_REGISTRIES = [
	TodosVibeRegistry,
	ChatVibeRegistry,
	PaperVibeRegistry,
	ProfileVibeRegistry,
	SparksVibeRegistry,
	LogsVibeRegistry,
	RegistriesVibeRegistry,
	QuickjsAddVibeRegistry,
]

export { getVibeKey }

const VIBE_SCHEMA = '°maia/factory/vibe'
const INBOX_SCHEMA = '°maia/factory/inbox'

function normalizeVibeForSeeding(vibe) {
	if (!vibe || typeof vibe !== 'object') {
		throw new Error('[vibes] Vibe must be a non-null object')
	}
	const key = getVibeKey(vibe)
	if (!key) {
		throw new Error('[vibes] Could not derive vibe key from manifest (missing $id / name)')
	}
	const normalized = { ...vibe }
	if (!normalized.$factory || typeof normalized.$factory !== 'string') {
		normalized.$factory = VIBE_SCHEMA
	}
	if (!normalized.$id?.startsWith('°maia/vibe/')) {
		normalized.$id = `°maia/vibe/${key}`
	}
	normalized.icon = iconInstanceRefFromKey(key)
	if (!Array.isArray(normalized.runtime)) {
		normalized.runtime = ['browser']
	}
	return normalized
}

export async function getAllVibeRegistries() {
	return ALL_REGISTRIES.filter((R) => R?.vibe)
}

export function buildSeedConfig(vibeRegistries) {
	const validRegistries = vibeRegistries.filter((r) => r?.vibe && typeof r.vibe === 'object')
	if (vibeRegistries.length > 0 && validRegistries.length === 0) {
		throw new Error(
			'[vibes] All vibe manifests invalid (null or not object). Ensure .maia files load as JSON (bunfig.toml: [loader] ".maia" = "json")',
		)
	}
	const merged = {
		styles: {},
		actors: {},
		views: {},
		contexts: {},
		processes: {},
		interfaces: {},
		inboxes: {},
		wasms: {},
		vibes: validRegistries.map((r) => normalizeVibeForSeeding(r.vibe)),
		data: {},
	}
	for (const registry of validRegistries) {
		Object.assign(merged.styles, registry.styles || {})
		Object.assign(merged.actors, registry.actors || {})
		Object.assign(merged.views, registry.views || {})
		Object.assign(merged.contexts, registry.contexts || {})
		Object.assign(merged.processes, registry.processes || {})
		Object.assign(merged.interfaces, registry.interfaces || {})
		Object.assign(merged.wasms, registry.wasms || {})
		Object.assign(merged.data, registry.data || {})
	}
	const vibeKeysForIcons = validRegistries.map((r) => getVibeKey(r.vibe)).filter(Boolean)
	merged.data.dashboardIconCotexts = dashboardIconCotextSeedRows(vibeKeysForIcons)
	// Inbox by convention: derive from actors (no registry.inboxes)
	for (const [actorId, config] of Object.entries(merged.actors)) {
		const inboxId = deriveInboxId(actorId)
		if (inboxId) {
			config.inbox = inboxId
			merged.inboxes[inboxId] = { $factory: INBOX_SCHEMA, $id: inboxId }
		}
	}
	return { configs: merged, data: merged.data || {} }
}

/**
 * Get union of dependencies for given vibe keys.
 * Each vibe manifest declares dependencies: actor $ids to watch.
 * @param {string[]} vibeKeys - e.g. ['todos', 'chat']
 * @returns {string[]} Deduped union of actor refs
 */
export function getDependenciesForVibes(vibeKeys) {
	const registryByKey = new Map()
	for (const r of ALL_REGISTRIES) {
		if (!r?.vibe) continue
		const key = getVibeKey(r.vibe)
		if (key) registryByKey.set(key, r)
	}
	const union = new Set()
	for (const key of vibeKeys) {
		const reg = registryByKey.get(key)
		const deps = reg?.vibe?.dependencies
		if (Array.isArray(deps)) {
			for (const ref of deps) union.add(ref)
		}
	}
	return [...union]
}

/**
 * Build a merged map of all actor configs from all vibe registries.
 * Genesis seed only (buildSeedConfig). Runtime loads actor config from DB.
 */
export function getVibeActorConfigs() {
	const map = {}
	for (const registry of ALL_REGISTRIES) {
		if (!registry?.actors) continue
		for (const [id, config] of Object.entries(registry.actors)) {
			map[id] = config
		}
	}
	return map
}

export function filterVibesForSeeding(vibeRegistries, config = null) {
	if (config === null || config === undefined || (Array.isArray(config) && config.length === 0)) {
		return []
	}
	if (config === 'all') {
		return vibeRegistries
	}
	if (Array.isArray(config)) {
		const configKeys = config.map((k) => k.toLowerCase().trim())
		return vibeRegistries.filter((registry) => {
			if (!registry.vibe) return false
			const vibeKey = getVibeKey(registry.vibe)
			return configKeys.includes(vibeKey)
		})
	}
	return []
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
