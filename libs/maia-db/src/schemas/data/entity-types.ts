/**
 * EntityType JSON Schema Definitions
 * 
 * Defines JSON schemas for EntityTypes (Human and Todo)
 * These schemas are used with ensureSchema() to create SchemaDefinition co-values
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const humanEntityTypeSchema: any = {
	type: 'object',
	properties: {
		type: { type: 'string', required: true }, // "Entity" for EntityTypes
		name: { type: 'string', required: true },
		email: { type: 'string' },
		dateOfBirth: { type: 'date' },
	},
	required: ['type', 'name'],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const todoEntityTypeSchema: any = {
	type: 'object',
	properties: {
		type: { type: 'string', required: true }, // "Entity" for EntityTypes
		name: { type: 'string', required: true }, // Todo name content (matches UI schema)
		description: { type: 'string' }, // Optional description
		status: { type: 'string' }, // Plain string field (e.g., 'todo', 'in-progress', 'done')
		endDate: { type: 'string' }, // ISO string date (matches UI schema)
		duration: { type: 'number' }, // Duration in minutes (matches UI schema)
	},
	required: ['type', 'name'],
}
