/**
 * Todo Skills - Independent skill functions for todo operations
 * Each skill is self-contained and can be called independently
 * Future-ready for LLM skill calls
 */

import type { Data } from '../dataStore'
import type { Skill } from './types'

// ========== SKILL IMPLEMENTATIONS ==========

const validateTodoSkill: Skill = {
	metadata: {
		id: '@todo/validateTodo',
		name: 'Validate Todo',
		description: 'Validates that todo text is not empty',
		category: 'todo',
		parameters: {
			type: 'object',
			properties: {
				text: {
					type: 'string',
					description: 'The todo text to validate',
					required: true,
				},
			},
			required: ['text'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.queries and data.view exist
		if (!data.queries) data.queries = {}
		if (!data.view) data.view = {}
		
		const view = data.view as Data
		const text = (payload as { text?: string })?.text || (view.newTodoText as string) || ''
		if (!text.trim()) {
			view.error = 'Todo text cannot be empty'
			// Create new object reference to ensure reactivity
			data.view = { ...view }
			return
		}
		view.error = null
		// Create new object reference to ensure reactivity
		data.view = { ...view }
	},
}

const addTodoSkill: Skill = {
	metadata: {
		id: '@todo/addTodo',
		name: 'Add Todo',
		description: 'Adds a new todo item to the list',
		category: 'todo',
		parameters: {
			type: 'object',
			properties: {
				text: {
					type: 'string',
					description: 'The text content of the todo',
					required: true,
				},
			},
			required: ['text'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.queries and data.view exist
		if (!data.queries) data.queries = {}
		if (!data.view) data.view = {}
		
		const queries = data.queries as Data
		const view = data.view as Data
		
		const text = (payload as { text?: string })?.text || (view.newTodoText as string) || ''
		if (!text.trim()) {
			view.error = 'Todo text cannot be empty'
			return
		}

		// Generate random endDate between now and 7 days
		const now = new Date()
		const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
		const randomTime = now.getTime() + Math.random() * (sevenDaysFromNow.getTime() - now.getTime())
		const endDate = new Date(randomTime)

		// Generate random duration between 1 and 8 hours (in minutes)
		const duration = Math.floor(Math.random() * 8 * 60) + 60 // 60 to 480 minutes

		const newTodo = {
			id: Date.now().toString(),
			text: text.trim(),
			status: 'todo',
			endDate: endDate.toISOString(),
			duration: duration, // duration in minutes
		}

		if (!queries.todos) queries.todos = []
		const todos = (queries.todos as Array<unknown>) || []
		queries.todos = [...todos, newTodo]
		view.error = null
		// Create new object references to ensure reactivity
		data.queries = { ...queries }
		data.view = { ...view }
	},
}

const toggleTodoSkill: Skill = {
	metadata: {
		id: '@todo/toggleTodo',
		name: 'Toggle Todo',
		description: 'Toggles the completion status of a todo item (todo <-> done)',
		category: 'todo',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'The ID of the todo to toggle',
					required: true,
				},
			},
			required: ['id'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.queries exists
		if (!data.queries) data.queries = {}
		
		const queries = data.queries as Data
		const id = (payload as { id?: string })?.id
		if (!id) return

		if (!queries.todos) queries.todos = []
		const todos = (queries.todos as Array<{ id: string; status?: string }>) || []
		// Create a new array with updated todo to ensure reactivity
		queries.todos = todos.map((todo) => {
			if (todo.id === id) {
				const currentStatus = todo.status || 'todo'
				const newStatus = currentStatus === 'done' ? 'todo' : 'done'
				// Create a completely new object to ensure Svelte detects the change
				return { ...todo, status: newStatus }
			}
			// Return existing todo as-is
			return todo
		})
		// Force a new array reference to ensure reactivity
		queries.todos = [...(queries.todos as Array<unknown>)]
		// Create new object reference to ensure reactivity
		data.queries = { ...queries }
	},
}

const updateTodoStatusSkill: Skill = {
	metadata: {
		id: '@todo/updateStatus',
		name: 'Update Todo Status',
		description: 'Updates the status of a todo item (todo, in-progress, done)',
		category: 'todo',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'The ID of the todo to update',
					required: true,
				},
				status: {
					type: 'string',
					description: 'The new status (todo, in-progress, done)',
					required: true,
				},
			},
			required: ['id', 'status'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.queries exists
		if (!data.queries) data.queries = {}
		
		const queries = data.queries as Data
		const { id, status } = (payload as { id?: string; status?: string }) || {}
		if (!id || !status) return

		if (!queries.todos) queries.todos = []
		const todos = (queries.todos as Array<{ id: string; status?: string }>) || []
		queries.todos = todos.map((todo) => (todo.id === id ? { ...todo, status } : todo))
		// Create new object reference to ensure reactivity
		data.queries = { ...queries }
	},
}

const removeTodoSkill: Skill = {
	metadata: {
		id: '@todo/removeTodo',
		name: 'Remove Todo',
		description: 'Removes a todo item from the list',
		category: 'todo',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'The ID of the todo to remove',
					required: true,
				},
			},
			required: ['id'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.queries exists
		if (!data.queries) data.queries = {}
		
		const queries = data.queries as Data
		const id = (payload as { id?: string })?.id
		if (!id) return

		if (!queries.todos) queries.todos = []
		const todos = (queries.todos as Array<{ id: string }>) || []
		queries.todos = todos.filter((todo) => todo.id !== id)
	},
}

const updateInputSkill: Skill = {
	metadata: {
		id: '@ui/updateInput',
		name: 'Update Input',
		description: 'Updates the input field value',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				text: {
					type: 'string',
					description: 'The new input text value',
					required: true,
				},
			},
			required: ['text'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.view exists
		if (!data.view) data.view = {}
		
		const text = (payload as { text?: string })?.text
		if (text !== undefined) {
			// Create new view object with updated text
			data.view = {
				...(data.view as Data),
				newTodoText: text,
			}
		}
	},
}

const clearInputSkill: Skill = {
	metadata: {
		id: '@ui/clearInput',
		name: 'Clear Input',
		description: 'Clears the input field',
		category: 'ui',
	},
	execute: (data: Data) => {
		// Ensure data.view exists and create new reference
		if (!data.view) {
			data.view = { newTodoText: '' }
		} else {
			// Create new view object with cleared input
			data.view = {
				...(data.view as Data),
				newTodoText: '',
			}
		}
	},
}

const setViewSkill: Skill = {
	metadata: {
		id: '@ui/setView',
		name: 'Set View',
		description: 'Sets the view mode (list, kanban, timeline, config)',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				viewMode: {
					type: 'string',
					description: 'The view mode to set (list, kanban, timeline, config)',
					required: true,
				},
			},
			required: ['viewMode'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.view exists
		if (!data.view) data.view = {}
		
		const view = data.view as Data
		const viewMode = (payload as { viewMode?: string })?.viewMode
		if (viewMode && ['list', 'kanban', 'timeline'].includes(viewMode)) {
			view.viewMode = viewMode
			// Create new object reference to ensure reactivity
			data.view = { ...view }
		}
	},
}

const clearTodosSkill: Skill = {
	metadata: {
		id: '@todo/clearTodos',
		name: 'Clear Todos',
		description: 'Clears all todos from the list',
		category: 'todo',
	},
	execute: (data: Data) => {
		// Ensure data.queries exists
		if (!data.queries) data.queries = {}
		
		const queries = data.queries as Data
		queries.todos = []
		// Create new object reference to ensure reactivity
		data.queries = { ...queries }
	},
}

const openModalSkill: Skill = {
	metadata: {
		id: '@ui/openModal',
		name: 'Open Modal',
		description: 'Opens a modal with the selected todo details',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'The ID of the todo to display in the modal',
					required: true,
				},
			},
			required: ['id'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.queries and data.view exist
		if (!data.queries) data.queries = {}
		if (!data.view) data.view = {}
		
		const queries = data.queries as Data
		const view = data.view as Data
		const id = (payload as { id?: string })?.id
		if (!id) return

		if (!queries.todos) queries.todos = []
		const todos = (queries.todos as Array<{ id: string }>) || []
		const todo = todos.find((t) => t.id === id)
		if (todo) {
			view.selectedTodo = todo
			view.showModal = true
		}
	},
}

const closeModalSkill: Skill = {
	metadata: {
		id: '@ui/closeModal',
		name: 'Close Modal',
		description: 'Closes the modal',
		category: 'ui',
	},
	execute: (data: Data) => {
		// Ensure data.view exists
		if (!data.view) data.view = {}
		
		const view = data.view as Data
		view.showModal = false
		view.selectedTodo = null
		// Create new object reference to ensure reactivity
		data.view = { ...view }
	},
}

// ========== SKILL EXPORTS ==========

/**
 * All todo-related skills
 * Using npm-style scoped names: @scope/skillName
 */
export const todoSkills: Record<string, Skill> = {
	'@todo/validateTodo': validateTodoSkill,
	'@todo/addTodo': addTodoSkill,
	'@todo/toggleTodo': toggleTodoSkill,
	'@todo/updateStatus': updateTodoStatusSkill,
	'@todo/removeTodo': removeTodoSkill,
	'@todo/clearTodos': clearTodosSkill,
	'@ui/updateInput': updateInputSkill,
	'@ui/clearInput': clearInputSkill,
	'@ui/setView': setViewSkill,
	'@ui/openModal': openModalSkill,
	'@ui/closeModal': closeModalSkill,
}
