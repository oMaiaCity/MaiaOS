/**
 * Human-specific skills
 * 
 * JAZZ-NATIVE ARCHITECTURE:
 * - Skills accept actor: any (Jazz CoMap instance)
 * - Entity skills mutate entity CoValues directly in root.entities
 * - All mutations followed by await entity.$jazz.waitForSync()
 */

import type { Skill } from './types'
import { createEntityGeneric, deleteEntityGeneric } from '@maia/db'

const createRandomHumanSkill: Skill = {
	metadata: {
		id: '@human/createRandom',
		name: 'Create Random Human',
		description: 'Creates a random human entity with generated data',
		category: 'human',
		parameters: {
			type: 'object',
			properties: {},
			required: [],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		// Get the current account from CoState
		const jazzAccount = accountCoState?.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			console.error('[createRandomHumanSkill] Jazz account not loaded')
			throw new Error('Jazz account not loaded')
		}

		// Generate random human data
		const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack']
		const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']
		
		const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
		const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
		const name = `${firstName} ${lastName}`
		const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`
		const year = 1970 + Math.floor(Math.random() * 40)
		const month = Math.floor(Math.random() * 12)
		const day = Math.floor(Math.random() * 28) + 1
		// Schema expects Date object, not ISO string
		const dateOfBirth = new Date(year, month, day)

		const entityData = {
			name,
			email,
			dateOfBirth,
		}

	try {
		console.log('[createRandomHumanSkill] Creating human with data:', entityData)
		const human = await createEntityGeneric(jazzAccount, 'Human', entityData)
		// NO WAIT! Jazz creates locally instantly, syncs in background
		// CoState subscriptions will update UI automatically
		console.log('[createRandomHumanSkill] ⚡ Human created instantly (local-first):', name, human.$jazz.id)
	} catch (error) {
		console.error('[createRandomHumanSkill] ❌ Failed to create human:', error)
		throw error
	}
	},
}

const removeHumanSkill: Skill = {
	metadata: {
		id: 'REMOVE_HUMAN',
		name: 'Remove Human',
		description: 'Deletes a human entity',
		category: 'human',
		parameters: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'ID of the human to delete' },
			},
			required: ['id'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		// Get the current account from CoState
		const jazzAccount = accountCoState?.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			console.error('[removeHumanSkill] Jazz account not loaded')
			throw new Error('Jazz account not loaded')
		}

		// Extract ID from payload
		const { id } = (payload || {}) as { id?: string }
		if (!id) {
			console.error('[removeHumanSkill] No ID provided in payload')
			throw new Error('Human ID is required')
		}

		try {
			console.log('[removeHumanSkill] Deleting human with ID:', id)
			await deleteEntityGeneric(jazzAccount, id)
			await jazzAccount.$jazz.waitForSync()
			console.log('[removeHumanSkill] ✅ Successfully deleted human:', id)
		} catch (error) {
			console.error('[removeHumanSkill] ❌ Failed to delete human:', error)
			throw error
		}
	},
}

export const humanSkills: Record<string, Skill> = {
	'@human/createRandom': createRandomHumanSkill,
	'REMOVE_HUMAN': removeHumanSkill,
}
