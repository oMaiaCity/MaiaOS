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
		description: 'Clears all schemata, entities, relations, and actors from the database',
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

		// Clear vibes registry contents FIRST (before clearing actors)
		// This prevents pages from trying to load actors that no longer exist
		// root.vibes IS the registry CoMap - clear its schema properties
		if (root.$jazz.has('vibes')) {
			const rootWithVibes = await root.$jazz.ensureLoaded({
				resolve: { vibes: true },
			})
			const vibesRegistry = rootWithVibes.vibes

			if (vibesRegistry?.$isLoaded) {
				// VibesRegistry has schema properties (vibes, humans)
				// Set them to undefined to clear them
				vibesRegistry.$jazz.set('vibes', undefined)
				vibesRegistry.$jazz.set('humans', undefined)
				await root.$jazz.waitForSync()
				console.log('[resetDatabase] Cleared vibes registry contents')
			}
		}

		// Delete legacy vibesRegistry property if it exists (old schema)
		// This ensures we remove any old/legacy vibesRegistry property
		if (root.$jazz.has('vibesRegistry')) {
			root.$jazz.delete('vibesRegistry')
			await root.$jazz.waitForSync()
			console.log('[resetDatabase] Deleted legacy vibesRegistry property from root')
		}

		// Clear actors list AFTER clearing registry
		// This ensures pages won't try to load actors that no longer exist
		if (root.$jazz.has('actors')) {
			const rootWithActors = await root.$jazz.ensureLoaded({
				resolve: { actors: true },
			})
			const actorsList = rootWithActors.actors

			if (actorsList?.$isLoaded) {
				const currentLength = Array.from(actorsList).length

				// Remove all items by splicing from the end (safer than iterating forward)
				for (let i = currentLength - 1; i >= 0; i--) {
					actorsList.$jazz.splice(i, 1)
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




