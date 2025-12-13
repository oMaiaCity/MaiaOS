/**
 * CompositeType Manager
 * 
 * Functions for creating CompositeType SchemaDefinitions using ensureSchema()
 */

import { ensureSchema } from '../../functions/dynamic-schema-migration.js'
import { assignedToCompositeTypeSchema } from '../../schemas/data/composite-types.js'

/**
 * Creates ASSIGNED_TO CompositeType SchemaDefinition
 * 
 * @param account - The Jazz account
 * @returns The created ASSIGNED_TO CompositeType SchemaDefinition co-value
 */
export async function createAssignedToCompositeType(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
): Promise<any> {
	console.log('[createAssignedToCompositeType] Creating ASSIGNED_TO CompositeType...')

	// Create CompositeType SchemaDefinition
	// assignedToCompositeTypeSchema defines what Composite instances have (relation with x1-x5)
	const assignedToType = await ensureSchema(account, 'ASSIGNED_TO', assignedToCompositeTypeSchema)

	// Ensure the SchemaDefinition is fully loaded
	await assignedToType.$jazz.ensureLoaded()
	
	// Set the type property to "Composite" on the SchemaDefinition itself (like LeafTypes do)
	// Wrap in try-catch in case the existing SchemaDefinition was created with an older meta-schema
	try {
		assignedToType.$jazz.set('type', 'Composite')
		await assignedToType.$jazz.waitForSync()
	} catch (error) {
		console.warn('[createAssignedToCompositeType] Could not set type property. SchemaDefinition may have been created with older meta-schema:', error)
		// Continue - the SchemaDefinition will work without type set
	}
	
	// Set x1-x5 position descriptions directly on the SchemaDefinition (flattened structure)
	try {
		assignedToType.$jazz.set('x1', 'The Todo being assigned')
		await assignedToType.$jazz.waitForSync()
	} catch (error) {
		console.warn('[createAssignedToCompositeType] Could not set x1 property:', error)
	}
	
	try {
		assignedToType.$jazz.set('x2', 'The Human assigned to')
		await assignedToType.$jazz.waitForSync()
	} catch (error) {
		console.warn('[createAssignedToCompositeType] Could not set x2 property:', error)
	}
	
	try {
		assignedToType.$jazz.set('x3', 'Who assigned this')
		await assignedToType.$jazz.waitForSync()
	} catch (error) {
		console.warn('[createAssignedToCompositeType] Could not set x3 property:', error)
	}
	
	try {
		assignedToType.$jazz.set('x4', 'Assignment timestamp')
		await assignedToType.$jazz.waitForSync()
	} catch (error) {
		console.warn('[createAssignedToCompositeType] Could not set x4 property:', error)
	}
	
	try {
		assignedToType.$jazz.set('x5', 'Acceptance timestamp')
		await assignedToType.$jazz.waitForSync()
	} catch (error) {
		console.warn('[createAssignedToCompositeType] Could not set x5 property:', error)
	}

	console.log('[createAssignedToCompositeType] ASSIGNED_TO CompositeType created, ID:', assignedToType?.$jazz?.id, 'type:', assignedToType.type)
	return assignedToType
}

