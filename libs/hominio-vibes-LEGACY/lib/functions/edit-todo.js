/**
 * Edit Todo Function
 * Edits one or more todo items
 */

/**
 * Function handler - executes the skill logic
 * Edits todo(s) in the store
 * @param {Object} args - Function arguments
 * @param {string|string[]} args.id - Todo ID(s) to edit (required)
 * @param {string} [args.title] - New title for the todo(s)
 * @param {boolean} [args.completed] - New completion status for the todo(s)
 * @returns {Promise<Object>}
 */
export async function handler(args) {
	const { id, title, completed } = args || {}

	// Validate ID(s)
	if (!id) {
		return {
			success: false,
			error: "ID parameter is required. Use queryTodos to get todo IDs if you don't know them.",
		}
	}

	// Support both single ID and batch (array of IDs)
	const ids = Array.isArray(id) ? id : [id]

	// Validate that at least one field is being updated
	if (title === undefined && completed === undefined) {
		return {
			success: false,
			error: 'At least one field (title or completed) must be provided for editing',
		}
	}

	// Validate title if provided
	if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
		return {
			success: false,
			error: 'Title must be a non-empty string if provided',
		}
	}

	// Validate completed if provided
	if (completed !== undefined && typeof completed !== 'boolean') {
		return {
			success: false,
			error: 'Completed must be a boolean if provided',
		}
	}

	// Edit todos in batch
	try {
		const { editTodo, getTodos } = await import('./todo-store.js')
		const updates = {
			...(title !== undefined && { title }),
			...(completed !== undefined && { completed }),
		}

		// Get original todos before editing to show diff
		const allTodos = await getTodos()

		const results = []
		const errors = []
		const changes = [] // Track changes for diff view

		for (const todoId of ids) {
			try {
				// Find original todo
				const originalTodo = allTodos.find((t) => t.id === todoId)
				if (!originalTodo) {
					errors.push(`Todo with ID "${todoId}" not found`)
					continue
				}

				// Edit the todo
				const updatedTodo = await editTodo(todoId, updates)
				if (updatedTodo) {
					results.push(updatedTodo)

					// Track what changed for diff view
					const change = {
						id: todoId,
						original: {
							title: originalTodo.title,
							completed: originalTodo.completed,
						},
						updated: {
							title: updatedTodo.title,
							completed: updatedTodo.completed,
						},
						fieldsChanged: [],
					}

					// Include fields that were provided in the update (even if value didn't change)
					// This ensures the diff view always shows what was attempted
					if (title !== undefined) {
						change.fieldsChanged.push('title')
					}
					if (completed !== undefined) {
						change.fieldsChanged.push('completed')
					}

					// Only add to changes array if at least one field was updated
					if (change.fieldsChanged.length > 0) {
						changes.push(change)
					}
				} else {
					errors.push(`Todo with ID "${todoId}" not found`)
				}
			} catch (error) {
				errors.push(
					`Failed to edit todo "${todoId}": ${error instanceof Error ? error.message : 'Unknown error'}`,
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
				updatedCount: results.length,
				changes: changes, // Include changes for diff view
				errors: errors.length > 0 ? errors : undefined,
				timestamp: new Date().toISOString(),
			},
		}
	} catch (error) {
		return {
			success: false,
			error: `Failed to edit todo(s): ${error instanceof Error ? error.message : 'Unknown error'}`,
		}
	}
}
