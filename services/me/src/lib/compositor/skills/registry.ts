/**
 * Skill Registry - Central registry for all compositor skills
 * Loads skills from config and provides unified access
 * Future-ready for LLM skill calls
 */

import type { SkillRegistry as ISkillRegistry, Skill } from './types'

class SkillRegistryImpl implements ISkillRegistry {
	private skills: Map<string, Skill> = new Map()

	/**
	 * Register a skill
	 * @param overwrite - If false, skip registration if skill already exists (default: false)
	 */
	register(skill: Skill, overwrite: boolean = false): void {
		if (this.skills.has(skill.metadata.id)) {
			if (overwrite) {
				this.skills.set(skill.metadata.id, skill)
			}
			// Skip registration if already exists and overwrite is false
			return
		}
		this.skills.set(skill.metadata.id, skill)
	}

	/**
	 * Register multiple skills at once
	 */
	registerAll(skills: Skill[]): void {
		skills.forEach((skill) => this.register(skill))
	}

	/**
	 * Get a skill by ID
	 */
	get(id: string): Skill | undefined {
		return this.skills.get(id)
	}

	/**
	 * Get all registered skills
	 */
	getAll(): Skill[] {
		return Array.from(this.skills.values())
	}

	/**
	 * Get skills by category
	 */
	getByCategory(category: string): Skill[] {
		return this.getAll().filter((skill) => skill.metadata.category === category)
	}

	/**
	 * Check if a skill exists
	 */
	has(id: string): boolean {
		return this.skills.has(id)
	}

	/**
	 * Get skill function by ID (convenience method)
	 */
	getFunction(id: string): Skill['execute'] | undefined {
		const skill = this.get(id)
		return skill?.execute
	}
}

// ========== GLOBAL REGISTRY INSTANCE ==========

/**
 * Global skill registry instance
 */
export const skillRegistry = new SkillRegistryImpl()

/**
 * Register skills from a config object
 * Config format: { skillId: Skill }
 */
export function registerSkillsFromConfig(skills: Record<string, Skill>): void {
	Object.values(skills).forEach((skill) => {
		skillRegistry.register(skill)
	})
}

/**
 * Get skill function by ID (convenience export)
 */
export function getSkill(id: string): Skill['execute'] | undefined {
	return skillRegistry.getFunction(id)
}

/**
 * Get all skills as a record (for backward compatibility with actions)
 */
export function getAllSkillsAsRecord(): Record<string, Skill['execute']> {
	const record: Record<string, Skill['execute']> = {}
	skillRegistry.getAll().forEach((skill) => {
		record[skill.metadata.id] = skill.execute
	})
	return record
}
