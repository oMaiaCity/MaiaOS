/**
 * Human Tool Module - Optional domain-specific operations
 * Loaded explicitly - provides Human-specific convenience tools
 * 
 * Contains:
 * - Random human generation (with domain logic)
 * 
 * Tools use @human/* namespace
 * 
 * NOTE: This module is kept as a convenience/domain-specific module
 * even though it wraps createEntityGeneric, because it contains
 * actual domain logic (random data generation) that would be
 * cumbersome to replicate in each call site.
 */

import type { ToolModule } from './module-types'
import type { Tool } from './types'
import { createEntityGeneric } from '@maia/db'

const createRandomTool: Tool = {
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
		const jazzAccount = accountCoState?.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			console.error('[human.module] Jazz account not loaded')
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
		const dateOfBirth = new Date(year, month, day)

		const entityData = {
			name,
			email,
			dateOfBirth,
		}

		try {
			const human = await createEntityGeneric(jazzAccount, 'Human', entityData)
		} catch (error) {
			console.error('[human.module] ❌ Failed to create human:', error)
			throw error
		}
	},
}

// ========== MODULE EXPORT ==========

export const humanModule: ToolModule = {
	name: 'human',
	version: '1.0.0',
	builtin: false, // Optional - loaded explicitly
	tools: {
		'@human/createRandom': createRandomTool,
	},
}

// Note: Human module is NOT auto-registered (optional module)
// Register via registerOptionalModules() in index.ts
