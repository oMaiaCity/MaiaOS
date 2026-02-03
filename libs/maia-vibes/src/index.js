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
export { loadMyDataVibe, MyDataVibeRegistry } from './my-data/loader.js';
export { MaiaOS } from '@MaiaOS/kernel';
export { TodosVibeRegistry as TodosRegistry } from './todos/registry.js';
export { MyDataVibeRegistry as MyDataRegistry } from './my-data/registry.js';

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
			console.log('[Vibes] Loaded TodosVibeRegistry');
		}
	} catch (error) {
		console.warn('[Vibes] Could not load TodosVibeRegistry:', error.message);
	}
	
	try {
		const { MaiaAgentVibeRegistry } = await import('./maia-agent/registry.js');
		if (MaiaAgentVibeRegistry && MaiaAgentVibeRegistry.vibe) {
			vibeRegistries.push(MaiaAgentVibeRegistry);
			console.log('[Vibes] Loaded MaiaAgentVibeRegistry');
		}
	} catch (error) {
		console.warn('[Vibes] Could not load MaiaAgentVibeRegistry:', error.message);
	}
	
	try {
		const { MyDataVibeRegistry } = await import('./my-data/registry.js');
		if (MyDataVibeRegistry && MyDataVibeRegistry.vibe) {
			vibeRegistries.push(MyDataVibeRegistry);
			console.log('[Vibes] Loaded MyDataVibeRegistry');
		}
	} catch (error) {
		console.warn('[Vibes] Could not load MyDataVibeRegistry:', error.message);
	}
	
	console.log(`[Vibes] Total registries loaded: ${vibeRegistries.length}`);
	return vibeRegistries;
}
