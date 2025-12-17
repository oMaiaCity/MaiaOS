/**
 * Input Section Composite Configuration
 * Uses design-system.inputSection schema
 */

import type { CompositeConfig } from '../../../compositor/view/types'

export const inputSectionComposite: CompositeConfig = {
	id: 'todo.composite.inputSection',
	'@schema': 'design-system.inputSection',
	parameters: {
		valuePath: 'data.view.newTodoText',
		inputEvent: 'UPDATE_INPUT',
		submitEvent: 'ADD_TODO',
		submitPayload: JSON.stringify({ schemaName: 'Todo' }),
		inputName: 'new-todo-input',
		placeholder: 'Add a new todo...',
		buttonText: 'Add',
		buttonVisible: 'true',
		buttonDisabled: '!data.view.newTodoText || data.view.newTodoText.trim().length === 0',
		errorVisible: 'data.view.error',
		errorText: 'data.view.error',
	},
}
