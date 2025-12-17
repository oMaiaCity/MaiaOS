/**
 * Humans Vibe State Machine Configuration
 * Defines all states, transitions, and initial data
 */

import type { StateMachineConfig } from '../../compositor/dataStore'

export const humansStateMachine: StateMachineConfig = {
	initial: 'idle',
	// Split data into queries (database/user data) and view (app/view state)
	data: {
		queries: {
			title: 'Humans', // non-query property
			humans: {
				schemaName: 'Human',
			},
		},
		view: {
			isLoading: false,
			error: null,
			configJson: '', // Will be populated by Vibe.svelte to avoid circular dependency
		},
	},
	states: {
		idle: {
			on: {
				CREATE_HUMAN: {
					target: 'idle',
					actions: ['@entity/createEntity'],
				},
				REMOVE_HUMAN: {
					target: 'idle',
					actions: ['@entity/deleteEntity'],
				},
				UPDATE_HUMAN: {
					target: 'idle',
					actions: ['@entity/updateEntity'],
				},
			},
		},
	},
	actions: {
		// Wrapper action for Human-specific logic
		'@entity/createEntity': async (data: any, payload?: unknown) => {
			const payloadData = payload as {
				schemaName?: string
				entityData?: Record<string, unknown>
			} || {}

			const schemaName = payloadData.schemaName || 'Human'
			
			// Build entityData based on schema
			let entityData: Record<string, unknown> = payloadData.entityData || {}

			if (schemaName === 'Human' && !payloadData.entityData) {
				// Human-specific: Generate random human data if not provided
				const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Ruby', 'Sam', 'Tina']
				const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee']
				
				const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
				const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
				const name = `${firstName} ${lastName}`
				
				const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`
				
				const now = new Date()
				const yearsAgo = Math.floor(Math.random() * (80 - 18 + 1)) + 18
				const dateOfBirth = new Date(now.getFullYear() - yearsAgo, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)

				entityData = {
					name,
					email,
					dateOfBirth, // Pass Date object
				}
			}

			// Call the generic skill with built entityData
			const { entitySkills } = await import('../../compositor/skills/entity-skills.js')
			const createEntitySkill = entitySkills['@entity/createEntity']
			if (createEntitySkill) {
				await createEntitySkill.execute(data, {
					schemaName,
					entityData,
				})
			}
		},
	},
}

