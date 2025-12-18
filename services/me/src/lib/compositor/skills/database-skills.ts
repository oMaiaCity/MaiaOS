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
		description: 'Clears all schemata, entities, and relations from the database',
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

		// Load root
		const loadedAccount = await account.$jazz.ensureLoaded({
			resolve: { root: true },
		})

		if (!loadedAccount.root) {
			throw new Error('Root does not exist')
		}

		const root = loadedAccount.root

		// Clear schemata list (keep the list structure, just remove items)
		if (root.$jazz.has('schemata')) {
			const rootWithSchemata = await root.$jazz.ensureLoaded({
				resolve: { schemata: true },
			})
			const schemataList = rootWithSchemata.schemata

			if (schemataList?.$isLoaded) {
				const currentLength = Array.from(schemataList).length

				// Remove all items by splicing from the end (safer than iterating forward)
				for (let i = currentLength - 1; i >= 0; i--) {
					schemataList.$jazz.splice(i, 1)
				}

				await root.$jazz.waitForSync()
			}
		}

		// Clear entities list (keep the list structure, just remove items)
		if (root.$jazz.has('entities')) {
			const rootWithEntities = await root.$jazz.ensureLoaded({
				resolve: { entities: true },
			})
			const entitiesList = rootWithEntities.entities

			if (entitiesList?.$isLoaded) {
				const currentLength = Array.from(entitiesList).length

				// Remove all items by splicing from the end (safer than iterating forward)
				for (let i = currentLength - 1; i >= 0; i--) {
					entitiesList.$jazz.splice(i, 1)
				}

				await root.$jazz.waitForSync()
			}
		}

		// Clear relations list (keep the list structure, just remove items)
		if (root.$jazz.has('relations')) {
			const rootWithRelations = await root.$jazz.ensureLoaded({
				resolve: { relations: true },
			})
			const relationsList = rootWithRelations.relations

			if (relationsList?.$isLoaded) {
				const currentLength = Array.from(relationsList).length

				// Remove all items by splicing from the end (safer than iterating forward)
				for (let i = currentLength - 1; i >= 0; i--) {
					relationsList.$jazz.splice(i, 1)
				}

				await root.$jazz.waitForSync()
			}
		}
	},
}

// Export skills config
export const databaseSkills = {
	'@database/resetDatabase': resetDatabaseSkill,
}



