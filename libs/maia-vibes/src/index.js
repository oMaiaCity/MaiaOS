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
export { loadSparksVibe, SparksVibeRegistry } from './sparks/loader.js'
export { SparksVibeRegistry as SparksRegistry } from './sparks/registry.js'
export { loadTodosVibe, TodosVibeRegistry } from './todos/loader.js'
export { TodosVibeRegistry as TodosRegistry } from './todos/registry.js'

import { ChatVibeRegistry } from './chat/registry.js'
import { LogsVibeRegistry } from './creator/registry.js'
import { HumansVibeRegistry } from './humans/registry.js'
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
	HumansVibeRegistry,
	QuickjsAddVibeRegistry,
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

export { buildSeedConfig } from './seeding.js'

/**
 * Filter vibe registries based on seeding configuration
 *
 * @param {Array} vibeRegistries - Array of vibe registry objects
 * @param {string|Array|null} config - Seeding configuration:
 *   - `null` or `undefined` or `[]` = no vibes (default)
 *   - `"all"` = all vibes
 *   - `["todos", "chat"]` = specific vibes by key
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

export { getDependenciesForVibes, getVibeActorConfigs } from './seeding.js'
