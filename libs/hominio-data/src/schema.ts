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

/** Capability schema - wrapper for Group reference */
export const Capability = co.map({
	'@schema': z.literal('capability'),
	group: Group, // Reference to a Group CoValue
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

/** SchemaDefinition schema - stores JSON Schema definitions as CoMaps with their entity instances */
export const SchemaDefinition = co.map({
	'@schema': z.literal('schema-definition'),
	name: z.string(),
	definition: z.object({}).passthrough(), // JSON Schema object (flexible structure - allows any properties)
	entities: co.list(co.map({})), // Generic entities list - stores instances of this schema
})

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AppRoot = co.map({
	contact: Contact, // Simple contact CoMap with email
	capabilities: co.list(Capability), // List of Capability CoValues (each contains a Group reference)
	data: co.optional(co.list(SchemaDefinition)), // Optional - list of SchemaDefinitions (each containing schema + entities)
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
					} catch (_e) {}
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

			// Create default group for capabilities
			const defaultGroup = Group.create()
			await defaultGroup.$jazz.waitForSync()
			const defaultCapability = Capability.create({
				'@schema': 'capability',
				group: defaultGroup,
			})
			await defaultCapability.$jazz.waitForSync()

			account.$jazz.set('root', {
				contact: contact,
				capabilities: [defaultCapability],
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

			// Create default group for capabilities
			const defaultGroup = Group.create()
			await defaultGroup.$jazz.waitForSync()
			const defaultCapability = Capability.create({
				'@schema': 'capability',
				group: defaultGroup,
			})
			await defaultCapability.$jazz.waitForSync()

			account.$jazz.set('root', {
				contact: contact,
				capabilities: [defaultCapability],
			})
			return
		}

		const root = loadedAccount.root

		// Try to load root with contact and capabilities
		// If the reference is broken (points to non-existent CoValue), recreate it
		let rootWithData
		try {
			rootWithData = await root.$jazz.ensureLoaded({
				resolve: { contact: true, capabilities: true },
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

			// Create default group for capabilities
			const defaultGroup = Group.create()
			await defaultGroup.$jazz.waitForSync()
			const defaultCapability = Capability.create({
				'@schema': 'capability',
				group: defaultGroup,
			})
			await defaultCapability.$jazz.waitForSync()

			account.$jazz.set('root', {
				contact: contact,
				capabilities: [defaultCapability],
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

		// Ensure capabilities list exists and has at least one default group
		if (!rootWithData.$jazz.has('capabilities')) {
			const defaultGroup = Group.create()
			await defaultGroup.$jazz.waitForSync()
			const defaultCapability = Capability.create({
				'@schema': 'capability',
				group: defaultGroup,
			})
			await defaultCapability.$jazz.waitForSync()
			rootWithData.$jazz.set('capabilities', [defaultCapability])
		} else {
			// Ensure capabilities list is loaded
			try {
				await rootWithData.$jazz.ensureLoaded({
					resolve: { capabilities: true },
				})
			} catch (_error) {
				// If loading failed, create a new default capability
				const defaultGroup = Group.create()
				await defaultGroup.$jazz.waitForSync()
				const defaultCapability = Capability.create({
					'@schema': 'capability',
					group: defaultGroup,
				})
				await defaultCapability.$jazz.waitForSync()
				rootWithData.$jazz.set('capabilities', [defaultCapability])
			}
		}

		// Ensure data list exists (empty by default - schemas created manually via UI)
		if (!rootWithData.$jazz.has('data')) {
			// Create a group for data list
			const dataGroup = Group.create()
			await dataGroup.$jazz.waitForSync()

			// Create empty data list (list of SchemaDefinitions)
			const dataList = co.list(SchemaDefinition).create([], dataGroup)
			await dataList.$jazz.waitForSync()
			rootWithData.$jazz.set('data', dataList)
		} else {
			// Ensure data list is loaded
			try {
				await rootWithData.$jazz.ensureLoaded({
					resolve: { data: true },
				})
			} catch (_error) {}
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
