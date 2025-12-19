/**
 * Title Schema Definition
 * Reusable title component with parameterized text binding
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const titleSchemaDefinition: any = {
	type: 'Leaf',
	name: 'design-system.title',
	definition: {
		tag: 'div',
		classes: 'text-center mb-2 @xs:mb-2 @sm:mb-2 @md:mb-3 flex flex-col @sm:flex-row items-center justify-center gap-2 @xs:gap-2 @sm:gap-3',
		elements: [
			{
				tag: 'h1',
				classes: 'text-xs @xs:text-sm @sm:text-lg @md:text-xl @lg:text-2xl @xl:text-3xl font-bold text-slate-900 mb-0 @sm:mb-0',
				bindings: { text: '{{text}}' },
			},
		],
	},
	parameterSchema: {
		type: 'object',
		properties: {
			text: {
				type: 'string',
				description: 'Data path to title text (e.g., "data.queries.title")',
				default: 'data.queries.title',
			},
		},
		required: ['text'],
		additionalProperties: false,
	},
}

