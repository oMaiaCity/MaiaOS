/**
 * MaiaOS Vibes Package
 *
 * This package contains vibe configurations (.maia files) for MaiaOS applications.
 *
 * Exports:
 * - @MaiaOS/universe/todos/loader — Loader for the Todos vibe (`src/maia/vibes/todos/`)
 * - @MaiaOS/universe/todos/registry — Registry for Todos vibe configs
 */

export { MaiaOS } from '@MaiaOS/loader'
export { loadSparksVibe, SparksVibeRegistry } from './vibes/sparks/loader.js'
export { SparksVibeRegistry as SparksRegistry } from './vibes/sparks/registry.js'
export { loadTodosVibe, TodosVibeRegistry } from './vibes/todos/loader.js'
export { TodosVibeRegistry as TodosRegistry } from './vibes/todos/registry.js'

import { ChatVibeRegistry } from './vibes/chat/registry.js'
import { RegistriesVibeRegistry } from './vibes/humans/registry.js'
import { LogsVibeRegistry } from './vibes/logs/registry.js'
import { PaperVibeRegistry } from './vibes/paper/registry.js'
import { ProfileVibeRegistry } from './vibes/profile/registry.js'
import { QuickjsVibeRegistry } from './vibes/quickjs/registry.js'
import { SparksVibeRegistry } from './vibes/sparks/registry.js'
import { TodosVibeRegistry } from './vibes/todos/registry.js'

const ALL_REGISTRIES = [
	TodosVibeRegistry,
	ChatVibeRegistry,
	PaperVibeRegistry,
	ProfileVibeRegistry,
	SparksVibeRegistry,
	LogsVibeRegistry,
	RegistriesVibeRegistry,
	QuickjsVibeRegistry,
]

/**
 * Return all vibe registries (statically imported - no runtime fetch).
 * @returns {Promise<Array>} Array of vibe registry objects
 */
export async function getAllVibeRegistries() {
	return ALL_REGISTRIES.filter((R) => R?.vibe)
}

export { getVibeKey } from '@MaiaOS/factories/vibe-keys'

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
