/**
 * Composite Manager
 * 
 * Functions for creating Composite Entity instances
 * Composites are Entity co-values that reference their CompositeType SchemaDefinition via @schema
 * and have relations that reference Leaf/Composite Entities via CoRefs
 * Uses generic CRUD functions internally for runtime type safety
 */

import {
	createEntityGeneric,
	updateEntityGeneric,
	deleteEntityGeneric,
} from '../../functions/generic-crud.js'

/**
 * Creates an ASSIGNED_TO Composite Entity instance
 * Uses generic CREATE function internally for runtime type safety
 * 
 * @param account - The Jazz account
 * @param relation - Composite relation (x1: Todo Leaf/Composite, x2: Human Leaf/Composite, x3-x5: optional)
 * @returns The created ASSIGNED_TO Composite Entity co-value
 */
export async function createAssignedToComposite(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	relation: {
		x1: any // Leaf or Composite Entity CoValue
		x2: any // Leaf or Composite Entity CoValue
		x3?: any // Leaf or Composite Entity CoValue (optional)
		x4?: any // Leaf or Composite Entity CoValue (optional)
		x5?: any // Leaf or Composite Entity CoValue (optional)
	},
): Promise<any> {
	console.log('[createAssignedToComposite] Creating ASSIGNED_TO Composite...')

	// Use generic CREATE function - ensures schema exists, validates with Zod, sets system props
	const composite = await createEntityGeneric(account, 'ASSIGNED_TO', {
		x1: relation.x1,
		x2: relation.x2,
		x3: relation.x3,
		x4: relation.x4,
		x5: relation.x5,
	})

	console.log('[createAssignedToComposite] ASSIGNED_TO Composite created, ID:', composite.$jazz.id)
	return composite
}

/**
 * Updates an ASSIGNED_TO Composite Entity instance
 * Uses generic UPDATE function internally for runtime type safety
 * 
 * @param coValue - The ASSIGNED_TO CoValue to update
 * @param data - Partial ASSIGNED_TO data to update (x1-x5)
 * @param account - Optional Jazz account (will try to extract from coValue if not provided)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAssignedToComposite(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	coValue: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: Partial<{
		x1?: any
		x2?: any
		x3?: any
		x4?: any
		x5?: any
	}>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account?: any,
): Promise<void> {
	if (!coValue || !coValue.$isLoaded) {
		throw new Error('CoValue is not loaded')
	}

	// Get account from parameter or try to extract from coValue
	let resolvedAccount = account
	
	if (!resolvedAccount) {
		const raw = (coValue as any).$jazz?.raw
		if (raw?.core?.node?.account) {
			resolvedAccount = raw.core.node.account
		} else if (raw?.account) {
			resolvedAccount = raw.account
		}
	}

	if (!resolvedAccount) {
		throw new Error('Cannot determine account from CoValue. Please pass account as parameter.')
	}

	await updateEntityGeneric(resolvedAccount, coValue, data)
}

/**
 * Deletes an ASSIGNED_TO Composite Entity instance
 * Uses generic DELETE function internally
 * 
 * @param account - The Jazz account
 * @param entityId - ID of the ASSIGNED_TO entity to delete
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteAssignedToComposite(account: any, entityId: string): Promise<void> {
	await deleteEntityGeneric(account, entityId)
}

