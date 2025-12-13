/**
 * CompositeType JSON Schema Definitions
 * 
 * Defines JSON schemas for CompositeTypes (ASSIGNED_TO)
 * These schemas are used with ensureSchema() to create SchemaDefinition co-values
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const assignedToCompositeTypeSchema: any = {
	type: 'object',
	properties: {
		name: { type: 'string', required: true },
		definition: { type: 'string' },
		relation: {
			type: 'object',
			properties: {
				x1: {
					type: 'object',
					properties: {
						leafTypes: { type: 'array', items: { type: 'string' } },
						required: { type: 'boolean' },
						description: { type: 'string' },
					},
					description: 'x1 position definition (passthrough object)',
				},
				x2: {
					type: 'object',
					properties: {
						leafTypes: { type: 'array', items: { type: 'string' } },
						required: { type: 'boolean' },
						description: { type: 'string' },
					},
					description: 'x2 position definition (passthrough object)',
				},
				x3: {
					type: 'object',
					properties: {
						leafTypes: { type: 'array', items: { type: 'string' } },
						required: { type: 'boolean' },
						description: { type: 'string' },
					},
					description: 'x3 position definition (passthrough object)',
				},
				x4: {
					type: 'object',
					properties: {
						leafTypes: { type: 'array', items: { type: 'string' } },
						required: { type: 'boolean' },
						description: { type: 'string' },
					},
					description: 'x4 position definition (passthrough object)',
				},
				x5: {
					type: 'object',
					properties: {
						leafTypes: { type: 'array', items: { type: 'string' } },
						required: { type: 'boolean' },
						description: { type: 'string' },
					},
					description: 'x5 position definition (passthrough object)',
				},
			},
			description: 'Relation structure with x1-x5 positions (passthrough object)',
		},
	},
	required: ['name', 'relation'],
}

