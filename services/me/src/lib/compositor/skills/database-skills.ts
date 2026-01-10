/**
 * Database Skills - Database management operations
 * 
 * Skills for managing the database (reset, etc.)
 */

import type { Data } from '../dataStore'
import type { Skill } from './types'

// ========== DATABASE MANAGEMENT SKILLS ==========

const resetDatabaseSkill: Skill = {
	metadata: {
		id: '@database/resetDatabase',
		name: 'Reset Database',
		description: 'Clears all schemata, entities, relations, actors, and vibes registry from the database',
		category: 'database',
		parameters: {
			type: 'object',
			properties: {},
			required: [],
		},
	},
	execute: async (data: Data, payload?: unknown) => {
		// Get account from data
		const account = data._jazzAccountCoState?.current
		if (!account || !account.$isLoaded) {
			throw new Error('Account is not loaded')
		}

		console.log('[resetDatabase] Starting database reset...');
		
		// Use the consolidated reset utility
		const { resetData } = await import('@maia/db');
		await resetData(account);
		
		console.log('[resetDatabase] ✅ Database reset complete!')
		console.log('[resetDatabase] After page reload, migration will create fresh VibesRegistry')
	},
}

// Export skills config
export const databaseSkills = {
	'@database/resetDatabase': resetDatabaseSkill,
}




