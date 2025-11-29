/**
 * queryTodos Tool Handler
 * Directly queries todos from the store
 */

import type { ToolExecutionContext, ToolResult } from "./registry.js";

export async function handleQueryTodos(
	args: Record<string, any>,
	context: ToolExecutionContext
): Promise<ToolResult> {
	try {
		// Import handler from hominio-vibes
		const { loadFunction } = await import("@hominio/vibes");
		const func = await loadFunction("query-todos");
		
		// Execute handler
		const result = await func.handler({});
		
		return {
			success: result.success || false,
			result: result.data || result,
			contextString: result.success ? "Todos retrieved successfully" : undefined,
			error: result.error
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			result: { error: errorMessage },
			error: errorMessage
		};
	}
}

