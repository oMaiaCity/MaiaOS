/**
 * Meta-schema: Defines the schema for SchemaDefinition itself
 * This is the schema that describes how schemas are structured
 */

export const SchemaMetaSchema = {
	type: 'object',
	properties: {
		'@label': {
			type: 'string',
			description: 'Computed display label for this schema',
		},
		'@schema': {
			type: 'string',
			description: 'Schema type identifier (e.g., "Schema" for schemas, schema name for entities)',
		},
		type: {
			type: 'string',
			description: 'Content type of the schema (e.g., "Leaf" for LeafTypes, "Composite" for CompositeTypes)',
		},
		name: {
			type: 'string',
			description: 'Name of the schema (e.g., "Car", "Human", "Todo", "ASSIGNED_TO")',
		},
		x1: {
			type: 'string',
			description: 'x1 position description (for CompositeTypes)',
		},
		x2: {
			type: 'string',
			description: 'x2 position description (for CompositeTypes)',
		},
		x3: {
			type: 'string',
			description: 'x3 position description (for CompositeTypes)',
		},
		x4: {
			type: 'string',
			description: 'x4 position description (for CompositeTypes)',
		},
		x5: {
			type: 'string',
			description: 'x5 position description (for CompositeTypes)',
		},
		definition: {
			type: 'object',
			description: 'JSON Schema definition object',
			additionalProperties: true,
		},
	},
	required: ['name', 'definition'],
}

