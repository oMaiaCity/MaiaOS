/**
 * CompositeType JSON Schema Definitions
 * 
 * Defines JSON schemas for CompositeTypes (ASSIGNED_TO)
 * These schemas are used with ensureSchema() to create SchemaDefinition co-values
 * 
 * CompositeTypes define relationships (like Lojban gismu) with x1-x5 position descriptions.
 * Each x position is a simple string description of the role that position plays.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const assignedToCompositeTypeSchema: any = {
	type: 'object',
	properties: {
		x1: { type: 'o-map' }, // CoRef to Leaf/Composite Entity
		x2: { type: 'o-map' }, // CoRef to Leaf/Composite Entity
		x3: { type: 'o-map' }, // Optional: CoRef to Leaf/Composite Entity
		x4: { type: 'o-map' }, // Optional: CoRef to Leaf/Composite Entity
		x5: { type: 'o-map' }, // Optional: CoRef to Leaf/Composite Entity
	},
	required: ['x1', 'x2'], // Only x1 and x2 are required
}

