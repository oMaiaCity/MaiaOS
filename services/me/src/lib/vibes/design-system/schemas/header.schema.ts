/**
 * Header Composite Schema Definition
 * Reusable header component with title and view buttons
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const headerSchemaDefinition: any = {
	type: 'Composite',
	name: 'design-system.header',
	definition: {
		container: {
			layout: 'content',
			class: 'w-full p-0 bg-transparent sticky top-0 z-10 h-auto',
		},
		children: [
			{
				slot: 'title',
				leaf: {
					'@schema': 'design-system.title',
					parameters: {
						text: '{{titleText}}',
					},
					classes: 'h-auto',
				},
			},
			{
				slot: 'viewButtons',
				composite: {
					'@schema': 'design-system.viewButtons',
					parameters: {
						viewModePath: '{{viewModePath}}',
						setViewEvent: '{{setViewEvent}}',
					},
				},
			},
		],
	},
	parameterSchema: {
		type: 'object',
		properties: {
			titleText: {
				type: 'string',
				description: 'Data path to title text (e.g., "data.queries.title")',
				default: 'data.queries.title',
			},
			viewModePath: {
				type: 'string',
				description: 'Data path to view mode (e.g., "data.view.viewMode")',
				default: 'data.view.viewMode',
			},
			setViewEvent: {
				type: 'string',
				description: 'Event name to trigger on view change',
				default: 'SET_VIEW',
			},
		},
		required: [],
		additionalProperties: false,
	},
}

