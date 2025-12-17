/**
 * Error Schema Definition
 * Reusable error message component with parameterized visibility and text bindings
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const errorSchemaDefinition: any = {
	type: 'Leaf',
	name: 'design-system.error',
	definition: {
		tag: 'div',
		classes: 'mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r from-red-50 to-red-100/50 border border-red-200/60 shadow-[0_2px_8px_rgba(239,68,68,0.1)] text-red-800 text-sm flex items-center justify-between gap-3',
		bindings: {
			visible: '{{visible}}',
		},
		children: [
			{
				tag: 'div',
				classes: 'flex items-center gap-2 flex-1',
				children: [
					{
						tag: 'svg',
						attributes: {
							class: 'w-5 h-5 text-red-600 shrink-0',
							fill: 'none',
							viewBox: '0 0 24 24',
							stroke: 'currentColor',
						},
						children: [
							{
								tag: 'path',
								attributes: {
									'stroke-linecap': 'round',
									'stroke-linejoin': 'round',
									'stroke-width': '2',
									d: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
								},
							},
						],
					},
					{
						tag: 'span',
						classes: 'font-medium',
						bindings: { text: '{{text}}' },
					},
				],
			},
		],
	},
	parameterSchema: {
		type: 'object',
		properties: {
			visible: {
				type: 'string',
				description: 'Data path for visibility (e.g., "data.view.error")',
				default: 'data.view.error',
			},
			text: {
				type: 'string',
				description: 'Data path to error message text (e.g., "data.view.error")',
				default: 'data.view.error',
			},
		},
		required: ['visible', 'text'],
		additionalProperties: false,
	},
}

