/**
 * LeafType Manager
 * 
 * Functions for creating LeafType SchemaDefinitions using ensureSchema()
 */

import { ensureSchema } from '../../functions/dynamic-schema-migration.js'
import { humanLeafTypeSchema, todoLeafTypeSchema } from '../../schemas/data/leaf-types.js'

/**
 * Creates Human LeafType SchemaDefinition
 * 
 * @param account - The Jazz account
 * @returns The created Human LeafType SchemaDefinition co-value
 */
export async function createHumanLeafType(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
): Promise<any> {
	console.log('[createHumanLeafType] Creating Human LeafType...')
	const humanLeafType = await ensureSchema(account, 'Human', humanLeafTypeSchema)
	
	// Set the type property to "Leaf" on the SchemaDefinition itself (alongside name and definition)
	await humanLeafType.$jazz.ensureLoaded()
	humanLeafType.$jazz.set('type', 'Leaf')
	await humanLeafType.$jazz.waitForSync()
	
	console.log('[createHumanLeafType] Human LeafType created, ID:', humanLeafType?.$jazz?.id, 'type:', humanLeafType.type)
	return humanLeafType
}

/**
 * Creates Todo LeafType SchemaDefinition
 * 
 * @param account - The Jazz account
 * @returns The created Todo LeafType SchemaDefinition co-value
 */
export async function createTodoLeafType(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
): Promise<any> {
	console.log('[createTodoLeafType] Creating Todo LeafType...')
	const todoLeafType = await ensureSchema(account, 'Todo', todoLeafTypeSchema)
	
	// Set the type property to "Leaf" on the SchemaDefinition itself (alongside name and definition)
	await todoLeafType.$jazz.ensureLoaded()
	todoLeafType.$jazz.set('type', 'Leaf')
	await todoLeafType.$jazz.waitForSync()
	
	console.log('[createTodoLeafType] Todo LeafType created, ID:', todoLeafType?.$jazz?.id, 'type:', todoLeafType.type)
	return todoLeafType
}

