/**
 * Skill Types - Generic interface for all actions/functions/services
 * Future-ready for LLM skill calls
 * 
 * JAZZ-NATIVE ARCHITECTURE:
 * - Skills now accept actor: any (Jazz CoMap instance, not data: Data)
 * - accountCoState passed as parameter (not via data._jazzAccountCoState)
 */

/**
 * Skill Metadata - Describes a skill for registry and future LLM integration
 */
export interface SkillMetadata {
	/**
	 * Unique skill identifier (supports npm-style scoped names: @scope/skillName)
	 * Examples: @todo/validateTodo, @charles/addTodo, @agent/processData
	 */
	id: string

	/**
	 * Human-readable name
	 */
	name: string

	/**
	 * Description of what the skill does
	 */
	description: string

	/**
	 * Skill category/type
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
 * Skill Function - The actual implementation
 * Jazz-native architecture: operates on actor CoMap instance directly
 */
export type SkillFunction = (actor: any, payload?: unknown, accountCoState?: any) => void | Promise<void>

/**
 * Skill Definition - Complete skill with metadata and function
 */
export interface Skill {
	metadata: SkillMetadata
	execute: SkillFunction
}

/**
 * Skill Registry - Central registry of all available skills
 */
export interface SkillRegistry {
	register(skill: Skill): void
	get(id: string): Skill | undefined
	getAll(): Skill[]
	getByCategory(category: string): Skill[]
}
