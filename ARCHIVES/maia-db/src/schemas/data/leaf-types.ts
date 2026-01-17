/**
 * LeafType JSON Schema Definitions
 * 
 * Defines JSON schemas for LeafTypes (design system components)
 * These schemas are registered in the hardcoded schema registry
 * Schema type: "Leaf"
 * 
 * Note: Currently hardcoded, will be migrated to pull from schemata co.list in future iteration
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const titleLeafTypeSchema: any = {
	type: 'object',
	properties: {
		type: { type: 'string', required: true }, // "Leaf" for LeafTypes
		name: { type: 'string', required: true }, // "design-system.title"
		definition: {
			type: 'object',
			description: 'LeafNode structure definition',
			properties: {
				tag: { type: 'string' },
				classes: { type: 'string' },
				bindings: { type: 'object' },
				children: { type: 'array' },
			},
			additionalProperties: true,
		},
		parameterSchema: {
			type: 'object',
			description: 'Full JSON Schema for parameters',
			properties: {
				type: { type: 'string', enum: ['object'] },
				properties: {
					type: 'object',
					properties: {
						text: {
							type: 'string',
							description: 'Data path to title text (e.g., "data.queries.title")',
							default: 'data.queries.title',
						},
					},
				},
				required: { type: 'array', items: { type: 'string' } },
				additionalProperties: { type: 'boolean' },
			},
		},
	},
	required: ['type', 'name', 'definition'],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const errorLeafTypeSchema: any = {
	type: 'object',
	properties: {
		type: { type: 'string', required: true },
		name: { type: 'string', required: true }, // "design-system.error"
		definition: {
			type: 'object',
			description: 'LeafNode structure definition',
			properties: {
				tag: { type: 'string' },
				classes: { type: 'string' },
				bindings: { type: 'object' },
				children: { type: 'array' },
			},
			additionalProperties: true,
		},
		parameterSchema: {
			type: 'object',
			description: 'Full JSON Schema for parameters',
			properties: {
				type: { type: 'string', enum: ['object'] },
				properties: {
					type: 'object',
					properties: {
						visible: {
							type: 'string',
							description: 'Data path for visibility',
							default: 'data.view.error',
						},
						text: {
							type: 'string',
							description: 'Data path to error message text',
							default: 'data.view.error',
						},
					},
				},
				required: { type: 'array', items: { type: 'string' } },
				additionalProperties: { type: 'boolean' },
			},
		},
	},
	required: ['type', 'name', 'definition'],
}

// Export all leaf type schemas
// These schema definitions will be registered via registerJsonSchema() from design-system
// For now, we export an empty object - schemas are registered dynamically
export const leafTypeSchemas: Record<string, any> = {
	// Schemas are registered via registerJsonSchema() calls from design-system
}

