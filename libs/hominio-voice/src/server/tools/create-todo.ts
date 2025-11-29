/**
 * createTodo Tool Handler
 * Directly creates a todo in the store
 */

import type { ToolExecutionContext, ToolResult } from "./registry.js";

export async function handleCreateTodo(
	args: Record<string, any>,
	context: ToolExecutionContext
): Promise<ToolResult> {
	const { title } = args || {};
	
	if (!title || typeof title !== "string" || title.trim().length === 0) {
		return {
			success: false,
			result: { error: "Title parameter is required and must be a non-empty string" },
			error: "Title parameter is required and must be a non-empty string"
		};
	}
	
	try {
		// Import handler from hominio-vibes
		const { loadFunction } = await import("@hominio/vibes");
		const func = await loadFunction("create-todo");
		
		// Execute handler with timeout to prevent hanging
		const handlerPromise = func.handler({ title });
		const timeoutPromise = new Promise((_, reject) => 
			setTimeout(() => reject(new Error("Handler timeout after 5 seconds")), 5000)
		);
		
		const result = await Promise.race([handlerPromise, timeoutPromise]) as any;
		
		return {
			success: result.success || false,
			result: result.data || result,
			contextString: result.success ? `Todo "${title}" created successfully` : undefined,
			error: result.error
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[createTodo] Error creating todo:`, error);
		return {
			success: false,
			result: { error: errorMessage },
			error: errorMessage
		};
	}
}

