/**
 * Composite Manager
 * 
 * Functions for creating Composite Entity instances
 * Composites are Entity co-values that reference their CompositeType SchemaDefinition via @schema
 * and have bindings that reference Leaf Entities via CoRefs
 */

import { co } from 'jazz-tools'
import { ensureSchema } from '../../functions/dynamic-schema-migration.js'
import { jsonSchemaToCoMapShape } from '../../functions/dynamic-schema-migration.js'
import { setSystemProps } from '../../functions/set-system-props.js'
import { assignedToCompositeTypeSchema } from '../../schemas/data/composite-types.js'

/**
 * Creates an ASSIGNED_TO Composite Entity instance
 * 
 * @param account - The Jazz account
 * @param bindings - Composite bindings (x1: Todo Leaf, x2: Human Leaf, x3-x5: optional)
 * @returns The created ASSIGNED_TO Composite Entity co-value
 */
export async function createAssignedToComposite(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	bindings: {
		x1: any // CoRef to Todo Leaf Entity
		x2: any // CoRef to Human Leaf Entity
		x3?: any // CoRef to Human Leaf Entity (who assigned, optional)
		x4?: any // CoRef to Date Leaf Entity (when assigned, optional)
		x5?: any // CoRef to Date Leaf Entity (when accepted, optional)
	},
): Promise<any> {
	console.log('[createAssignedToComposite] Creating ASSIGNED_TO Composite...')

	// Ensure ASSIGNED_TO CompositeType schema exists
	const assignedToType = await ensureSchema(account, 'ASSIGNED_TO', assignedToCompositeTypeSchema)

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

	// Define Composite JSON Schema (bindings is an o-map with x1-x5 as o-map references)
	const compositeSchema = {
		type: 'object',
		properties: {
			bindings: {
				type: 'o-map',
				properties: {
					x1: { type: 'o-map' }, // CoRef to Leaf Entity
					x2: { type: 'o-map' }, // CoRef to Leaf Entity
					x3: { type: 'o-map', optional: true },
					x4: { type: 'o-map', optional: true },
					x5: { type: 'o-map', optional: true },
				},
			},
		},
		required: ['bindings'],
	}

	// Get Composite CoMap schema dynamically
	const compositeShape = jsonSchemaToCoMapShape(compositeSchema)
	const CompositeCoMap = co.map(compositeShape)

	// Create Composite Entity with bindings
	const composite = CompositeCoMap.create(
		{
			bindings: {
				x1: bindings.x1,
				x2: bindings.x2,
				x3: bindings.x3,
				x4: bindings.x4,
				x5: bindings.x5,
			},
		},
		entitiesOwner,
	)
	await composite.$jazz.waitForSync()

	// Set system properties - Composite references ASSIGNED_TO CompositeType SchemaDefinition
	await setSystemProps(composite, assignedToType)

	// Add Composite to root.entities list
	entitiesList.$jazz.push(composite)
	await root.$jazz.waitForSync()

	console.log('[createAssignedToComposite] ASSIGNED_TO Composite created, ID:', composite.$jazz.id)
	return composite
}

