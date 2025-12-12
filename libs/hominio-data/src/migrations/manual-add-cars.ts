/**
 * Car entity management using dynamic schema migration
 *
 * Uses the generic dynamic schema migration utility to automatically
 * ensure the Car schema exists and create car instances
 */

import { createEntity, ensureSchema } from '../functions/dynamic-schema-migration.js'

// JSON Schema definition for Car
export const CarJsonSchema = {
	type: 'object',
	properties: {
		name: {
			type: 'string',
		},
		color: {
			type: 'string',
		},
	},
	required: ['name', 'color'],
}

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
 * Ensures Car schema exists (legacy function - now uses generic utility)
 *
 * @param account - The Jazz account
 */
export async function migrateAddCars(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
): Promise<void> {
	await ensureSchema(account, 'Car', CarJsonSchema)
}

/**
 * Creates a random Car instance
 * Automatically ensures the Car schema exists first
 *
 * @param account - The Jazz account
 */
export async function addRandomCarInstance(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	// Generate random car data
	const randomName = CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)]
	const randomColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]

	// Use generic createEntity utility - automatically ensures schema exists!
	const carInstance = await createEntity(account, 'Car', CarJsonSchema, {
		name: randomName,
		color: randomColor,
	})

	return carInstance
}

/**
 * Clears all items from the data list (removes all schemas and their entities)
 * Keeps the data list structure intact
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

	// Check if data list exists
	if (root.$jazz.has('data')) {
		// Load data list
		const rootWithData = await root.$jazz.ensureLoaded({
			resolve: { data: true },
		})
		const dataList = rootWithData.data

		if (dataList?.$isLoaded) {
			// Get current length
			const currentLength = Array.from(dataList).length

			// Remove all items by splicing from the end (safer than iterating forward)
			for (let i = currentLength - 1; i >= 0; i--) {
				dataList.$jazz.splice(i, 1)
			}

			await root.$jazz.waitForSync()
		}
	}
}
