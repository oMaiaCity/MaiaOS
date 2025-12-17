/**
 * Learn about schemas here:
 * https://jazz.tools/docs/svelte/schemas/covalues
 */

import { co, Group, z } from 'jazz-tools'
import {
	registerComputedField,
	setupComputedFieldsForCoValue,
} from './functions/computed-fields.js'
import { migrateSyncGoogleEmailToContact } from './migrations/20241220_sync-google-email-to-contact.js'
import { migrateSyncGoogleImageToProfile } from './migrations/20241220_sync-google-image-to-profile.js'
import { migrateSyncGoogleNameToProfile } from './migrations/20241220_sync-google-name-to-profile.js'

// Register computed field for profile.name
// name is computed from firstName + lastName, falls back to empty string
registerComputedField({
	targetField: 'name',
	sourceFields: ['firstName', 'lastName'],
	computeFn: (profile) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const profileAny = profile as any
		const firstName = profileAny?.firstName?.trim() || ''
		const lastName = profileAny?.lastName?.trim() || ''
		const fullName = `${firstName} ${lastName}`.trim()
		return fullName || ''
	},
})

// Register computed field for @label
// @label is computed from name field, or falls back to truncated ID
// This applies to all CoValues that have a @label field
registerComputedField({
	targetField: '@label',
	sourceFields: ['name'],
	computeFn: (coValue) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const coValueAny = coValue as any
		// Try name field first
		if (coValueAny?.name && typeof coValueAny.name === 'string' && coValueAny.name.trim()) {
			return coValueAny.name.trim()
		}
		// Fallback to truncated ID
		if (coValueAny?.$jazz?.id) {
			const id = coValueAny.$jazz.id as string
			if (id.length > 8) {
				return `${id.slice(0, 8)}...`
			}
			return id
		}
		return ''
	},
})

/** Custom profile schema with firstName, lastName, image, and computed name */
export const AccountProfile = co.profile({
	firstName: z.string(),
	lastName: z.string(),
	image: co.image().optional(), // ImageDefinition for avatar image (optional)
	name: z.string(), // Computed from firstName + lastName
})

/** Contact schema - simple CoMap for email */
export const Contact = co.map({
	email: z.string(),
})

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AppRoot = co.map({
	contact: Contact, // Simple contact CoMap with email
	schemata: co.optional(co.list(co.map({}))), // Optional - list of SchemaDefinitions (created dynamically)
	entities: co.optional(co.list(co.map({}))), // Optional - list of Entity instances (created dynamically)
	relations: co.optional(co.list(co.map({}))), // Optional - list of Relation instances (created dynamically)
})

export const JazzAccount = co
	.account({
		root: AppRoot,
		profile: AccountProfile,
	})
	.withMigration(async (account) => {
		/** The account migration is run on account creation and on every log-in.
		 *  Sets up the account root with initial structure: root.contact
		 *  Ensures profile fields are initialized
		 */
		// Ensure profile is initialized with default values and "everyone" reader permission
		if (!account.$jazz.has('profile')) {
			// Create a Group with "everyone" as "reader" for public profile access
			const profileGroup = Group.create()
			profileGroup.addMember('everyone', 'reader')
			await profileGroup.$jazz.waitForSync()

			// Create profile with the group that has everyone reader permission
			const profile = AccountProfile.create(
				{
					firstName: '',
					lastName: '',
					name: '',
				},
				profileGroup,
			)
			await profile.$jazz.waitForSync()
			account.$jazz.set('profile', profile)
		} else {
			// Ensure profile fields exist (for existing accounts)
			const profile = await account.$jazz.ensureLoaded({
				resolve: { profile: true },
			})
			if (profile.profile?.$isLoaded) {
				const profileAny = profile.profile as any

				// Ensure profile has "everyone" reader permission
				const profileOwner = profileAny.$jazz?.owner
				if (profileOwner && typeof profileOwner === 'object' && '$jazz' in profileOwner) {
					const ownerGroup = profileOwner as any
					// Check if "everyone" role exists, if not add it
					try {
						const everyoneRole = ownerGroup.roleOf ? ownerGroup.roleOf('everyone') : null
						if (!everyoneRole || everyoneRole !== 'reader') {
							// Add everyone as reader if not already set
							if (typeof ownerGroup.addMember === 'function') {
								ownerGroup.addMember('everyone', 'reader')
								await ownerGroup.$jazz.waitForSync()
							}
						}
					} catch (_e) { }
				}

				if (!profileAny.$jazz.has('firstName')) {
					profileAny.$jazz.set('firstName', '')
				}
				if (!profileAny.$jazz.has('lastName')) {
					profileAny.$jazz.set('lastName', '')
				}
				if (!profileAny.$jazz.has('name')) {
					profileAny.$jazz.set('name', '')
				}
				// Set up computed fields for profile
				setupComputedFieldsForCoValue(profile.profile)
			}
		}

		// Check if root exists (without loading nested structures)
		if (!account.$jazz.has('root')) {
			// Create contact CoMap
			const contact = Contact.create({
				email: '',
			})
			await contact.$jazz.waitForSync()

			account.$jazz.set('root', {
				contact: contact,
			})
			return
		}

		// Load root (without nested structures first)
		const loadedAccount = await account.$jazz.ensureLoaded({
			resolve: { root: true },
		})

		if (!loadedAccount.root) {
			// Create contact CoMap
			const contact = Contact.create({
				email: '',
			})
			await contact.$jazz.waitForSync()

			account.$jazz.set('root', {
				contact: contact,
			})
			return
		}

		const root = loadedAccount.root

		// Try to load root with contact
		// If the reference is broken (points to non-existent CoValue), recreate it
		let rootWithData
		try {
			rootWithData = await root.$jazz.ensureLoaded({
				resolve: { contact: true },
			})

			// Verify that root was actually loaded (not just a broken reference)
			if (!rootWithData || !rootWithData.$isLoaded) {
				throw new Error('root failed to load - broken reference')
			}
		} catch (_error) {
			// Create contact CoMap
			const contact = Contact.create({
				email: '',
			})
			await contact.$jazz.waitForSync()

			account.$jazz.set('root', {
				contact: contact,
			})
			return
		}

		// Ensure contact exists
		if (!rootWithData.$jazz.has('contact')) {
			const contact = Contact.create({
				email: '',
			})
			await contact.$jazz.waitForSync()
			rootWithData.$jazz.set('contact', contact)
		}

		// Remove capabilities if they exist (migration: capabilities system removed)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const rootAny = rootWithData as any
		if (rootAny.$jazz.has('capabilities')) {
			rootAny.$jazz.delete('capabilities')
			await rootWithData.$jazz.waitForSync()
		}

		// Migrate existing data to schemata (backward compatibility)
		if (rootAny.$jazz.has('data') && !rootWithData.$jazz.has('schemata')) {
			// Load data list using raw access
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rootWithDataLoaded = await rootAny.$jazz.ensureLoaded({
				resolve: { data: true },
			})
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const dataList = (rootWithDataLoaded as any).data

			if (dataList) {
				// Copy data list to schemata
				rootWithData.$jazz.set('schemata', dataList)
				await rootWithData.$jazz.waitForSync()
				// Delete legacy data property after migration
				rootAny.$jazz.delete('data')
				await rootWithData.$jazz.waitForSync()
			}
		}

		// Prevent data from being recreated - delete it if it exists (should have been migrated)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((rootWithData as any).$jazz.has('data')) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(rootWithData as any).$jazz.delete('data')
			await rootWithData.$jazz.waitForSync()
		}

		// Ensure schemata list exists (empty by default - schemas created manually via UI)
		if (!rootWithData.$jazz.has('schemata')) {
			// Create a group for schemata list
			const schemataGroup = Group.create()
			await schemataGroup.$jazz.waitForSync()

			// Create empty schemata list (generic co.map({}) - schemas created dynamically)
			const schemataList = co.list(co.map({})).create([], schemataGroup)
			await schemataList.$jazz.waitForSync()
			rootWithData.$jazz.set('schemata', schemataList)
		} else {
			// Ensure schemata list is loaded
			try {
				await rootWithData.$jazz.ensureLoaded({
					resolve: { schemata: true },
				})
			} catch (_error) { }
		}

		// Ensure entities list exists (empty by default - entities created via createEntity)
		if (!rootWithData.$jazz.has('entities')) {
			// Create a group for entities list
			const entitiesGroup = Group.create()
			await entitiesGroup.$jazz.waitForSync()

			// Create empty entities list (generic co.map({}) - entities created dynamically)
			const entitiesList = co.list(co.map({})).create([], entitiesGroup)
			await entitiesList.$jazz.waitForSync()
			rootWithData.$jazz.set('entities', entitiesList)
		} else {
			// Ensure entities list is loaded
			try {
				await rootWithData.$jazz.ensureLoaded({
					resolve: { entities: true },
				})
			} catch (_error) { }
		}

		// Ensure relations list exists (empty by default - relations created via createRelation)
		if (!rootWithData.$jazz.has('relations')) {
			// Create a group for relations list
			const relationsGroup = Group.create()
			await relationsGroup.$jazz.waitForSync()

			// Create empty relations list (generic co.map({}) - relations created dynamically)
			const relationsList = co.list(co.map({})).create([], relationsGroup)
			await relationsList.$jazz.waitForSync()
			rootWithData.$jazz.set('relations', relationsList)
		} else {
			// Ensure relations list is loaded
			try {
				await rootWithData.$jazz.ensureLoaded({
					resolve: { relations: true },
				})
			} catch (_error) { }
		}

	})

/**
 * Centralized function to sync Google profile data to profile and contact
 * Called from client-side layout when BetterAuth user data is available
 *
 * @param account - The Jazz account to sync data for
 * @param betterAuthUser - BetterAuth user object with name, image, and email properties
 */
export async function syncGoogleDataToProfile(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	betterAuthUser?: { name?: string | null; image?: string | null; email?: string | null } | null,
): Promise<void> {
	if (!betterAuthUser) {
		return
	}

	// Sync name, image, and email in parallel
	await Promise.all([
		betterAuthUser.name
			? migrateSyncGoogleNameToProfile(account, betterAuthUser.name)
			: Promise.resolve(),
		betterAuthUser.image
			? migrateSyncGoogleImageToProfile(account, betterAuthUser.image)
			: Promise.resolve(),
		betterAuthUser.email
			? migrateSyncGoogleEmailToContact(account, betterAuthUser.email)
			: Promise.resolve(),
	])
}
