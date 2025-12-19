/**
 * View Buttons Composite Schema Definition
 * Reusable view toggle buttons with parameterized view mode path and event
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const viewButtonsSchemaDefinition: any = {
	type: 'Composite',
	name: 'design-system.viewButtons',
	definition: {
		container: {
			layout: 'flex',
			class: 'w-full pb-2 flex flex-row justify-center items-center gap-1 @xs:gap-2 @sm:gap-3 flex-nowrap',
		},
		children: [
			{
				slot: 'listActive',
				leaf: {
					tag: 'button',
					attributes: { type: 'button' },
					classes: '{{activeButtonClasses}}',
					bindings: {
						visible: "{{viewModePath}} === 'list'",
					},
					events: {
						click: {
							event: '{{setViewEvent}}',
							payload: { viewMode: 'list' },
						},
					},
					elements: ['List'],
				},
			},
			{
				slot: 'listInactive',
				leaf: {
					tag: 'button',
					attributes: { type: 'button' },
					classes: '{{inactiveButtonClasses}}',
					bindings: {
						visible: "{{viewModePath}} !== 'list'",
					},
					events: {
						click: {
							event: '{{setViewEvent}}',
							payload: { viewMode: 'list' },
						},
					},
					elements: ['List'],
				},
			},
			{
				slot: 'kanbanActive',
				leaf: {
					tag: 'button',
					attributes: { type: 'button' },
					classes: '{{activeButtonClasses}}',
					bindings: {
						visible: "{{viewModePath}} === 'kanban'",
					},
					events: {
						click: {
							event: '{{setViewEvent}}',
							payload: { viewMode: 'kanban' },
						},
					},
					elements: ['Kanban'],
				},
			},
			{
				slot: 'kanbanInactive',
				leaf: {
					tag: 'button',
					attributes: { type: 'button' },
					classes: '{{inactiveButtonClasses}}',
					bindings: {
						visible: "{{viewModePath}} !== 'kanban'",
					},
					events: {
						click: {
							event: '{{setViewEvent}}',
							payload: { viewMode: 'kanban' },
						},
					},
					elements: ['Kanban'],
				},
			},
			{
				slot: 'timelineActive',
				leaf: {
					tag: 'button',
					attributes: { type: 'button' },
					classes: '{{activeButtonClasses}}',
					bindings: {
						visible: "{{viewModePath}} === 'timeline'",
					},
					events: {
						click: {
							event: '{{setViewEvent}}',
							payload: { viewMode: 'timeline' },
						},
					},
					elements: ['Timeline'],
				},
			},
			{
				slot: 'timelineInactive',
				leaf: {
					tag: 'button',
					attributes: { type: 'button' },
					classes: '{{inactiveButtonClasses}}',
					bindings: {
						visible: "{{viewModePath}} !== 'timeline'",
					},
					events: {
						click: {
							event: '{{setViewEvent}}',
							payload: { viewMode: 'timeline' },
						},
					},
					elements: ['Timeline'],
				},
			},
		],
	},
	parameterSchema: {
		type: 'object',
		properties: {
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
			activeButtonClasses: {
				type: 'string',
				description: 'CSS classes for active button state',
				default: 'px-1.5 py-0.5 @xs:px-2 @xs:py-1 @sm:px-3 @sm:py-1.5 @md:px-4 @md:py-2 rounded-full border border-[#001a42] bg-[#001a42] text-[#e6ecf7] transition-all duration-300 font-medium text-[10px] @xs:text-xs @sm:text-sm shadow-sm',
			},
			inactiveButtonClasses: {
				type: 'string',
				description: 'CSS classes for inactive button state',
				default: 'px-1.5 py-0.5 @xs:px-2 @xs:py-1 @sm:px-3 @sm:py-1.5 @md:px-4 @md:py-2 rounded-full border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all duration-300 font-medium text-[10px] @xs:text-xs @sm:text-sm',
			},
		},
		required: [],
		additionalProperties: false,
	},
}

