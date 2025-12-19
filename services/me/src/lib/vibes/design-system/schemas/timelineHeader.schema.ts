/**
 * Timeline Header Schema Definition
 * Reusable header component with parameterized text
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const timelineHeaderSchemaDefinition: any = {
	type: 'Leaf',
	name: 'design-system.timelineHeader',
	definition: {
		tag: 'div',
		classes: 'text-sm font-semibold text-slate-700 mb-2 px-2 flex-shrink-0',
		elements: ['{{text}}'],
	},
	parameterSchema: {
		type: 'object',
		properties: {
			text: {
				type: 'string',
				description: 'Header text content',
				default: 'Timeline View',
			},
		},
		required: [],
		additionalProperties: false,
	},
}

