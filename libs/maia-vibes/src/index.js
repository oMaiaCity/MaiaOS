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

/**
 * Automatically discover and import all vibe registries
 * Looks for directories containing registry.js files and imports them
 * @returns {Promise<Array>} Array of vibe registry objects
 */
export async function getAllVibeRegistries() {
	const vibeRegistries = [];
	
	// Explicitly import known registries to ensure they're loaded
	try {
		const { TodosVibeRegistry } = await import('./todos/registry.js');
		if (TodosVibeRegistry && TodosVibeRegistry.vibe) {
			vibeRegistries.push(TodosVibeRegistry);
		}
	} catch (error) {
		console.warn('[Vibes] Could not load TodosVibeRegistry:', error.message);
	}
	
	try {
		const { ChatVibeRegistry } = await import('./chat/registry.js');
		if (ChatVibeRegistry && ChatVibeRegistry.vibe) {
			vibeRegistries.push(ChatVibeRegistry);
		}
	} catch (error) {
		console.warn('[Vibes] Could not load ChatVibeRegistry:', error.message);
	}
	
	try {
		const { DbVibeRegistry } = await import('./db/registry.js');
		if (DbVibeRegistry && DbVibeRegistry.vibe) {
			vibeRegistries.push(DbVibeRegistry);
		}
	} catch (error) {
		console.warn('[Vibes] Could not load DbVibeRegistry:', error.message);
	}
	
	try {
		const { SparksVibeRegistry } = await import('./sparks/registry.js');
		if (SparksVibeRegistry && SparksVibeRegistry.vibe) {
			vibeRegistries.push(SparksVibeRegistry);
		}
	} catch (error) {
		console.warn('[Vibes] Could not load SparksVibeRegistry:', error.message);
	}

	try {
		const { CreatorVibeRegistry } = await import('./creator/registry.js');
		if (CreatorVibeRegistry && CreatorVibeRegistry.vibe) {
			vibeRegistries.push(CreatorVibeRegistry);
		}
	} catch (error) {
		console.warn('[Vibes] Could not load CreatorVibeRegistry:', error.message);
	}

	return vibeRegistries;
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
