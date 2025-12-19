/**
 * Skill Executor - Execute skills from outside compositor context
 * 
 * Utility function to execute skills from outside the compositor context.
 * Takes accountCoState and creates a minimal Data object with _jazzAccountCoState set.
 */

import type { AccountCoState } from 'jazz-tools/svelte'
import type { Data } from '../dataStore'
import { skillRegistry } from './registry'
import type { Skill } from './types'

/**
 * Execute a skill from outside compositor context
 * 
 * @param skillId - ID of the skill to execute (e.g., '@entity/createEntity')
 * @param accountCoState - AccountCoState instance (from jazz-tools/svelte)
 * @param payload - Optional payload to pass to the skill
 * @returns Promise that resolves when skill execution completes
 */
export async function executeSkill(
	skillId: string,
	accountCoState: AccountCoState<any>,
	payload?: unknown,
): Promise<void> {
	// Get the skill from the registry
	const skill = skillRegistry.get(skillId)
	if (!skill) {
		throw new Error(`Skill "${skillId}" not found in registry`)
	}

	// Create minimal Data object with _jazzAccountCoState set
	const data: Data = {
		_jazzAccountCoState: accountCoState,
	}

	// Execute the skill with the Data object and payload
	try {
		await skill.execute(data, payload)
	} catch (error) {
		// Re-throw with context
		throw new Error(`Error executing skill "${skillId}": ${error instanceof Error ? error.message : String(error)}`)
	}
}




