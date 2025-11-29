/**
 * Create Todo Function
 * Creates a new todo item
 */

/**
 * Function handler - executes the skill logic
 * Creates a new todo in the store
 * @param {Object} args - Function arguments
 * @param {string} args.title - Todo title (required)
 * @returns {Promise<Object>}
 */
export async function handler(args) {
	const { title } = args || {};
	
	if (!title || typeof title !== 'string' || title.trim().length === 0) {
		return {
			success: false,
			error: 'Title parameter is required and must be a non-empty string'
		};
	}
	
	// Add todo to store (single source of truth)
	try {
		const { addTodo } = await import('./todo-store.js');
		const newTodo = await addTodo(title);
		
		return {
			success: true,
			data: {
				todo: newTodo,
				timestamp: new Date().toISOString()
			}
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to create todo: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

