/**
 * Query Todos Function
 * Queries all todos from the store
 */

/**
 * Function handler - executes the skill logic
 * Gets todos from Svelte store (single source of truth)
 * @param {Object} args - Function arguments (none required)
 * @returns {Promise<Object>}
 */
export async function handler(args) {
	// Get todos from store (single source of truth)
	try {
		const { getTodos } = await import('./todo-store.js');
		const todosList = await getTodos();
		
		return {
			success: true,
			data: {
				todos: todosList,
				timestamp: new Date().toISOString()
			}
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to load todos: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

