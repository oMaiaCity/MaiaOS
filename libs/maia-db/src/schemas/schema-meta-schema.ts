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
			type: 'o-map',
			description: 'Reference to meta-schema (SchemaDefinition references itself)',
		},
		type: {
			type: 'string',
			enum: ['Entity', 'Relation', 'Leaf', 'Composite'],
			description: 'Content type of the schema (e.g., "Entity" for EntityTypes, "Relation" for RelationTypes, "Leaf" for LeafTypes, "Composite" for CompositeTypes)',
		},
		name: {
			type: 'string',
			description: 'Name of the schema (e.g., "Car", "Human", "Todo", "AssignedTo")',
		},
		definition: {
			type: 'object',
			description: 'JSON Schema definition object (for Relations, x1-x5 are defined here as properties with descriptions)',
			additionalProperties: true,
		},
	},
	required: ['name', 'definition'],
}

