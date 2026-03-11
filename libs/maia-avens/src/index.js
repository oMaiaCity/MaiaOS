/**
 * MaiaOS Avens Package
 *
 * This package contains aven configurations (.maia files) for MaiaOS applications.
 *
 * Exports:
 * - @MaiaOS/avens/todos/loader - Loader for the Todos aven
 * - @MaiaOS/avens/todos/registry - Registry for Todos aven configs
 */

export { MaiaOS } from '@MaiaOS/loader'
export { loadSparksAven, SparksAvenRegistry } from './sparks/loader.js'
export { SparksAvenRegistry as SparksRegistry } from './sparks/registry.js'
export { loadTodosAven, TodosAvenRegistry } from './todos/loader.js'
export { TodosAvenRegistry as TodosRegistry } from './todos/registry.js'

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

/**
 * Return all aven registries (statically imported - no runtime fetch).
 * @returns {Promise<Array>} Array of aven registry objects
 */
export async function getAllAvenRegistries() {
	return ALL_REGISTRIES.filter((R) => R?.aven)
}

/**
 * Extract aven key from aven object
 * @param {Object} aven - Aven object with $id or name property
 * @returns {string} Aven key (e.g., "todos" from "°Maia/aven/todos")
 */
export function getAvenKey(aven) {
	if (!aven) return null
	const originalAvenId = aven.$id || ''
	if (originalAvenId.startsWith('°Maia/aven/')) {
		return originalAvenId.replace('°Maia/aven/', '')
	}
	return (aven.name || 'default').toLowerCase().replace(/\s+/g, '-')
}

export { buildSeedConfig } from './seeding.js'

/**
 * Filter aven registries based on seeding configuration
 *
 * @param {Array} avenRegistries - Array of aven registry objects
 * @param {string|Array|null} config - Seeding configuration:
 *   - `null` or `undefined` or `[]` = no avens (default)
 *   - `"all"` = all avens
 *   - `["todos", "chat"]` = specific avens by key
 * @returns {Array} Filtered array of aven registries
 */
export function filterAvensForSeeding(avenRegistries, config = null) {
	// Default: no avens
	if (config === null || config === undefined || (Array.isArray(config) && config.length === 0)) {
		return []
	}

	// "all" = all avens
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

export { getAvenActorConfigs, getDependenciesForAvens } from './seeding.js'
