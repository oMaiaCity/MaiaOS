/**
 * Leaf Manager
 * 
 * Functions for creating Leaf Entity instances using createEntity()
 * Leafs are Entity co-values that reference their LeafType SchemaDefinition via @schema
 */

import { co } from 'jazz-tools'
import { ensureSchema, jsonSchemaToCoMapShape, addLabelToSchema } from '../../functions/dynamic-schema-migration.js'
import { setSystemProps } from '../../functions/set-system-props.js'
import { humanLeafTypeSchema, todoLeafTypeSchema } from '../../schemas/data/leaf-types.js'

/**
 * Creates a Human Leaf Entity instance
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
	console.log('[createHumanLeaf] Creating Human Leaf:', data.name)

	// Ensure Human LeafType schema exists
	const humanLeafType = await ensureSchema(account, 'Human', humanLeafTypeSchema)

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

	// Get the owner group from the entities list
	const entitiesOwner = (entitiesList as any).$jazz?.owner
	if (!entitiesOwner) {
		throw new Error('Cannot determine entities list owner')
	}

	// Add @label and @schema to Human schema before creating CoMap
	const humanSchemaWithSystemProps = addLabelToSchema(humanLeafTypeSchema)
	const humanShape = jsonSchemaToCoMapShape(humanSchemaWithSystemProps)
	const HumanCoMap = co.map(humanShape)

	// Create Human Leaf Entity with actual data
	const humanLeaf = HumanCoMap.create(
		{
			name: data.name,
			email: data.email,
			dateOfBirth: data.dateOfBirth,
		},
		entitiesOwner,
	)
	await humanLeaf.$jazz.waitForSync()

	// Set system properties - Human Leaf references Human LeafType SchemaDefinition
	await setSystemProps(humanLeaf, humanLeafType)

	// Add Human Leaf to root.entities list
	entitiesList.$jazz.push(humanLeaf)
	await root.$jazz.waitForSync()

	console.log('[createHumanLeaf] Human Leaf created, ID:', humanLeaf.$jazz.id)
	return humanLeaf
}

/**
 * Creates a Todo Leaf Entity instance
 * 
 * @param account - The Jazz account
 * @param data - Todo Leaf data (id, name, description, status, dueDate)
 * @returns The created Todo Leaf Entity co-value
 */
export async function createTodoLeaf(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: {
		id: string
		name: string
		description?: string
		status?: 'todo' | 'in_progress' | 'done' | 'blocked'
		dueDate?: Date
	},
): Promise<any> {
	console.log('[createTodoLeaf] Creating Todo Leaf:', data.name)

	// Ensure Todo LeafType schema exists
	const todoLeafType = await ensureSchema(account, 'Todo', todoLeafTypeSchema)

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

	// Get the owner group from the entities list
	const entitiesOwner = (entitiesList as any).$jazz?.owner
	if (!entitiesOwner) {
		throw new Error('Cannot determine entities list owner')
	}

	// Add @label and @schema to Todo schema before creating CoMap
	const todoSchemaWithSystemProps = addLabelToSchema(todoLeafTypeSchema)
	const todoShape = jsonSchemaToCoMapShape(todoSchemaWithSystemProps)
	const TodoCoMap = co.map(todoShape)

	// Create Todo Leaf Entity with actual data
	const todoLeaf = TodoCoMap.create(
		{
			name: data.name,
			description: data.description,
			status: data.status,
			dueDate: data.dueDate,
		},
		entitiesOwner,
	)
	await todoLeaf.$jazz.waitForSync()

	// Set system properties - Todo Leaf references Todo LeafType SchemaDefinition
	await setSystemProps(todoLeaf, todoLeafType)

	// Add Todo Leaf to root.entities list
	entitiesList.$jazz.push(todoLeaf)
	await root.$jazz.waitForSync()

	console.log('[createTodoLeaf] Todo Leaf created, ID:', todoLeaf.$jazz.id)
	return todoLeaf
}

