/**
 * Tool Registry
 * Centralized registry for all wallet browser tools
 */

import { handleNavigateHome, navigateHomeToolSchema } from './navigate-home.js'
import type { ToolResult } from './navigate-home.js'

export interface ToolExecutionContext {
	onLog?: (message: string, context?: string) => void
}

export class WalletToolRegistry {
	async initialize() {
		// No initialization needed - tools are defined statically
	}

	async buildToolSchemas() {
		const tools: any[] = []

		// navigateHome - navigate to localhost:4200
		tools.push({
			functionDeclarations: [navigateHomeToolSchema],
		})

		return tools
	}

	async executeTool(
		toolName: string,
		args: Record<string, any>,
		_context: ToolExecutionContext,
	): Promise<ToolResult> {
		switch (toolName) {
			case 'navigateHome': {
				const result = await handleNavigateHome()
				return result
			}

			default:
				return {
					success: false,
					result: { error: `Unknown tool: ${toolName}` },
					error: `Unknown tool: ${toolName}`,
				}
		}
	}
}

