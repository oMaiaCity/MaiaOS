/**
 * Specialized operations for Todo entities
 * This module provides CRUD operations specifically for Todo entities
 */

import { addLabelToSchema, ensureSchema } from '../../functions/dynamic-schema-migration.js'
import { jsonSchemaToCoMapShape } from '../../functions/dynamic-schema-migration.js'
import { co } from 'jazz-tools'
import { todoLeafTypeSchema } from '../../schemas/data/leaf-types.js'
import { setSystemProps } from '../../functions/set-system-props.js'

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

	// Ensure Todo schema exists first (same pattern as createTodoLeaf)
	const todoSchema = await ensureSchema(account, 'Todo', todoLeafTypeSchema)

	// Load root and ensure entities list exists
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: true },
	})

	if (!loadedAccount.root) {
		throw new Error('Root does not exist')
	}

	const root = loadedAccount.root

	// Ensure entities list exists
	if (!root.$jazz.has('entities')) {
		throw new Error('Entities list does not exist - run account migration first')
	}

	// Load entities list
	const rootWithEntities = await root.$jazz.ensureLoaded({
		resolve: { entities: true },
	})
	const entitiesList = rootWithEntities.entities

	if (!entitiesList) {
		throw new Error('Entities list could not be loaded')
	}

	// Get the owner group from the entities list (same pattern as createTodoLeaf)
	const entitiesOwner = (entitiesList as any).$jazz?.owner
	if (!entitiesOwner) {
		throw new Error('Cannot determine entities list owner')
	}

	// Schema is already ensured above, use it directly

	// Add @label and @schema to Todo schema before creating CoMap
	const todoSchemaWithSystemProps = addLabelToSchema(todoLeafTypeSchema)
	
	
	const todoShape = jsonSchemaToCoMapShape(todoSchemaWithSystemProps)
	
	
	// Ensure status is in the shape - if not, add it manually
	if (!('status' in todoShape)) {
		const { z } = await import('jazz-tools')
		todoShape.status = z.optional(z.string())
	}
	
	const TodoCoMap = co.map(todoShape)

	// Create Todo Entity with actual data
	let todoEntity: any
	try {
		todoEntity = TodoCoMap.create(
			{
				text: data.text,
				status: data.status || 'todo',
				endDate: data.endDate,
				duration: data.duration,
			},
			entitiesOwner,
		)
	} catch (createError) {
		throw createError
	}
	
	await todoEntity.$jazz.waitForSync()

	// Set system properties (@label, @schema reference)
	await setSystemProps(todoEntity, todoSchema)

	// Wait for sync to ensure entity is persisted
	await todoEntity.$jazz.waitForSync()

	// Add Todo Entity to root.entities list (CRITICAL: Without this, the entity won't appear in queries!)
	entitiesList.$jazz.push(todoEntity)
	await root.$jazz.waitForSync()

	return todoEntity
}

/**
 * Updates an existing Todo entity
 * Modifies the specified fields of an existing Todo entity
 *
 * @param coValue - The Todo CoValue to update
 * @param data - Partial Todo entity data to update
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateTodoEntity(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	coValue: any,
	data: Partial<TodoEntityData>,
): Promise<void> {
	
	if (!coValue || !coValue.$isLoaded) {
		throw new Error('CoValue is not loaded')
	}

	// CRITICAL FIX: The coValue from entityMap is a raw ZCoMap without schema wrapper
	// We need to wrap it with the TodoCoMap schema to enable $jazz.set() operations
	// Recreate the TodoCoMap schema and use it to load the entity properly
	const todoSchemaWithSystemProps = addLabelToSchema(todoLeafTypeSchema)
	const todoShape = jsonSchemaToCoMapShape(todoSchemaWithSystemProps)
	
	// Ensure status is in the shape
	if (!('status' in todoShape)) {
		const { z } = await import('jazz-tools')
		todoShape.status = z.optional(z.string())
	}
	
	const TodoCoMap = co.map(todoShape)
	
	// Get the CoValue ID and reload it using the schema-wrapped class
	const coValueId = coValue.$jazz?.id
	if (!coValueId) {
		throw new Error('CoValue ID not available')
	}
	
	
	// Load the entity with the schema wrapper (this gives us a properly typed CoValue)
	const wrappedCoValue = await TodoCoMap.load(coValueId)
	if (!wrappedCoValue) {
		throw new Error(`Failed to load CoValue ${coValueId} with TodoCoMap schema`)
	}
	
	
	// Use the wrapped CoValue for all updates
	coValue = wrappedCoValue

	// Update fields if provided
	if (data.text !== undefined) {
		coValue.$jazz.set('text', data.text)
	}
	if (data.status !== undefined) {
		coValue.$jazz.set('status', data.status)
	}
	if (data.endDate !== undefined) {
		coValue.$jazz.set('endDate', data.endDate)
	}
	if (data.duration !== undefined) {
		coValue.$jazz.set('duration', data.duration)
	}

	await coValue.$jazz.waitForSync()
}

/**
 * Deletes a Todo entity
 * Removes the entity from the entities list
 *
 * @param account - Jazz account
 * @param entityId - ID of the Todo entity to delete
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteTodoEntity(account: any, entityId: string): Promise<void> {
	if (!account || !account.$isLoaded) {
		throw new Error('Account is not loaded')
	}

	// Load root and ensure entities list exists (same pattern as createTodoEntity)
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: true },
	})

	if (!loadedAccount.root) {
		throw new Error('Root does not exist')
	}

	const root = loadedAccount.root

	// Ensure entities list exists
	if (!root.$jazz.has('entities')) {
		throw new Error('Entities list does not exist - run account migration first')
	}

	// Load entities list
	const rootWithEntities = await root.$jazz.ensureLoaded({
		resolve: { entities: true },
	})
	const entities = rootWithEntities.entities

	if (!entities) {
		throw new Error('Entities list could not be loaded')
	}

	// Find entity with matching ID
	let foundIndex = -1
	for (let i = 0; i < entities.length; i++) {
		const entity = entities[i]
		if (entity && entity.$jazz && entity.$jazz.id === entityId) {
			foundIndex = i
			break
		}
	}

	if (foundIndex === -1) {
		throw new Error(`Todo entity with ID ${entityId} not found`)
	}

	// Remove entity from list using Jazz CoList remove method (by index)
	entities.$jazz.remove(foundIndex)
	await entities.$jazz.waitForSync()
}
