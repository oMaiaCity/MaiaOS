/**
 * Specialized operations for Todo entities
 * This module provides CRUD operations specifically for Todo entities
 * Uses generic CRUD functions internally for runtime type safety
 */

import {
	createEntityGeneric,
	updateEntityGeneric,
	deleteEntityGeneric,
} from '../../functions/generic-crud.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TodoEntityData {
	id?: string // Optional - not used by createTodoEntity, but may be present for updates
	text: string
	description?: string
	status?: string // Changed from enum to plain string
	endDate?: string // ISO string
	duration?: number // minutes
}

/**
 * Creates a new Todo entity in Jazz
 * This creates a Todo Leaf using the dynamic schema system
 * Uses generic CRUD functions internally for runtime type safety
 *
 * @param account - Jazz account to create the entity under
 * @param data - Todo entity data matching the schema
 * @returns The created Todo entity (CoValue)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createTodoEntity(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	data: TodoEntityData,
): Promise<any> {
	if (!account || !account.$isLoaded) {
		throw new Error('Account is not loaded')
	}

	// Use generic CREATE function - ensures schema exists, validates with Zod, sets system props
	return createEntityGeneric(account, 'Todo', {
		text: data.text,
		status: data.status || 'todo',
		endDate: data.endDate,
		duration: data.duration,
		description: data.description,
	})
}

/**
 * Updates an existing Todo entity
 * Modifies the specified fields of an existing Todo entity
 * Uses generic UPDATE function internally for runtime type safety
 *
 * @param coValue - The Todo CoValue to update
 * @param data - Partial Todo entity data to update
 * @param account - Optional Jazz account (will try to extract from coValue if not provided)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateTodoEntity(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	coValue: any,
	data: Partial<TodoEntityData>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account?: any,
): Promise<void> {
	if (!coValue || !coValue.$isLoaded) {
		throw new Error('CoValue is not loaded')
	}

	// Get account from parameter or try to extract from coValue
	let resolvedAccount = account
	
	if (!resolvedAccount) {
		// Try multiple methods to get account from coValue
		const raw = (coValue as any).$jazz?.raw
		
		// Method 1: Try from coValue's raw node
		if (raw?.core?.node?.account) {
			resolvedAccount = raw.core.node.account
		}
		
		// Method 2: Try from coValue's raw directly
		if (!resolvedAccount && raw?.account) {
			resolvedAccount = raw.account
		}
		
		// Method 3: Try to get from node
		if (!resolvedAccount) {
			try {
				const node = raw?.core?.node || (coValue as any).core?.node
				if (node?.account) {
					resolvedAccount = node.account
				}
			} catch (_e) {
				// Ignore
			}
		}
	}

	if (!resolvedAccount) {
		throw new Error('Cannot determine account from CoValue. Please pass account as parameter.')
	}

	// Use generic UPDATE function - wraps with schema, validates with Zod
	await updateEntityGeneric(resolvedAccount, coValue, {
		text: data.text,
		status: data.status,
		endDate: data.endDate,
		duration: data.duration,
		description: data.description,
	})
}

/**
 * Deletes a Todo entity
 * Removes the entity from the entities list
 * Uses generic DELETE function internally
 *
 * @param account - Jazz account
 * @param entityId - ID of the Todo entity to delete
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteTodoEntity(account: any, entityId: string): Promise<void> {
	if (!account || !account.$isLoaded) {
		throw new Error('Account is not loaded')
	}

	// Use generic DELETE function
	await deleteEntityGeneric(account, entityId)
}
