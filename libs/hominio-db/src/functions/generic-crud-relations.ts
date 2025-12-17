/**
 * Generic CRUD Functions for Relations
 * 
 * Fully generic CRUD operations for relations that work for any dynamic schema.
 * Relations are stored in root.relations CoList (separate from root.entities).
 * Uses Zod schemas for runtime validation on CREATE and UPDATE operations.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const console: any

import { co } from 'jazz-tools'
import { getJsonSchema } from '../schemas/schema-registry.js'
import { addLabelToSchema, jsonSchemaToCoMapShape, ensureSchema } from './dynamic-schema-migration.js'
import { setSystemProps } from './set-system-props.js'

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
 * @param schemaName - Name of the schema (e.g., "AssignedTo")
 * @returns Object with schema wrapper and schema definition CoValue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCoMapSchemaForRelationSchemaName(
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

	// Ensure schema definition is loaded
	await schemaDefinition.$jazz.ensureLoaded()

	// Set the type property to "Relation" on the SchemaDefinition
	// This distinguishes Relation schemas from Entity schemas
	schemaDefinition.$jazz.set('type', 'Relation')
	await schemaDefinition.$jazz.waitForSync()

	// Add system props (@label, @schema) to JSON Schema
	const jsonSchemaWithSystemProps = addLabelToSchema(jsonSchema)

	// Convert to Zod shape
	const shape = jsonSchemaToCoMapShape(jsonSchemaWithSystemProps)

	// Create CoMap schema wrapper
	const CoMapSchema = co.map(shape)

	return { schema: CoMapSchema, schemaDefinition }
}

/**
 * Generic CREATE function for relations - works for any relation schema type
 * 
 * @param account - The Jazz account
 * @param schemaName - Name of the relation schema (e.g., "AssignedTo")
 * @param relationData - Data for the relation instance
 * @returns The created relation CoValue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createRelationGeneric(
	account: any,
	schemaName: string,
	relationData: any,
): Promise<any> {
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] ENTRY - schemaName:', schemaName, 'relationData:', relationData)

	// Get CoMap schema wrapper
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] Getting CoMap schema wrapper...')
	const { schema: CoMapSchema, schemaDefinition } = await getCoMapSchemaForRelationSchemaName(
		account,
		schemaName,
	)
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] Got schema wrapper, schemaDefinition ID:', schemaDefinition?.$jazz?.id)

	// Load root and ensure relations list exists
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] Loading account root and relations list...')
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: true },
	})

	if (!loadedAccount.root) {
		throw new Error('Root does not exist - run account migration first')
	}

	const root = loadedAccount.root

	// Ensure root.relations CoList exists
	if (!root.$jazz.has('relations')) {
		// eslint-disable-next-line no-console
		console.log('[createRelationGeneric] Creating root.relations CoList...')
		// Create a group for relations list (required for CoList)
		const relationsGroup = co.group()
		await relationsGroup.$jazz.waitForSync()
		
		// Create empty relations list with group owner (matches migration pattern)
		const relationsList = co.list(co.map({})).create([], relationsGroup)
		await relationsList.$jazz.waitForSync()
		root.$jazz.set('relations', relationsList)
		await root.$jazz.waitForSync()
		// eslint-disable-next-line no-console
		console.log('[createRelationGeneric] root.relations CoList created')
	}

	// Load relations list
	const rootWithRelations = await root.$jazz.ensureLoaded({
		resolve: { relations: true },
	})

	const relationsList = rootWithRelations.relations
	const relationsOwner = (relationsList as any).$jazz?.owner
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] Relations list owner:', relationsOwner?.$jazz?.id)

	if (!relationsOwner) {
		// eslint-disable-next-line no-console
		console.error('[createRelationGeneric] ERROR: Cannot determine relations list owner')
		throw new Error('Cannot determine relations list owner')
	}

	// Create relation with Zod validation
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] Creating relation with CoMapSchema.create...')
	const relation = CoMapSchema.create(relationData, relationsOwner)
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] Relation created, ID:', relation?.$jazz?.id)
	await relation.$jazz.waitForSync()
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] Relation synced')

	// Set system properties (@label, @schema)
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] Setting system properties...')
	await setSystemProps(relation, schemaDefinition)
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] System properties set')

	// Add to relations list
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] Adding relation to relations list...')
	relationsList.$jazz.push(relation)
	await relationsList.$jazz.waitForSync()
	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] Relation added to list and synced')

	// eslint-disable-next-line no-console
	console.log('[createRelationGeneric] SUCCESS - Returning relation:', relation?.$jazz?.id)
	return relation
}

/**
 * Generic UPDATE function for relations - works for any relation schema type
 * Automatically wraps CoValue with correct schema for validation
 * 
 * @param account - The Jazz account
 * @param coValue - The CoValue to update
 * @param updates - Partial data to update
 * @returns void
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateRelationGeneric(
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
	const { schema: CoMapSchema } = await getCoMapSchemaForRelationSchemaName(account, schemaName)

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

	await wrappedCoValue.$jazz.waitForSync()
}

/**
 * Generic DELETE function for relations - works for any relation schema type
 * 
 * @param account - The Jazz account
 * @param relationId - ID of the relation to delete
 * @returns void
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteRelationGeneric(account: any, relationId: string): Promise<void> {
	if (!account || !account.$isLoaded) {
		throw new Error('Account is not loaded')
	}

	// Load root and relations list
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: true },
	})

	if (!loadedAccount.root) {
		throw new Error('Root does not exist - run account migration first')
	}

	const root = loadedAccount.root

	// Ensure root.relations CoList exists
	if (!root.$jazz.has('relations')) {
		// Relations list doesn't exist, nothing to delete
		return
	}

	const rootWithRelations = await root.$jazz.ensureLoaded({
		resolve: { relations: true },
	})

	const relationsList = rootWithRelations.relations
	if (!relationsList) {
		throw new Error('Relations list could not be loaded')
	}

	// Ensure relations list is loaded
	await relationsList.$jazz.ensureLoaded()

	// Find relation with matching ID
	// Try multiple ID access patterns for robustness
	let foundIndex = -1
	const relationArray = Array.from(relationsList)
	for (let i = 0; i < relationArray.length; i++) {
		const relation = relationArray[i] as any
		if (!relation || !relation.$isLoaded) continue
		
		// Try multiple ID access patterns (direct property first, then $jazz)
		const currentRelationId = relation.id || relation.$jazz?.id
		
		if (currentRelationId === relationId) {
			foundIndex = i
			break
		}
	}

	if (foundIndex === -1) {
		throw new Error(`Relation with ID ${relationId} not found in ${relationArray.length} relations`)
	}

	// Remove relation from list using Jazz CoList remove method (by index)
	relationsList.$jazz.remove(foundIndex)
	await relationsList.$jazz.waitForSync()
}

