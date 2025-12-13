/**
 * Composite Manager
 * 
 * Functions for creating Composite Entity instances
 * Composites are Entity co-values that reference their CompositeType SchemaDefinition via @schema
 * and have relations that reference Leaf/Composite Entities via CoRefs
 */

import { co } from 'jazz-tools'
import { ensureSchema } from '../../functions/dynamic-schema-migration.js'
import { jsonSchemaToCoMapShape } from '../../functions/dynamic-schema-migration.js'
import { addLabelToSchema } from '../../functions/dynamic-schema-migration.js'
import { setSystemProps } from '../../functions/set-system-props.js'
import { assignedToCompositeTypeSchema } from '../../schemas/data/composite-types.js'

/**
 * Creates an ASSIGNED_TO Composite Entity instance
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

	// Add @label and @schema to Composite schema before creating CoMap
	// assignedToCompositeTypeSchema already defines x1-x5 directly (flattened structure)
	const compositeSchemaWithSystemProps = addLabelToSchema(assignedToCompositeTypeSchema)
	const compositeShape = jsonSchemaToCoMapShape(compositeSchemaWithSystemProps)
	const CompositeCoMap = co.map(compositeShape)

	// Create Composite Entity with x1-x5 directly (flattened structure)
	const composite = CompositeCoMap.create(
		{
			x1: relation.x1,
			x2: relation.x2,
			x3: relation.x3,
			x4: relation.x4,
			x5: relation.x5,
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

