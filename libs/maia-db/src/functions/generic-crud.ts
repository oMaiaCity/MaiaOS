/**
 * Generic CRUD Functions with Runtime Type Safety
 * 
 * Fully generic CRUD operations that work for any dynamic schema.
 * Uses Zod schemas for runtime validation on CREATE and UPDATE operations.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const console: any

import { co, Group, z } from 'jazz-tools'
import { getJsonSchema } from '../schemas/schema-registry.js'
import { addLabelToSchema, jsonSchemaToCoMapShape, ensureSchema, findNestedSchema } from './dynamic-schema-migration.js'
import { setSystemProps } from './set-system-props.js'
import { Actor, ActorMessage } from '../schema.js'

/**
 * Gets the LocalNode from an account or a CoValue
 * Tries multiple methods to get the node
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNode(accountOrCoValue: any): any {
	try {
		// Method 1: Try from account's raw
		const raw = (accountOrCoValue as any).$jazz?.raw
		if (raw?.core?.node) {
			return raw.core.node
		}

		// Method 2: Try from account's core directly
		if ((accountOrCoValue as any).core?.node) {
			return (accountOrCoValue as any).core.node
		}

		// Method 3: Try from a CoValue's core
		const coValueRaw = (accountOrCoValue as any).$jazz?.raw
		if (coValueRaw?.core?.node) {
			return coValueRaw.core.node
		}

		return null
	} catch (_e) {
		return null
	}
}

/**
 * Get or create a CoMap schema wrapper for a schema name
 * Retrieves JSON Schema from registry, converts to Zod shape, returns wrapped CoMap schema
 * 
 * @param account - The Jazz account
 * @param schemaName - Name of the schema (e.g., "Human", "Todo", "AssignedTo")
 * @returns Object with schema wrapper and schema definition CoValue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCoMapSchemaForSchemaName(
	account: any,
	schemaName: string,
): Promise<{ schema: any; schemaDefinition: any }> {
	// Get JSON Schema from registry
	const jsonSchema = getJsonSchema(schemaName)
	if (!jsonSchema) {
		const { getRegisteredSchemaNames } = await import('../schemas/schema-registry.js')
		const availableSchemas = getRegisteredSchemaNames().join(', ')
		throw new Error(`Schema "${schemaName}" not found in registry. Available schemas: ${availableSchemas}`)
	}

	// Ensure schema exists in Jazz (creates SchemaDefinition CoValue if needed)
	const schemaDefinition = await ensureSchema(account, schemaName, jsonSchema)

	// Add system props (@label, @schema) to JSON Schema
	const jsonSchemaWithSystemProps = addLabelToSchema(jsonSchema)

	// Convert to Zod shape
	const shape = jsonSchemaToCoMapShape(jsonSchemaWithSystemProps)

	// Create CoMap schema wrapper
	const CoMapSchema = co.map(shape)

	return { schema: CoMapSchema, schemaDefinition }
}

/**
 * Generic CREATE function - works for any schema type
 * 
 * @param account - The Jazz account
 * @param schemaName - Name of the schema (e.g., "Human", "Todo", "AssignedTo")
 * @param entityData - Data for the entity instance
 * @returns The created entity CoValue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createEntityGeneric(
	account: any,
	schemaName: string,
	entityData: any,
): Promise<any> {
	// Get CoMap schema wrapper
	const { schema: CoMapSchema, schemaDefinition } = await getCoMapSchemaForSchemaName(
		account,
		schemaName,
	)

	// Load root and entities list
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: { entities: true } },
	})

	if (!loadedAccount.root?.entities) {
		console.error('[createEntityGeneric] ERROR: Root entities list does not exist')
		throw new Error('Root entities list does not exist - run account migration first')
	}

	const entitiesList = loadedAccount.root.entities
	const entitiesOwner = (entitiesList as any).$jazz?.owner

	if (!entitiesOwner) {
		console.error('[createEntityGeneric] ERROR: Cannot determine entities list owner')
		throw new Error('Cannot determine entities list owner')
	}

	// Create entity with Zod validation
	const entity = CoMapSchema.create(entityData, entitiesOwner)
	// NO WAIT! Jazz creates locally instantly, syncs in background
	
	// Set system properties (@label, @schema) - NO WAIT!
	await setSystemProps(entity, schemaDefinition)

	// Add to entities list - NO WAIT! Local-first!
	entitiesList.$jazz.push(entity)
	// NO WAIT! Jazz syncs in background, UI updates via CoState subscriptions

	return entity
}

/**
 * Generic UPDATE function - works for any schema type
 * Automatically wraps CoValue with correct schema for validation
 * 
 * @param account - The Jazz account
 * @param coValue - The CoValue to update
 * @param updates - Partial data to update
 * @returns void
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateEntityGeneric(
	account: any,
	coValue: any,
	updates: any,
): Promise<void> {
	if (!coValue || !coValue.$isLoaded) {
		throw new Error('CoValue is not loaded')
	}

	// Ensure coValue is loaded with @schema resolved
	const loadedCoValue = await coValue.$jazz.ensureLoaded({
		resolve: { '@schema': true },
	})

	// Get schema ID from @schema reference (can be CoValue reference or string ID)
	let schemaId: string | undefined

	// Try direct access first
	let schemaRef = loadedCoValue['@schema']

	if (schemaRef) {
		if (typeof schemaRef === 'string' && schemaRef.startsWith('co_')) {
			// It's a string ID
			schemaId = schemaRef
		} else if (typeof schemaRef === 'object' && '$jazz' in schemaRef) {
			// It's a CoValue reference - get its ID
			schemaId = (schemaRef as any).$jazz?.id
		}
	}

	// If not found, try getting from snapshot
	if (!schemaId) {
		try {
			const raw = (loadedCoValue as any).$jazz?.raw
			if (raw) {
				const snapshot = raw.toJSON()
				if (snapshot && typeof snapshot === 'object') {
					const snapshotSchemaRef = (snapshot as any)['@schema']
					if (typeof snapshotSchemaRef === 'string' && snapshotSchemaRef.startsWith('co_')) {
						schemaId = snapshotSchemaRef
					}
				}
			}
		} catch (_e) {
			// Ignore
		}
	}

	if (!schemaId) {
		throw new Error('CoValue has no @schema reference or could not extract schema ID')
	}

	// Load the schema CoValue to get its name
	const node = getNode(account)

	if (!node) {
		throw new Error('Cannot get LocalNode from account')
	}

	const loadedSchemaValue = await node.load(schemaId as any)

	if (loadedSchemaValue === 'unavailable') {
		throw new Error(`Schema CoValue ${schemaId} is unavailable`)
	}

	// Get schema name from the loaded schema CoValue
	const schemaSnapshot = loadedSchemaValue.toJSON()

	if (!schemaSnapshot || typeof schemaSnapshot !== 'object') {
		throw new Error(`Schema CoValue ${schemaId} has invalid snapshot`)
	}

	const schemaName = (schemaSnapshot as any).name
	if (!schemaName || typeof schemaName !== 'string') {
		throw new Error(`Schema CoValue ${schemaId} has no name property`)
	}

	// Get CoMap schema wrapper (this includes Zod validation)
	const { schema: CoMapSchema } = await getCoMapSchemaForSchemaName(account, schemaName)

	// Get CoValue ID and reload with schema wrapper for validation
	const coValueId = loadedCoValue.$jazz?.id
	if (!coValueId) {
		throw new Error('CoValue ID not available')
	}

	// Wrap CoValue with schema (enables Zod validation on $jazz.set)
	const wrappedCoValue = await CoMapSchema.load(coValueId)

	if (!wrappedCoValue) {
		throw new Error(`Failed to load CoValue ${coValueId} with ${schemaName} schema`)
	}

	// Update fields with validation
	for (const [key, value] of Object.entries(updates)) {
		if (value !== undefined) {
			wrappedCoValue.$jazz.set(key, value) // ✅ Zod validates here
		}
	}

	// NO WAIT! Jazz updates locally instantly, syncs in background
	// UI updates reactively via CoState subscriptions
}

/**
 * Generic DELETE function - works for any schema type
 * 
 * @param account - The Jazz account
 * @param entityId - ID of the entity to delete
 * @returns void
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteEntityGeneric(account: any, entityId: string): Promise<void> {
	if (!account || !account.$isLoaded) {
		throw new Error('Account is not loaded')
	}

	// Load root and entities list
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: { entities: true } },
	})

	if (!loadedAccount.root?.entities) {
		throw new Error('Root entities list does not exist - run account migration first')
	}

	const entitiesList = loadedAccount.root.entities
	if (!entitiesList) {
		throw new Error('Entities list could not be loaded')
	}

	// Ensure entities list is loaded
	await entitiesList.$jazz.ensureLoaded()

	// Find entity with matching ID
	// Try multiple ID access patterns for robustness
	let foundIndex = -1
	const entityArray = Array.from(entitiesList)
	for (let i = 0; i < entityArray.length; i++) {
		const entity = entityArray[i] as any
		if (!entity || !entity.$isLoaded) continue
		
		// Try multiple ID access patterns (direct property first, then $jazz)
		const currentEntityId = entity.id || entity.$jazz?.id
		
		if (currentEntityId === entityId) {
			foundIndex = i
			break
		}
	}

	if (foundIndex === -1) {
		throw new Error(`Entity with ID ${entityId} not found in ${entityArray.length} entities`)
	}

	// Remove entity from list using Jazz CoList remove method (by index)
	entitiesList.$jazz.remove(foundIndex)
	// NO WAIT! Jazz removes locally instantly, syncs in background
	// UI updates reactively via CoState subscriptions
}

/**
 * Generic READ/QUERY function - works for any schema type
 * 
 * @param account - The Jazz account
 * @param schemaName - Name of the schema to query
 * @param converter - Optional function to convert CoValue to plain object (defaults to identity)
 * @param entityMap - Optional Map to store CoValue references by ID (for subscription tracking)
 * @returns Array of entities matching the schema
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryEntitiesGeneric<T extends Record<string, unknown>>(
	account: any,
	schemaName: string,
	converter?: (coValue: any) => T,
	entityMap?: Map<string, any>,
): Promise<T[]> {
	if (!account) {
		return []
	}

	try {
		// Load account root and entities list
		const loadedAccount = await account.$jazz.ensureLoaded({
			resolve: { root: { entities: true, schemata: true } },
		})

		if (!loadedAccount.root) {
			return []
		}

		const root = loadedAccount.root

		if (!root.$jazz.has('entities')) {
			return []
		}

		const entitiesList = root.entities
		if (!entitiesList) {
			return []
		}

		// Ensure entities list is loaded
		await entitiesList.$jazz.ensureLoaded()
		const entityArray = Array.from(entitiesList)

		// Find the schema CoValue for this schema name
		const schemaCoValue = await findNestedSchema(account, schemaName)
		if (!schemaCoValue) {
			return []
		}

		const targetSchemaId = schemaCoValue.$jazz?.id
		if (!targetSchemaId) {
			return []
		}

		// Filter entities by schema
		const entities: T[] = []

		// Get node to load CoValues by ID
		let node = getNode(account)
		if (!node && root) {
			node = getNode(root)
		}
		if (!node) {
			return []
		}

		for (let i = 0; i < entityArray.length; i++) {
			const entity = entityArray[i]
			if (!entity || typeof entity !== 'object' || !('$jazz' in entity)) {
				continue
			}

			// Ensure entity is loaded with @schema resolved
			const loadedEntity = await (entity as any).$jazz.ensureLoaded({
				resolve: { '@schema': true },
			})

			if (!loadedEntity.$isLoaded) {
				continue
			}

			// Check if entity has @schema property set
			const hasSchemaProperty = (loadedEntity as any).$jazz?.has('@schema')

			if (!hasSchemaProperty) {
				continue
			}

			// Get @schema - it's stored as a CoValue reference, need to resolve it
			let entitySchema = (loadedEntity as any)['@schema']

			// If not accessible directly, try to get the raw value and load it via node
			if (!entitySchema || typeof entitySchema !== 'object' || !('$jazz' in entitySchema)) {
				// Get the raw CoValue to access the node
				const rawEntity = (loadedEntity as any).$jazz?.raw
				if (!rawEntity) {
					continue
				}

				// Get node from account or entity
				const entityNode = rawEntity.core?.node || (account as any).$jazz?.raw?.core?.node
				if (!entityNode) {
					continue
				}

				// Get @schema ID from the entity's snapshot
				const entitySnapshot = rawEntity.toJSON() as any
				const schemaId = entitySnapshot?.['@schema']

				if (!schemaId || typeof schemaId !== 'string') {
					continue
				}

				// Load the schema CoValue by ID
				try {
					const loadedSchemaValue = await entityNode.load(schemaId as any)
					if (loadedSchemaValue === 'unavailable') {
						continue
					}
					entitySchema = loadedSchemaValue
				} catch (_error) {
					continue
				}
			}

			// Now entitySchema should be a CoValue - get its ID
			let schemaId: string | undefined
			if (entitySchema && typeof entitySchema === 'object' && '$jazz' in entitySchema) {
				schemaId = (entitySchema as any).$jazz?.id
			} else if (entitySchema && typeof entitySchema === 'object' && 'id' in entitySchema) {
				// Might be a raw CoValue with id property
				schemaId = (entitySchema as any).id
			}

			if (!schemaId) {
				continue
			}

			if (schemaId === targetSchemaId) {
				// Ensure entity is fully loaded before converting
				const fullyLoadedEntity = await (loadedEntity as any).$jazz.ensureLoaded({
					resolve: {
						name: true,
						status: true,
						endDate: true,
						duration: true,
						email: true,
						dateOfBirth: true,
						x1: true,
						x2: true,
						x3: true,
						x4: true,
						x5: true,
					},
				})

				// This entity matches the schema - convert to plain object
				const plainObject = converter ? converter(fullyLoadedEntity) : (fullyLoadedEntity as T)
				entities.push(plainObject)

				// Store CoValue in entityMap if provided (for subscription tracking)
				if (entityMap && plainObject.id && typeof plainObject.id === 'string') {
					entityMap.set(plainObject.id, fullyLoadedEntity)
				}
			}
		}

		return entities
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('[queryEntitiesGeneric] Error querying entities:', error)
		return []
	}
}

/**
 * Create an Actor entity with CoFeed/CoList setup
 * 
 * This helper function creates an Actor entity in root.entities using the dynamic schema system.
 * CoFeed/CoList are created automatically by passing empty arrays to CoMapSchema.create().
 * 
 * @param account - The Jazz account
 * @param actorData - Actor data (context, view, dependencies, role, etc.)
 * @param _group - Optional Group parameter (currently unused - all entities use entitiesOwner for consistency)
 * @returns The created actor entity CoValue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createActorEntity(
	account: any,
	actorData: {
		context: any;
		view?: any;
		dependencies: Record<string, string>;
		role?: string;
		position?: number;
	},
	_group?: any, // Kept for API compatibility, but not used (entities use entitiesOwner)
): Promise<any> {
	// Create entity data - pass ARRAYS for CoFeed/CoList, not CoValue objects
	// CoMapSchema.create() will automatically create the CoFeed/CoList with entitiesOwner
	const entityData = {
		type: 'Entity',
		context: actorData.context,
		view: actorData.view,
		dependencies: actorData.dependencies,
		inbox: [], // Pass empty array - co.feed() will create it with entitiesOwner
		subscriptions: [], // Pass empty array - co.list() will create it with entitiesOwner
		children: [], // Pass empty array - co.list() will create it with entitiesOwner
		role: actorData.role,
		position: actorData.position,
	};

	// Use dynamic schema system - createEntityGeneric handles everything
	const actorEntity = await createEntityGeneric(account, 'Actor', entityData);

	return actorEntity;

}

/**
 * Get or create the VibesRegistry entity using cached ID from AppRoot
 * 
 * @param account - The Jazz account
 * @returns The VibesRegistry entity CoValue with $jazz API
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getVibesRegistry(account: any): Promise<any> {
	// Load root with entities to get both cached ID and access to entities list
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: { vibesRegistryId: true, entities: true } },
	});
	
	const root = loadedAccount.root;
	const registryId = root?.vibesRegistryId;
	
	if (registryId && typeof registryId === 'string' && registryId.startsWith('co_')) {
		// ALWAYS load via CoMapSchema to ensure proper schema wrapper with key awareness
		// Without the schema wrapper, Jazz doesn't know which keys are allowed!
		try {
			// Get the schema for VibesRegistry to load it properly
			const schemaResult = await getCoMapSchemaForSchemaName(account, 'VibesRegistry');
			if (schemaResult?.schema) {
				// Load using the schema - this applies the schema wrapper that knows about vibes/humans/todos keys
				const registryCoValue = await schemaResult.schema.load(registryId as any);
				if (registryCoValue) {
					return registryCoValue;
				}
			}
		} catch (error) {
			console.error('[getVibesRegistry] Error loading registry via schema:', error);
		}
	}
	
	// Fallback: Create new registry (should only happen if migration hasn't run)
	// Initialize ALL optional properties with actual values (empty string) to ensure Jazz adds them to the CoMap's allowed keys
	// IMPORTANT: undefined doesn't register keys in Jazz, but concrete values do!
	const registry = await createEntityGeneric(account, 'VibesRegistry', {
		vibes: '',
		humans: '',
		todos: '',
	});
	
	// Store the ID on AppRoot for future lookups
	if (root) {
		root.$jazz.set('vibesRegistryId', registry.$jazz.id);
	}
	
	return registry;
}
