
/**
 * Tool Metadata - Describes a tool for registry and future LLM integration
 */
export interface ToolMetadata {
	/**
	 * Unique tool identifier (supports npm-style scoped names: @scope/toolName)
	 * Examples: @core/createEntity, @context/update, @ai/chatRedPill
	 */
	id: string

	/**
	 * Human-readable name
	 */
	name: string

	/**
	 * Description of what the tool does
	 */
	description: string

	/**
	 * Tool category/type
	 */
	category?: string

	/**
	 * Parameters schema (for future LLM integration)
	 */
	parameters?: {
		type: 'object'
		properties: Record<
			string,
			{
				type: string
				description: string
				required?: boolean
			}
		>
		required?: string[]
	}
}

/**
 * Tool Function - The actual implementation
 * Jazz-native architecture: operates on actor CoMap instance directly
 */
export type ToolFunction = (actor: any, payload?: unknown, accountCoState?: any) => void | Promise<void>

/**
 * Tool Definition - Complete tool with metadata and function
 */
export interface Tool {
	metadata: ToolMetadata
	execute: ToolFunction
}

/**
 * Tool Registry - Central registry of all available tools
 * @deprecated Use ToolModuleRegistry instead for module-based architecture
 */
export interface ToolRegistry {
	register(tool: Tool): void
	get(id: string): Tool | undefined
	getAll(): Tool[]
	getByCategory(category: string): Tool[]
}

// ========== QUERY TYPES ==========

import type { MaiaScriptExpression } from '@maia/script'

/**
 * Query Configuration Types
 * MaiaScript-based query configuration for actor.context.queries
 */
export interface QueryConfig {
	/**
	 * Entity schema name to query (e.g., "Todo", "Human")
	 */
	schemaName: string

	/**
	 * Optional MaiaScript query operations
	 * Can be a single operation or a $pipe chain
	 * 
	 * Examples:
	 * - Single operation: { "$filter": { "field": "status", "condition": { "$eq": [{ "$": "item.status" }, "todo"] } } }
	 * - Pipe chain: { "$pipe": [{ "$filter": {...} }, { "$sort": {...} }, { "$paginate": {...} }] }
	 */
	operations?: MaiaScriptExpression
}
