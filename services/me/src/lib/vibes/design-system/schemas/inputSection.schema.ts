/**
 * Input Section Composite Schema Definition
 * Reusable input section with form and error message
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const inputSectionSchemaDefinition: any = {
	type: 'Composite',
	name: 'design-system.inputSection',
	definition: {
		container: {
			layout: 'content',
			class: ' bg-slate-50 sticky top-0 z-9 h-auto',
		},
		children: [
			{
				slot: 'input.value',
				composite: {
					'@schema': 'design-system.inputForm',
					parameters: {
						valuePath: '{{valuePath}}',
						inputEvent: '{{inputEvent}}',
						submitEvent: '{{submitEvent}}',
						submitPayload: '{{submitPayload}}',
						inputName: '{{inputName}}',
						placeholder: '{{placeholder}}',
						buttonText: '{{buttonText}}',
						buttonVisible: '{{buttonVisible}}',
						buttonDisabled: '{{buttonDisabled}}',
					},
					container: {
						layout: 'flex',
						tag: 'form',
						class: 'h-auto',
					},
				},
			},
			{
				slot: 'error',
				leaf: {
					'@schema': 'design-system.error',
					parameters: {
						visible: '{{errorVisible}}',
						text: '{{errorText}}',
					},
					classes: 'h-auto',
				},
			},
		],
	},
	parameterSchema: {
		type: 'object',
		properties: {
			valuePath: {
				type: 'string',
				description: 'Data path for input value (e.g., "data.view.newTodoText")',
			},
			inputEvent: {
				type: 'string',
				description: 'Event name for input changes (e.g., "UPDATE_INPUT")',
			},
			submitEvent: {
				type: 'string',
				description: 'Event name for form submission (e.g., "ADD_TODO")',
			},
			submitPayload: {
				type: 'string',
				description: 'Payload for submit event (JSON string, e.g., \'{"schemaName": "Todo"}\')',
			},
			inputName: {
				type: 'string',
				description: 'Name attribute for input (e.g., "new-todo-input")',
			},
			placeholder: {
				type: 'string',
				description: 'Placeholder text for input',
			},
			buttonText: {
				type: 'string',
				description: 'Text for submit button',
			},
			buttonVisible: {
				type: 'string',
				description: 'Visibility binding for submit button (e.g., "true")',
			},
			buttonDisabled: {
				type: 'string',
				description: 'Disabled binding for submit button (e.g., "!data.view.newTodoText || data.view.newTodoText.trim().length === 0")',
			},
			errorVisible: {
				type: 'string',
				description: 'Visibility binding for error (e.g., "data.view.error")',
			},
			errorText: {
				type: 'string',
				description: 'Data path for error text (e.g., "data.view.error")',
			},
		},
		required: ['valuePath', 'inputEvent', 'submitEvent', 'submitPayload', 'inputName', 'placeholder', 'buttonText', 'buttonVisible', 'buttonDisabled', 'errorVisible', 'errorText'],
		additionalProperties: false,
	},
}

