/**
 * Leaf Manager
 * 
 * Functions for creating Leaf Entity instances using generic CRUD functions
 * Leafs are Entity co-values that reference their LeafType SchemaDefinition via @schema
 * Uses generic CRUD functions internally for runtime type safety
 */

import {
	createEntityGeneric,
	updateEntityGeneric,
	deleteEntityGeneric,
} from '../../functions/generic-crud.js'

/**
 * Creates a Human Leaf Entity instance
 * Uses generic CREATE function internally for runtime type safety
 * 
 * @param account - The Jazz account
 * @param data - Human Leaf data (id, name, email, dateOfBirth)
 * @returns The created Human Leaf Entity co-value
 */
export async function createHumanLeaf(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: { id: string; name: string; email?: string; dateOfBirth?: Date },
): Promise<any> {
	// Use generic CREATE function - ensures schema exists, validates with Zod, sets system props
	return createEntityGeneric(account, 'Human', {
		name: data.name,
		email: data.email,
		dateOfBirth: data.dateOfBirth,
	})
}

/**
 * Creates a Todo Leaf Entity instance
 * Uses generic CREATE function internally for runtime type safety
 * 
 * @param account - The Jazz account
 * @param data - Todo Leaf data (id, text, description, status, endDate, duration)
 * @returns The created Todo Leaf Entity co-value
 */
export async function createTodoLeaf(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: {
		id: string
		text: string
		description?: string
		status?: string // Plain string (e.g., 'todo', 'in-progress', 'done')
		endDate?: string // ISO string
		duration?: number // minutes
	},
): Promise<any> {
	// Use generic CREATE function - ensures schema exists, validates with Zod, sets system props
	return createEntityGeneric(account, 'Todo', {
		text: data.text,
		description: data.description,
		status: data.status || 'todo',
		endDate: data.endDate,
		duration: data.duration,
	})
}

/**
 * Updates a Human Leaf Entity instance
 * Uses generic UPDATE function internally for runtime type safety
 * 
 * @param coValue - The Human CoValue to update
 * @param data - Partial Human Leaf data to update
 * @param account - Optional Jazz account (will try to extract from coValue if not provided)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateHumanLeaf(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	coValue: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: Partial<{ name: string; email?: string; dateOfBirth?: Date }>,
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
 * Deletes a Human Leaf Entity instance
 * Uses generic DELETE function internally
 * 
 * @param account - The Jazz account
 * @param entityId - ID of the Human entity to delete
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteHumanLeaf(account: any, entityId: string): Promise<void> {
	await deleteEntityGeneric(account, entityId)
}

/**
 * Updates a Todo Leaf Entity instance
 * Uses generic UPDATE function internally for runtime type safety
 * 
 * @param coValue - The Todo CoValue to update
 * @param data - Partial Todo Leaf data to update
 * @param account - Optional Jazz account (will try to extract from coValue if not provided)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateTodoLeaf(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	coValue: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: Partial<{
		text: string
		description?: string
		status?: string
		endDate?: string
		duration?: number
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
 * Deletes a Todo Leaf Entity instance
 * Uses generic DELETE function internally
 * 
 * @param account - The Jazz account
 * @param entityId - ID of the Todo entity to delete
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteTodoLeaf(account: any, entityId: string): Promise<void> {
	await deleteEntityGeneric(account, entityId)
}

