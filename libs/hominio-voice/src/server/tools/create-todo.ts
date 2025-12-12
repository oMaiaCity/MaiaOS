/**
 * createTodo Tool Handler
 * Directly creates a todo in the store
 */

import type { ToolExecutionContext, ToolResult } from './registry.js'

export async function handleCreateTodo(
	args: Record<string, any>,
	_context: ToolExecutionContext,
): Promise<ToolResult> {
	const { title } = args || {}

	// Validate title - accept both string and array
	if (!title) {
		return {
			success: false,
			result: {
				error: 'Title parameter is required and must be a non-empty string or array of strings',
			},
			error: 'Title parameter is required and must be a non-empty string or array of strings',
		}
	}

	// Check if it's a valid string or array
	const isValidString = typeof title === 'string' && title.trim().length > 0
	const isValidArray =
		Array.isArray(title) &&
		title.length > 0 &&
		title.every((t) => typeof t === 'string' && t.trim().length > 0)

	if (!isValidString && !isValidArray) {
		return {
			success: false,
			result: { error: 'Title parameter must be a non-empty string or array of non-empty strings' },
			error: 'Title parameter must be a non-empty string or array of non-empty strings',
		}
	}

	try {
		// Import handler from hominio-vibes
		const { loadFunction } = await import('@hominio/vibes')
		const func = await loadFunction('create-todo')

		// Execute handler with timeout to prevent hanging
		const handlerPromise = func.handler({ title })
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Handler timeout after 5 seconds')), 5000),
		)

		const result = (await Promise.race([handlerPromise, timeoutPromise])) as any

		// Generate appropriate success message
		const isBatch = Array.isArray(title)
		const successMessage = isBatch
			? `Created ${result.data?.createdCount || 0} todo(s) successfully`
			: `Todo "${title}" created successfully`

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
