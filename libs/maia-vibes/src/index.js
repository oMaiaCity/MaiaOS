/**
 * MaiaOS Vibes Package
 * 
 * This package contains vibe configurations (.maia files) for MaiaOS applications.
 * 
 * Exports:
 * - @MaiaOS/vibes/todos/loader - Loader for the Todos vibe
 * - @MaiaOS/vibes/todos/registry - Registry for Todos vibe configs
 */

// Re-export todos loader and registry for convenience
export { loadTodosVibe, TodosVibeRegistry } from './todos/loader.js';
export { loadDbVibe, DbVibeRegistry } from './db/loader.js';
export { loadSparksVibe, SparksVibeRegistry } from './sparks/loader.js';
export { MaiaOS } from '@MaiaOS/kernel';
export { TodosVibeRegistry as TodosRegistry } from './todos/registry.js';
export { DbVibeRegistry as DbRegistry } from './db/registry.js';
export { SparksVibeRegistry as SparksRegistry } from './sparks/registry.js';

const REGISTRY_IMPORTS = [
	['./todos/registry.js', 'TodosVibeRegistry'],
	['./chat/registry.js', 'ChatVibeRegistry'],
	['./db/registry.js', 'DbVibeRegistry'],
	['./sparks/registry.js', 'SparksVibeRegistry'],
	['./creator/registry.js', 'CreatorVibeRegistry'],
];

/**
 * Automatically discover and import all vibe registries
 * @returns {Promise<Array>} Array of vibe registry objects
 */
export async function getAllVibeRegistries() {
	const registries = [];
	for (const [path, name] of REGISTRY_IMPORTS) {
		try {
			const m = await import(path);
			const R = m[name];
			if (R?.vibe) registries.push(R);
		} catch (e) {
			console.warn(`[Vibes] Could not load ${name}:`, e.message);
		}
	}
	return registries;
}

/**
 * Extract vibe key from vibe object
 * @param {Object} vibe - Vibe object with $id or name property
 * @returns {string} Vibe key (e.g., "todos" from "@maia/vibe/todos")
 */
function getVibeKey(vibe) {
	if (!vibe) return null;
	const originalVibeId = vibe.$id || '';
	if (originalVibeId.startsWith('@maia/vibe/')) {
		return originalVibeId.replace('@maia/vibe/', '');
	}
	return (vibe.name || 'default').toLowerCase().replace(/\s+/g, '-');
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
		return [];
	}
	
	// "all" = all vibes
	if (config === 'all') {
		return vibeRegistries;
	}
	
	// Array of specific vibe keys
	if (Array.isArray(config)) {
		const configKeys = config.map(k => k.toLowerCase().trim());
		return vibeRegistries.filter(registry => {
			if (!registry.vibe) return false;
			const vibeKey = getVibeKey(registry.vibe);
			return configKeys.includes(vibeKey);
		});
	}
	
	// Invalid config - return empty array
	console.warn(`[Vibes] Invalid seeding config: ${config}. Expected null, "all", or array of vibe keys.`);
	return [];
}
