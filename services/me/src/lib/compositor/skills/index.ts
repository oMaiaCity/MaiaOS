/**
 * Skills Index - Central export for all skills
 * Import and register skills here
 */

export * from './registry'
export * from './entity-skills'
export * from './types'
export { executeSkill } from './executor'

import { registerSkillsFromConfig } from './registry'
// Import all skill modules
import { entitySkills } from './entity-skills'
import { vibesSkills } from './vibes-skills'
import { schemaSkills } from './schema-skills'
import { relationsSkills } from './relations-skills'
import { databaseSkills } from './database-skills'

// ========== AUTO-REGISTER ALL SKILLS ==========

let skillsRegistered = false

/**
 * Register all available skills
 * This can be called on app initialization
 * Safe to call multiple times - will only register once
 */
export function registerAllSkills(): void {
	// Skip if already registered (prevents double registration during HMR)
	if (skillsRegistered) {
		return
	}

	registerSkillsFromConfig(entitySkills)
	registerSkillsFromConfig(vibesSkills)
	registerSkillsFromConfig(schemaSkills)
	registerSkillsFromConfig(relationsSkills)
	registerSkillsFromConfig(databaseSkills)
	// Add more skill registrations here as they're created

	skillsRegistered = true
}
