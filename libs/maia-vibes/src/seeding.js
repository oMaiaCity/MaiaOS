/**
 * Vibes Seeding API - Cycle-free entry for moai genesis
 *
 * No dependency on @MaiaOS/loader - safe for static import in bundled moai-server.mjs.
 * Used by loader for getAllVibeRegistries, buildSeedConfig, filterVibesForSeeding.
 */

import { ChatVibeRegistry } from './chat/registry.js'
import { LogsVibeRegistry } from './creator/registry.js'
import { HumansVibeRegistry } from './humans/registry.js'
import { SparksVibeRegistry } from './sparks/registry.js'
import { TodosVibeRegistry } from './todos/registry.js'

const ALL_REGISTRIES = [
	TodosVibeRegistry,
	ChatVibeRegistry,
	SparksVibeRegistry,
	LogsVibeRegistry,
	HumansVibeRegistry,
]

function getVibeKey(vibe) {
	if (!vibe) return null
	const originalVibeId = vibe.$id || ''
	if (originalVibeId.startsWith('°Maia/vibe/')) {
		return originalVibeId.replace('°Maia/vibe/', '')
	}
	return (vibe.name || 'default').toLowerCase().replace(/\s+/g, '-')
}

const VIBE_SCHEMA = '°Maia/schema/vibe'

function normalizeVibeForSeeding(vibe) {
	if (!vibe || typeof vibe !== 'object') {
		throw new Error('[vibes] Vibe must be a non-null object')
	}
	const key = getVibeKey(vibe)
	const normalized = { ...vibe }
	if (!normalized.$schema || typeof normalized.$schema !== 'string') {
		normalized.$schema = VIBE_SCHEMA
	}
	if (!normalized.$id || !normalized.$id.startsWith('°Maia/vibe/')) {
		normalized.$id = `°Maia/vibe/${key}`
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
		states: {},
		inboxes: {},
		vibes: validRegistries.map((r) => normalizeVibeForSeeding(r.vibe)),
		data: {},
	}
	for (const registry of vibeRegistries) {
		Object.assign(merged.styles, registry.styles || {})
		Object.assign(merged.actors, registry.actors || {})
		Object.assign(merged.views, registry.views || {})
		Object.assign(merged.contexts, registry.contexts || {})
		Object.assign(merged.states, registry.states || {})
		Object.assign(merged.inboxes, registry.inboxes || {})
		Object.assign(merged.data, registry.data || {})
	}
	return { configs: merged, data: merged.data || {} }
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
