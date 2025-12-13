/**
 * Car entity management using Entity instances
 *
 * Creates Entity instances directly - Car and Color entities that reference
 * the generic Entity schema via @schema
 */

import { co } from 'jazz-tools'
import { ensureSchema, jsonSchemaToCoMapShape } from '../functions/dynamic-schema-migration.js'
import { setSystemProps } from '../functions/set-system-props.js'

// Random data generators for cars
const CAR_NAMES = [
	'Tesla Model 3',
	'Toyota Camry',
	'Honda Civic',
	'Ford Mustang',
	'BMW 3 Series',
	'Mercedes-Benz C-Class',
	'Audi A4',
	'Volkswagen Golf',
	'Nissan Altima',
	'Chevrolet Malibu',
]

const CAR_COLORS = [
	'Red',
	'Blue',
	'Green',
	'Black',
	'White',
	'Silver',
	'Gray',
	'Yellow',
	'Orange',
	'Purple',
]

/**
 * Ensures Car schema exists (legacy function - deprecated)
 *
 * @param account - The Jazz account
 */
export async function migrateAddCars(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
): Promise<void> {
	// No-op - Car schema is no longer needed
}

/**
 * Creates a random Car entity and Color entity
 * Creates Entity instances that reference the generic Entity schema via @schema
 *
 * @param account - The Jazz account
 * @returns The created Car Entity instance
 */
export async function addRandomCarInstance(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	// Generate random car data
	const randomName = CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)]
	const randomColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]

	// Ensure Entity schema exists (defines the structure of Entity instances)
	const entitySchemaJson = {
		type: 'object',
		properties: {
			'@schema': { type: 'o-map' },
			'@label': { type: 'string' },
			name: { type: 'string' },
			type: { type: 'string' },
			primitive: { type: 'string' },
		},
		required: ['type'],
	}
	
	console.log('[addRandomCarInstance] Ensuring Entity schema exists...')
	let entitySchemaDefinition
	try {
		entitySchemaDefinition = await ensureSchema(account, 'Entity', entitySchemaJson)
		console.log('[addRandomCarInstance] Entity schema ensured, ID:', entitySchemaDefinition?.$jazz?.id)
	} catch (error) {
		console.error('[addRandomCarInstance] Error ensuring Entity schema:', error)
		throw error
	}

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

	// Get Entity CoMap schema dynamically
	const entityShape = jsonSchemaToCoMapShape(entitySchemaJson)
	const EntityCoMap = co.map(entityShape)

	// Create Color entity with @schema pointing to Entity schema (generic!)
	const colorEntity = EntityCoMap.create(
		{
			name: randomColor,
			type: 'Color',
			primitive: undefined, // Not set for now
		},
		entitiesOwner,
	)
	await colorEntity.$jazz.waitForSync()

	// Set system properties - Color entity references Entity schema definition (generic!)
	await setSystemProps(colorEntity, entitySchemaDefinition)

	// Add Color entity to root.entities list
	entitiesList.$jazz.push(colorEntity)

	// Create Car entity with @schema pointing to Entity schema (generic!)
	const carEntity = EntityCoMap.create(
		{
			name: randomName,
			type: 'Car',
			primitive: undefined, // Not set for now - later we'll create relationships
		},
		entitiesOwner,
	)
	await carEntity.$jazz.waitForSync()

	// Set system properties - Car entity references Entity schema definition (generic!)
	await setSystemProps(carEntity, entitySchemaDefinition)

	// Add Car entity to root.entities list
	entitiesList.$jazz.push(carEntity)
	await root.$jazz.waitForSync()

	return carEntity
}

/**
 * Clears all items from the schemata list (removes all schemas and their entities)
 * Keeps the schemata list structure intact
 *
 * @param account - The Jazz account
 */
export async function resetData(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
): Promise<void> {
	// Load root
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: true },
	})

	if (!loadedAccount.root) {
		throw new Error('Root does not exist')
	}

	const root = loadedAccount.root

	// Clear schemata list (keep the list structure, just remove items)
	if (root.$jazz.has('schemata')) {
		// Load schemata list
		const rootWithSchemata = await root.$jazz.ensureLoaded({
			resolve: { schemata: true },
		})
		const schemataList = rootWithSchemata.schemata

		if (schemataList?.$isLoaded) {
			// Get current length
			const currentLength = Array.from(schemataList).length

			// Remove all items by splicing from the end (safer than iterating forward)
			for (let i = currentLength - 1; i >= 0; i--) {
				schemataList.$jazz.splice(i, 1)
			}

			await root.$jazz.waitForSync()
		}
	}

	// Clear entities list (keep the list structure, just remove items)
	if (root.$jazz.has('entities')) {
		// Load entities list
		const rootWithEntities = await root.$jazz.ensureLoaded({
			resolve: { entities: true },
		})
		const entitiesList = rootWithEntities.entities

		if (entitiesList?.$isLoaded) {
			// Get current length
			const currentLength = Array.from(entitiesList).length

			// Remove all items by splicing from the end (safer than iterating forward)
			for (let i = currentLength - 1; i >= 0; i--) {
				entitiesList.$jazz.splice(i, 1)
			}

			await root.$jazz.waitForSync()
		}
	}
}
