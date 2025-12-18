/**
 * RelationType JSON Schema Definitions
 * 
 * Defines JSON schemas for RelationTypes (AssignedTo)
 * These schemas are used with ensureSchema() to create SchemaDefinition co-values
 * 
 * RelationTypes define relationships (like Lojban gismu) with x1-x5 position descriptions.
 * Position descriptions are embedded in the JSON Schema properties as `description` fields.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const assignedToRelationTypeSchema: any = {
	type: 'object',
	properties: {
		x1: { 
			type: 'o-map',
			description: 'The Todo being assigned'  // Description in JSON Schema
		},
		x2: { 
			type: 'o-map',
			description: 'The Human assigned to'  // Description in JSON Schema
		},
		x3: { 
			type: 'o-map',
			description: 'Who assigned this'  // Optional
		},
		x4: { 
			type: 'o-map',
			description: 'Assignment timestamp'  // Optional
		},
		x5: { 
			type: 'o-map',
			description: 'Acceptance timestamp'  // Optional
		},
	},
	required: ['x1', 'x2'], // Only x1 and x2 are required
}



