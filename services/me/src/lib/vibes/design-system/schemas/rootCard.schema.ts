/**
 * Root Card Composite Schema Definition
 * Reusable root card container with responsive padding/margin
 * Note: Children are passed from the instance, not from parameters
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rootCardSchemaDefinition: any = {
	type: 'Composite',
	name: 'design-system.rootCard',
	definition: {
		container: {
			layout: 'grid', // Will be replaced by parameter
			class: 'max-w-6xl mx-auto grid-cols-1 p-2 @xs:p-3 @sm:p-4 @md:p-6', // Will be replaced by parameter
		},
		children: [
			{
				slot: 'cardContainer',
				composite: {
					container: {
						layout: 'grid', // Will be replaced by parameter
						class: 'card p-2 @xs:p-3 @sm:p-4 @md:p-6 grid-cols-1 grid-rows-[auto_auto_1fr]', // Will be replaced by parameter
					},
					children: [], // Will be populated from instance children
				},
			},
		],
	},
	parameterSchema: {
		type: 'object',
		properties: {
			cardLayout: {
				type: 'string',
				enum: ['grid', 'flex'],
				description: 'Layout type for card container',
				default: 'grid',
			},
			cardClasses: {
				type: 'string',
				description: 'Additional classes for card container',
				default: '',
			},
		},
		required: [],
		additionalProperties: false,
	},
}

