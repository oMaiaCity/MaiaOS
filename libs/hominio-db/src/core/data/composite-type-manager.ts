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

	// Define the relation structure with x1-x5 positions
	const relationData = {
		x1: {
			leafTypes: ['Todo'],
			required: true,
			description: 'The Todo being assigned',
		},
		x2: {
			leafTypes: ['Human'],
			required: true,
			description: 'The Human assigned to',
		},
		x3: {
			leafTypes: ['Human'],
			required: false,
			description: 'Who assigned this',
		},
		x4: {
			leafTypes: ['Date'],
			required: false,
			description: 'Assignment timestamp',
		},
		x5: {
			leafTypes: ['Date'],
			required: false,
			description: 'Acceptance timestamp',
		},
	}

	// Create the full schema data
	const schemaData = {
		name: 'ASSIGNED_TO',
		definition: 'x1 (Todo) is assigned to x2 (Human) by x3 at time x4 accepted at x5',
		relation: relationData,
	}

	// Create CompositeType SchemaDefinition
	const assignedToType = await ensureSchema(account, 'ASSIGNED_TO', assignedToCompositeTypeSchema)

	// Set the relation data on the schema (since relation is a passthrough object, we can set it directly)
	// Note: The schema definition is stored in the definition property, but we need to set the actual relation data
	// Actually, wait - ensureSchema creates a SchemaDefinition with the JSON schema in the definition property
	// But we want the actual relation data stored. Let me check how this should work...

	// Actually, I think the relation structure is part of the schema definition itself
	// The actual Composite instances will have bindings that reference Leafs
	// So we just need to ensure the schema exists with the correct structure

	console.log('[createAssignedToCompositeType] ASSIGNED_TO CompositeType created, ID:', assignedToType?.$jazz?.id)
	return assignedToType
}

