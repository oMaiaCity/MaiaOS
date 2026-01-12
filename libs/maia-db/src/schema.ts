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

/** Actor Message schema - messages stored in actor's inbox (CoFeed) */
export const ActorMessage = co.map({
	type: z.string(), // 'CREATE_HUMAN', 'SELECT_VIBE', 'CLICK', etc.
	payload: z.object({}).passthrough(), // Event data
	from: z.string().optional(), // Sender actor ID
	timestamp: z.number(), // Unix timestamp
})

/** Actor schema - every UI node (composite and leaf) is an independent actor with message-passing */
export const Actor = co.map({
	// Context data (any JSON) - all actor state lives here
	context: z.object({}).passthrough(),
	
	// View - can be composite container OR leaf element (optional for service actors)
	// Stored as collaborative plainText JSON for multi-user editing
	view: co.plainText().optional(), // JSON string: { container: {...} } OR { tag: 'div', classes: '...', ... }
	
	// Dependencies - map of names to CoValue IDs
	dependencies: z.record(z.string(), z.string()),
	
	// Message inbox - append-only CoFeed for receiving messages
	inbox: co.feed(ActorMessage),
	
	// Subscriptions - list of actor IDs to publish messages to
	subscriptions: co.list(z.string()),
	
	// Children - list of child actor IDs (ID-based parent-child relationships)
	children: co.list(z.string()),
	
	// Role - optional label for debugging/categorization (e.g., 'header', 'button')
	role: z.string().optional(),
	
	
	// Inbox watermark - system property for message consumption tracking
	// Tracks the highest timestamp of processed messages (O(1) vs O(n) consumed IDs array)
	inboxWatermark: z.number().optional(),
})

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AppRoot = co.map({
	contact: Contact, // Simple contact CoMap with email
	schemata: co.optional(co.list(co.map({}))), // Optional - list of SchemaDefinitions (created dynamically)
	entities: co.optional(co.list(co.map({}))), // Optional - list of Entity instances (created dynamically, Todo, Human, etc.)
	actors: co.optional(co.list(co.map({}))), // Optional - list of Actor instances (UI/system actors, separated from data entities)
	relations: co.optional(co.list(co.map({}))), // Optional - list of Relation instances (created dynamically)
	vibesRegistryId: z.string().optional(), // Cached ID of the VibesRegistry entity for fast access
})

export const JazzAccount = co
	.account({
		root: AppRoot,
		profile: AccountProfile,
	})
	.withMigration(async (account) => {
		/* eslint-disable no-console */
		/** The account migration is run on account creation and on every log-in.
		 *  Sets up the account root with initial structure: root.contact
		 *  Ensures profile fields are initialized
		 */
		// Ensure profile is initialized with default values and "everyone" reader permission
		if (!account.$jazz.has('profile')) {
			// Create a Group with "everyone" as "reader" for public profile access
		const profileGroup = Group.create()
		profileGroup.addMember('everyone', 'reader')
		// ⚡ REMOVED: await profileGroup.$jazz.waitForSync()
		// LOCAL-FIRST: Group creation is instant

			// Create profile with the group that has everyone reader permission
			const profile = AccountProfile.create(
				{
					firstName: '',
					lastName: '',
					name: '',
				},
			profileGroup,
		)
		// ⚡ REMOVED: await profile.$jazz.waitForSync()
		// LOCAL-FIRST: Profile creation is instant
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
							// ⚡ REMOVED: await ownerGroup.$jazz.waitForSync()
							// LOCAL-FIRST: Group operations are instant
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
	

		account.$jazz.set('root', {
			contact: contact,
		})
	
		}

		// Load root
		const loadedAccount = await account.$jazz.ensureLoaded({
			resolve: { root: true },
		})

		if (!loadedAccount.root) {
			console.error('[Migration] Root missing after creation attempt')
			return
		}

		const root = loadedAccount.root

		// Ensure root and basic contact are loaded
		let rootWithData
		try {
			rootWithData = await root.$jazz.ensureLoaded({
				resolve: { contact: true },
			})

			// Verify that root was actually loaded
			if (!rootWithData || !rootWithData.$isLoaded) {
				throw new Error('root failed to load')
			}
		} catch (error) {
			console.error('[Migration] Error loading root data:', error)
			return
		}


		// Ensure schemata list exists (empty by default - schemas created manually via UI)
		if (!rootWithData.$jazz.has('schemata')) {
		// Create a group for schemata list
		const schemataGroup = Group.create()

		// Create empty schemata list (generic co.map({}) - schemas created dynamically)
		const schemataList = co.list(co.map({})).create([], schemataGroup)
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

		// Create empty entities list (generic co.map({}) - entities created dynamically)
		const entitiesList = co.list(co.map({})).create([], entitiesGroup)
		rootWithData.$jazz.set('entities', entitiesList)
		} else {
			// Ensure entities list is loaded
			try {
				await rootWithData.$jazz.ensureLoaded({
					resolve: { entities: true },
				})
			} catch (_error) { }
		}

		// Ensure actors list exists (empty by default - actors created via createActorEntity)
		if (!rootWithData.$jazz.has('actors')) {
		// Create a group for actors list
		const actorsGroup = Group.create()

		// Create empty actors list (generic co.map({}) - actors created dynamically)
		const actorsList = co.list(co.map({})).create([], actorsGroup)
		rootWithData.$jazz.set('actors', actorsList)
		} else {
			// Ensure actors list is loaded
			try {
				await rootWithData.$jazz.ensureLoaded({
					resolve: { actors: true },
				})
			} catch (_error) { }
		}

		// Ensure relations list exists (empty by default - relations created via createRelation)
		if (!rootWithData.$jazz.has('relations')) {
		// Create a group for relations list
		const relationsGroup = Group.create()

		// Create empty relations list (generic co.map({}) - relations created dynamically)
		const relationsList = co.list(co.map({})).create([], relationsGroup)
		rootWithData.$jazz.set('relations', relationsList)
		} else {
			// Ensure relations list is loaded
			try {
				await rootWithData.$jazz.ensureLoaded({
					resolve: { relations: true },
				})
			} catch (_error) { }
		}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	

	// Store VibesRegistry ID on AppRoot for fast access (instead of searching through all entities)
	// Check if vibesRegistryId exists AND is a valid string (not undefined/null)
	const existingRegistryId = rootWithData.vibesRegistryId;
	const hasValidRegistryId = existingRegistryId && typeof existingRegistryId === 'string' && existingRegistryId.startsWith('co_');
	
	if (!hasValidRegistryId) {
		const { createEntityGeneric } = await import('./functions/generic-crud.js')
		// Initialize ALL optional properties with actual values (empty string) to ensure Jazz adds them to the CoMap's allowed keys
		// IMPORTANT: undefined doesn't register keys in Jazz, but concrete values do!
		const registry = await createEntityGeneric(account, 'VibesRegistry', {
			vibes: '',
			humans: '',
			todos: '',
		})
		// Store the registry ID on AppRoot for fast lookup
		rootWithData.$jazz.set('vibesRegistryId', registry.$jazz.id)
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
