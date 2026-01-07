/**
 * Human-specific skills
 */

import type { Data } from '../dataStore'
import type { Skill } from './types'
import { createEntityGeneric } from '@hominio/db'

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
	execute: async (data: Data, payload?: unknown) => {
		// Check if Jazz AccountCoState is available
		const accountCoState = data._jazzAccountCoState as any
		if (!accountCoState) {
			console.error('[createRandomHumanSkill] Jazz AccountCoState not available in data:', data)
			throw new Error('Jazz AccountCoState not available')
		}

		// Get the current account from CoState
		const jazzAccount = accountCoState.current
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
			await createEntityGeneric(jazzAccount, 'Human', entityData)
			console.log('[createRandomHumanSkill] ✅ Successfully created human:', name)
		} catch (error) {
			console.error('[createRandomHumanSkill] ❌ Failed to create human:', error)
			throw error
		}
	},
}

export const humanSkills: Record<string, Skill> = {
	'@human/createRandom': createRandomHumanSkill,
}
