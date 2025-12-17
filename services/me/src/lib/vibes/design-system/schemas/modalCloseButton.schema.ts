/**
 * Modal Close Button Schema Definition
 * Reusable close button component with parameterized event
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const modalCloseButtonSchemaDefinition: any = {
	type: 'Leaf',
	name: 'design-system.modalCloseButton',
	definition: {
		tag: 'button',
		attributes: { type: 'button' },
		classes: 'absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all z-10',
		events: {
			click: {
				event: '{{event}}',
			},
		},
		children: [
			{
				tag: 'icon',
				icon: {
					name: 'mingcute:close-line',
					classes: 'w-5 h-5 text-slate-600',
				},
			},
		],
	},
	parameterSchema: {
		type: 'object',
		properties: {
			event: {
				type: 'string',
				description: 'Event name to trigger on click (e.g., "CLOSE_MODAL")',
				default: 'CLOSE_MODAL',
			},
		},
		required: [],
		additionalProperties: false,
	},
}

