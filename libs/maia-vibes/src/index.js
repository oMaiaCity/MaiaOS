/**
 * MaiaOS Vibes Package
 *
 * This package contains vibe configurations (.maia files) for MaiaOS applications.
 *
 * Exports:
 * - @MaiaOS/vibes/todos/loader - Loader for the Todos vibe
 * - @MaiaOS/vibes/todos/registry - Registry for Todos vibe configs
 */

export { MaiaOS } from '@MaiaOS/kernel'
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
 * @returns {string} Vibe key (e.g., "todos" from "@maia/vibe/todos")
 */
function getVibeKey(vibe) {
	if (!vibe) return null
	const originalVibeId = vibe.$id || ''
	if (originalVibeId.startsWith('@maia/vibe/')) {
		return originalVibeId.replace('@maia/vibe/', '')
	}
	return (vibe.name || 'default').toLowerCase().replace(/\s+/g, '-')
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
