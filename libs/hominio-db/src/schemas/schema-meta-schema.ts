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
			description: 'Name of the schema (e.g., "Car", "JazzComposite")',
		},
		definition: {
			type: 'object',
			description: 'JSON Schema definition object',
			additionalProperties: true,
		},
	},
	required: ['name', 'definition'],
}

