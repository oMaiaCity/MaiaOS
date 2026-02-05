/**
 * editTodo Tool Handler
 * Directly edits todo(s) in the store
 */

import type { ToolExecutionContext, ToolResult } from './registry.js'

export async function handleEditTodo(
	args: Record<string, any>,
	_context: ToolExecutionContext,
): Promise<ToolResult> {
	const { id, title, completed } = args || {}

	if (!id) {
		return {
			success: false,
			result: {
				error: "ID parameter is required. Use queryTodos to get todo IDs if you don't know them.",
			},
			error: "ID parameter is required. Use queryTodos to get todo IDs if you don't know them.",
		}
	}

	if (title === undefined && completed === undefined) {
		return {
			success: false,
			result: { error: 'At least one field (title or completed) must be provided for editing' },
			error: 'At least one field (title or completed) must be provided for editing',
		}
	}

	try {
		// Import handler from maia-vibes
		const { loadFunction } = await import('@maia/vibes')
		const func = await loadFunction('edit-todo')

		// Execute handler with timeout to prevent hanging
		const handlerPromise = func.handler({ id, title, completed })
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Handler timeout after 5 seconds')), 5000),
		)

		const result = (await Promise.race([handlerPromise, timeoutPromise])) as any

		const isBatch = Array.isArray(id)
		const successMessage = isBatch
			? `Updated ${result.data?.updatedCount || 0} todo(s) successfully`
			: `Todo "${title !== undefined ? title : completed !== undefined ? (completed ? 'completed' : 'uncompleted') : 'updated'}" edited successfully`

		return {
			success: result.success || false,
			result: result.data || result,
			contextString: result.success ? successMessage : undefined,
			error: result.error,
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error'
		return {
			success: false,
			result: { error: errorMessage },
			error: errorMessage,
		}
	}
}
