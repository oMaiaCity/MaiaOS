/**
 * Tool Types - Generic interface for all actions/functions/services
 * Future-ready for LLM tool calls
 * 
 * JAZZ-NATIVE ARCHITECTURE:
 * - Tools now accept actor: any (Jazz CoMap instance, not data: Data)
 * - accountCoState passed as parameter (not via data._jazzAccountCoState)
 * 
 * UNIFIED JSON → ENGINE → OUTPUT PATTERN:
 * - Tools follow same pattern as factories, actors, views
 * - All payloads pass through MaiaScript DSL evaluation
 * - Centralized security via whitelist and sanitization
 * 
 * FUTURE: LLM Tool Call Integration
 * Tools are designed for dual invocation:
 * 1. Actor Events: User clicks button → event triggers tool
 * 2. LLM Tool Calls: AI decides to call tool → ToolEngine.execute()
 * 
 * Example LLM Tool Schema (OpenAI format):
 * {
 *   "name": "create_entity",
 *   "description": "Creates a new entity in the database",
 *   "parameters": {
 *     "type": "object",
 *     "properties": {
 *       "schemaName": { "type": "string", "enum": ["Todo", "Human", "..."] },
 *       "entityData": { "type": "object" }
 *     },
 *     "required": ["schemaName", "entityData"]
 *   }
 * }
 * 
 * The tool metadata matches 1:1 with LLM tool schemas!
 */

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
