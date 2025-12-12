/**
 * Create Todo Function
 * Creates one or more new todo items
 */

/**
 * Function handler - executes the skill logic
 * Creates new todo(s) in the store
 * @param {Object} args - Function arguments
 * @param {string|string[]} args.title - Todo title(s) to create (required). Can be a single string or array of strings for batch creation.
 * @returns {Promise<Object>}
 */
export async function handler(args) {
	const { title } = args || {}

	// Support both single title and batch (array of titles)
	const titles = Array.isArray(title) ? title : title ? [title] : []

	if (titles.length === 0) {
		return {
			success: false,
			error: 'Title parameter is required and must be a non-empty string or array of strings',
		}
	}

	// Validate all titles
	for (let i = 0; i < titles.length; i++) {
		const t = titles[i]
		if (typeof t !== 'string') {
			return {
				success: false,
				error: `Title at index ${i} must be a string, got ${typeof t}`,
			}
		}
		const trimmed = t.trim()
		if (trimmed.length === 0) {
			return {
				success: false,
				error: `Title at index ${i} must be a non-empty string after trimming`,
			}
		}
		// Update the array with trimmed version
		titles[i] = trimmed
	}

	// Create todos in batch
	try {
		const { addTodo } = await import('./todo-store.js')
		const results = []
		const errors = []

		for (const todoTitle of titles) {
			try {
				const newTodo = await addTodo(todoTitle)
				results.push(newTodo)
			} catch (error) {
				errors.push(
					`Failed to create todo "${todoTitle}": ${error instanceof Error ? error.message : 'Unknown error'}`,
				)
			}
		}

		if (errors.length > 0 && results.length === 0) {
			// All failed
			return {
				success: false,
				error: errors.join('; '),
			}
		}

		// Partial or full success
		return {
			success: true,
			data: {
				todos: results,
				createdCount: results.length,
				errors: errors.length > 0 ? errors : undefined,
				timestamp: new Date().toISOString(),
			},
		}
	} catch (error) {
		return {
			success: false,
			error: `Failed to create todo(s): ${error instanceof Error ? error.message : 'Unknown error'}`,
		}
	}
}
