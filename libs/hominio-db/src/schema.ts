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
	// State machine
	currentState: z.string(),
	states: z.object({}).passthrough(), // { idle: { on: { EVENT: { target: 'state', actions: [] } } } }
	
	// Context data (any JSON)
	context: z.object({}).passthrough(),
	
	// View - can be composite container OR leaf element (optional for service actors)
	view: z.object({}).passthrough().optional(), // { container: {...} } OR { tag: 'div', classes: '...', ... }
	
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
	
	// Position - deprecated, use children array order instead
	position: z.number().optional(),
})

/** Actor registry - list of all actor instances */
export const ActorList = co.list(Actor)

/** Vibes registry schema - generic CoMap for storing root actor IDs */
export const VibesRegistry = co.map({
	vibes: z.string().optional(),
	humans: z.string().optional(),
	designTemplates: z.string().optional(),
	todos: z.string().optional(),
})

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AppRoot = co.map({
	contact: Contact, // Simple contact CoMap with email
	schemata: co.optional(co.list(co.map({}))), // Optional - list of SchemaDefinitions (created dynamically)
	entities: co.optional(co.list(co.map({}))), // Optional - list of Entity instances (created dynamically)
	relations: co.optional(co.list(co.map({}))), // Optional - list of Relation instances (created dynamically)
	actors: co.optional(ActorList), // Optional - list of Actor instances (UI components)
	vibes: co.optional(VibesRegistry), // Optional - registry of vibe root actor IDs (flexible passthrough schema)
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
			console.log('[Migration] Creating initial account root')
			// Create contact CoMap
			const contact = Contact.create({
				email: '',
			})
			await contact.$jazz.waitForSync()

			account.$jazz.set('root', {
				contact: contact,
			})
			await account.$jazz.waitForSync()
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

		// Ensure actors list exists (empty by default - actors created via createActors)
		if (!rootWithData.$jazz.has('actors')) {
			// Create a group for actors list
			const actorsGroup = Group.create()
			await actorsGroup.$jazz.waitForSync()

			// Create empty actors list
			const actorsList = ActorList.create([], actorsGroup)
			await actorsList.$jazz.waitForSync()
			rootWithData.$jazz.set('actors', actorsList)
		} else {
			// Ensure actors list is loaded
			try {
				await rootWithData.$jazz.ensureLoaded({
					resolve: { actors: true },
				})
			} catch (_error) { }
		}

		// Delete any legacy vibesRegistry property (old schema)
		if (rootAny.$jazz.has('vibesRegistry')) {
			console.log('[Migration] Deleting legacy vibesRegistry property')
			rootAny.$jazz.delete('vibesRegistry')
			await rootWithData.$jazz.waitForSync()
		}

		// Ensure root.vibes is a proper VibesRegistry CoMap (SINGLE SOURCE OF TRUTH)
		// If it exists but is broken (e.g., a string ID from old migration), delete and recreate
		let needsVibesRecreation = false
		
		if (rootWithData.$jazz.has('vibes')) {
			try {
			// Try to load it and verify it's a proper CoMap
			const rootWithVibes = await rootWithData.$jazz.ensureLoaded({
				resolve: { vibes: true },
			})
			const existingVibes = rootWithVibes.vibes
			
			// Check if it's a proper CoMap (has $isLoaded property and is not a string)
			if (!existingVibes || typeof existingVibes === 'string' || !existingVibes.$jazz?.id) {
				console.log('[Migration] root.vibes exists but is broken (not a proper CoMap), will recreate')
				needsVibesRecreation = true
				rootAny.$jazz.delete('vibes')
				await rootWithData.$jazz.waitForSync()
			} else {
				console.log('[Migration] root.vibes exists and is valid')
			}
			} catch (error) {
				console.log('[Migration] Error loading root.vibes, will recreate:', error)
				needsVibesRecreation = true
				rootAny.$jazz.delete('vibes')
				await rootWithData.$jazz.waitForSync()
			}
		} else {
			needsVibesRecreation = true
		}
		
		if (needsVibesRecreation) {
			console.log('[Migration] Creating fresh vibes registry (VibesRegistry CoMap)')
			const registryGroup = Group.create()
			registryGroup.addMember('everyone', 'reader')
			await registryGroup.$jazz.waitForSync()
			
			const vibesRegistry = VibesRegistry.create({}, registryGroup)
			await vibesRegistry.$jazz.waitForSync()
			
			rootWithData.$jazz.set('vibes', vibesRegistry)
			await rootWithData.$jazz.waitForSync()
			console.log('[Migration] Fresh vibes registry created:', vibesRegistry.$jazz.id)
		}

		console.log('[Migration] Account migration completed successfully')
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
