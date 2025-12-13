/**
 * LeafType JSON Schema Definitions
 * 
 * Defines JSON schemas for LeafTypes (Human and Todo)
 * These schemas are used with ensureSchema() to create SchemaDefinition co-values
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const humanLeafTypeSchema: any = {
	type: 'object',
	properties: {
		type: { type: 'string', required: true }, // "Leaf" for LeafTypes
		name: { type: 'string', required: true },
		email: { type: 'string' },
		dateOfBirth: { type: 'date' },
	},
	required: ['type', 'name'],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const todoLeafTypeSchema: any = {
	type: 'object',
	properties: {
		type: { type: 'string', required: true }, // "Leaf" for LeafTypes
		name: { type: 'string', required: true },
		description: { type: 'string' },
		priority: {
			type: 'string',
			enum: ['low', 'medium', 'high', 'urgent'],
		},
		status: {
			type: 'string',
			enum: ['todo', 'in_progress', 'done', 'blocked'],
		},
		dueDate: { type: 'date' },
		completedAt: { type: 'date' },
	},
	required: ['type', 'name'],
}

