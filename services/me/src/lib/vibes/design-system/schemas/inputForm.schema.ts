/**
 * Input Form Composite Schema Definition
 * Reusable form component with parameterized value path and submit event
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const inputFormSchemaDefinition: any = {
	type: 'Composite',
	name: 'design-system.inputForm',
	definition: {
		container: {
			layout: 'flex',
			tag: 'form',
			class: 'mb-1 @xs:mb-2 @sm:mb-3 @md:mb-4 flex flex-col @sm:flex-row gap-1 @xs:gap-1.5 @sm:gap-2 items-stretch @sm:items-center',
		},
		events: {
			submit: {
				event: '{{submitEvent}}',
				payload: '{{submitPayload}}',
			},
		},
		children: [
			{
				slot: 'input',
				leaf: {
					tag: 'input',
					attributes: {
						type: 'text',
						name: '{{inputName}}',
						placeholder: '{{placeholder}}',
						autocomplete: 'off',
					},
					classes: 'flex-1 px-2 py-1 @xs:px-3 @xs:py-1.5 @sm:px-4 @sm:py-2 rounded-xl @sm:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-1 @sm:focus:ring-2 focus:ring-slate-500 focus:border-slate-300 transition-all text-[10px] @xs:text-xs @sm:text-sm @md:text-base text-slate-900 placeholder:text-slate-400',
					bindings: { value: '{{valuePath}}' },
					events: {
						input: {
							event: '{{inputEvent}}',
						},
					},
				},
			},
			{
				slot: 'button',
				leaf: {
					tag: 'button',
					attributes: { type: 'submit' },
					classes: 'px-2 py-1 @xs:px-3 @xs:py-1.5 @sm:px-4 @sm:py-2 bg-[#001a42] border border-[#001a42] text-[#e6ecf7] rounded-full shadow-button-primary hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-[10px] @xs:text-xs @sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed shrink-0',
					bindings: {
						visible: '{{buttonVisible}}',
						disabled: '{{buttonDisabled}}',
					},
					elements: ['{{buttonText}}'],
				},
			},
		],
	},
	parameterSchema: {
		type: 'object',
		properties: {
			valuePath: {
				type: 'string',
				description: 'Data path for input value',
			},
			inputEvent: {
				type: 'string',
				description: 'Event name to trigger on input',
				default: 'UPDATE_INPUT',
			},
			submitEvent: {
				type: 'string',
				description: 'Event name to trigger on submit',
			},
			submitPayload: {
				type: 'string',
				description: 'Additional payload data path or object',
			},
			inputName: {
				type: 'string',
				description: 'Input name attribute',
				default: 'new-input',
			},
			placeholder: {
				type: 'string',
				description: 'Input placeholder text',
				default: 'Enter text...',
			},
			buttonText: {
				type: 'string',
				description: 'Submit button text',
				default: 'Add',
			},
			buttonVisible: {
				type: 'string',
				description: 'Data path for button visibility',
				default: 'true',
			},
			buttonDisabled: {
				type: 'string',
				description: 'Data path or expression for button disabled state',
			},
		},
		required: ['valuePath', 'submitEvent'],
		additionalProperties: false,
	},
}

