/**
 * MaiaOS Vibes Package
 *
 * This package contains vibe configurations (.maia files) for MaiaOS applications.
 *
 * Exports:
 * - @MaiaOS/vibes/todos/loader - Loader for the Todos vibe
 * - @MaiaOS/vibes/todos/registry - Registry for Todos vibe configs
 */

export { MaiaOS } from '@MaiaOS/loader'
export { DbVibeRegistry, loadDbVibe } from './db/loader.js'
export { DbVibeRegistry as DbRegistry } from './db/registry.js'
export { loadSparksVibe, SparksVibeRegistry } from './sparks/loader.js'
export { SparksVibeRegistry as SparksRegistry } from './sparks/registry.js'
// Re-export todos loader and registry for convenience
export { loadTodosVibe, TodosVibeRegistry } from './todos/loader.js'
export { TodosVibeRegistry as TodosRegistry } from './todos/registry.js'

import { ChatVibeRegistry } from './chat/registry.js'
import { CreatorVibeRegistry } from './creator/registry.js'
import { DbVibeRegistry } from './db/registry.js'
import { SparksVibeRegistry } from './sparks/registry.js'
// Static imports - no dynamic import() so bundle works in production (avoids 404→index.html→text/html MIME error)
import { TodosVibeRegistry } from './todos/registry.js'

const ALL_REGISTRIES = [
	TodosVibeRegistry,
	ChatVibeRegistry,
	DbVibeRegistry,
	SparksVibeRegistry,
	CreatorVibeRegistry,
]

/**
 * Return all vibe registries (statically imported - no runtime fetch).
 * @returns {Promise<Array>} Array of vibe registry objects
 */
export async function getAllVibeRegistries() {
	return ALL_REGISTRIES.filter((R) => R?.vibe)
}

/**
 * Extract vibe key from vibe object
 * @param {Object} vibe - Vibe object with $id or name property
 * @returns {string} Vibe key (e.g., "todos" from "°Maia/vibe/todos")
 */
export function getVibeKey(vibe) {
	if (!vibe) return null
	const originalVibeId = vibe.$id || ''
	if (originalVibeId.startsWith('°Maia/vibe/')) {
		return originalVibeId.replace('°Maia/vibe/', '')
	}
	return (vibe.name || 'default').toLowerCase().replace(/\s+/g, '-')
}

const VIBE_SCHEMA = '°Maia/schema/vibe'

/**
 * Ensure vibe manifest has required fields for seeding ($schema, $id).
 * Call before passing vibes to seed. Throws if vibe cannot be normalized.
 * @param {Object} vibe - Raw vibe from registry
 * @returns {Object} Normalized vibe with $schema and $id
 */
export function normalizeVibeForSeeding(vibe) {
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

/**
 * Build merged seed config from vibe registries.
 * Used by genesisAccountSeed (moai sync, handleSeed).
 * Caller adds tool + schemas before dbEngine.execute.
 *
 * @param {Array} vibeRegistries - Filtered vibe registries (use filterVibesForSeeding first)
 * @returns {{ configs: Object, data: Object }}
 */
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

/**
 * Filter vibe registries based on seeding configuration
 *
 * @param {Array} vibeRegistries - Array of vibe registry objects
 * @param {string|Array|null} config - Seeding configuration:
 *   - `null` or `undefined` or `[]` = no vibes (default)
 *   - `"all"` = all vibes
 *   - `["todos", "maia"]` = specific vibes by key
 * @returns {Array} Filtered array of vibe registries
 */
export function filterVibesForSeeding(vibeRegistries, config = null) {
	// Default: no vibes
	if (config === null || config === undefined || (Array.isArray(config) && config.length === 0)) {
		return []
	}

	// "all" = all vibes
	if (config === 'all') {
		return vibeRegistries
	}

	// Array of specific vibe keys
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
