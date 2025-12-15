/**
 * Todo Skills - Independent skill functions for todo operations
 * Each skill is self-contained and can be called independently
 * Future-ready for LLM skill calls
 */

import type { Data } from '../dataStore'
import type { Skill } from './types'
import { createTodoEntity, updateTodoEntity, deleteTodoEntity } from '@hominio/db'

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
	execute: async (data: Data, payload?: unknown) => {
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

		// Check if Jazz is available
		const jazzAccount = data._jazzAccount as any
		if (jazzAccount && jazzAccount.$isLoaded) {
			// Use Jazz to create entity
			try {
				await createTodoEntity(jazzAccount, {
					text: text.trim(),
					status: 'todo',
					endDate: endDate.toISOString(),
					duration,
				})
				// Clear input after successful creation
				view.newTodoText = ''
				view.error = null
				data.view = { ...view }
				// Subscription will update data.queries.todos automatically
			} catch (_error) {
				view.error = 'Failed to create todo'
				data.view = { ...view }
			}
		} else {
			// Fallback to in-memory mode
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
		}
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
	execute: async (data: Data, payload?: unknown) => {
		
		// Ensure data.queries exists
		if (!data.queries) data.queries = {}
		
		const queries = data.queries as Data
		const id = (payload as { id?: string })?.id
		
		
		if (!id) return

		// Check if Jazz is available
		const jazzQueryManager = data._jazzQueryManager as any
		const jazzAccount = data._jazzAccount as any
		if (jazzQueryManager && jazzAccount) {
			// Use Jazz to update entity
			try {
				// Get CoValue from entityMap first (this one was created with the correct shape)
				let coValue = jazzQueryManager.getCoValueById(id)
				
				
				// If not found in cache, try to load it directly from the account/node
				if (!coValue) {
					const node = (jazzAccount as any).$jazz?.raw?.core?.node || (jazzAccount as any).$jazz?.raw?.node
					if (node) {
						const loadedCoValue = await node.load(id as any)
						if (loadedCoValue !== 'unavailable') {
							coValue = loadedCoValue
						}
					}
				}
				
				if (!coValue) {
					throw new Error(`CoValue not found for ID: ${id}`)
				}

				// Ensure CoValue is fully loaded with all properties
				await coValue.$jazz.ensureLoaded({
					resolve: { 
						text: true,
						status: true,
						endDate: true,
						duration: true,
					},
				})


				// Get current status from CoValue (try direct access or snapshot)
				let currentStatus = coValue.status
				if (!currentStatus) {
					try {
						const snapshot = coValue.$jazz?.raw?.toJSON?.() || coValue.toJSON?.()
						if (snapshot && typeof snapshot === 'object') {
							currentStatus = snapshot.status
						}
					} catch (_e) {
						// Fallback to default
					}
				}
				currentStatus = currentStatus || 'todo'
				const newStatus = currentStatus === 'done' ? 'todo' : 'done'
				
				
				// Update using updateTodoEntity
				await updateTodoEntity(coValue, { status: newStatus })
				
				
				// Subscription will update data.queries.todos automatically
			} catch (error) {
				throw error // Re-throw to surface the error
			}
		} else {
			// Fallback to in-memory mode
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
		}
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
	execute: async (data: Data, payload?: unknown) => {
		// Ensure data.queries exists
		if (!data.queries) data.queries = {}
		
		const queries = data.queries as Data
		const { id, status } = (payload as { id?: string; status?: string }) || {}
		if (!id || !status) return

		// Check if Jazz is available
		const jazzQueryManager = data._jazzQueryManager as any
		if (jazzQueryManager) {
			// Use Jazz to update entity
			try {
				const coValue = jazzQueryManager.getCoValueById(id)
				if (coValue) {
					await updateTodoEntity(coValue, { status: status })
					// Subscription will update data.queries.todos automatically
				}
			} catch (_error) {
				// Update failed - silently fail
			}
		} else {
			// Fallback to in-memory mode
			if (!queries.todos) queries.todos = []
			const todos = (queries.todos as Array<{ id: string; status?: string }>) || []
			queries.todos = todos.map((todo) => (todo.id === id ? { ...todo, status } : todo))
			// Create new object reference to ensure reactivity
			data.queries = { ...queries }
		}
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
	execute: async (data: Data, payload?: unknown) => {
		// Ensure data.queries exists
		if (!data.queries) data.queries = {}
		
		const queries = data.queries as Data
		const id = (payload as { id?: string })?.id
		if (!id) return

		// Check if Jazz is available
		const jazzAccount = data._jazzAccount as any
		if (jazzAccount) {
			// Use Jazz to delete entity
			try {
				await deleteTodoEntity(jazzAccount, id)
				// Subscription will update data.queries.todos automatically
			} catch (_error) {
				// Delete failed - silently fail
			}
		} else {
			// Fallback to in-memory mode
			if (!queries.todos) queries.todos = []
			const todos = (queries.todos as Array<{ id: string }>) || []
			queries.todos = todos.filter((todo) => todo.id !== id)
			data.queries = { ...queries }
		}
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

const swapViewNodeSkill: Skill = {
	metadata: {
		id: '@ui/swapViewNode',
		name: 'Swap View Node',
		description: 'Swaps any view node config (composite or leaf) by ID. Generic universal action for config swapping.',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				nodeId: {
					type: 'string',
					description: 'The ID of the view node (composite or leaf) to swap to',
					required: true,
				},
				targetPath: {
					type: 'string',
					description: 'The data path where the node ID should be stored (e.g., "view.contentNodeId")',
					required: true,
				},
				nodeType: {
					type: 'string',
					description: 'Optional type hint: "composite" or "leaf" (auto-detected if omitted)',
					required: false,
				},
			},
			required: ['nodeId', 'targetPath'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		const { nodeId, targetPath, nodeType } = (payload as { nodeId?: string; targetPath?: string; nodeType?: 'composite' | 'leaf' }) || {}
		
		if (!nodeId || !targetPath) return
		
		const pathParts = targetPath.split('.')
		
		// Navigate to the target object
		let target: Data = data
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i]
			if (!target[part]) {
				target[part] = {}
			}
			target = target[part] as Data
		}
		
		// Set the node ID
		const finalKey = pathParts[pathParts.length - 1]
		target[finalKey] = nodeId
		
		// Create new object reference to ensure reactivity
		// Deep copy nested objects to ensure reactivity
		if (data.view) {
			data.view = { ...(data.view as Data) }
		}
	},
}

const setViewSkill: Skill = {
	metadata: {
		id: '@ui/setView',
		name: 'Set View',
		description: 'Sets the view mode and swaps the content composite (list, kanban, timeline)',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				viewMode: {
					type: 'string',
					description: 'The view mode to set (list, kanban, timeline)',
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
		if (!viewMode || !['list', 'kanban', 'timeline'].includes(viewMode)) return
		
		// Map viewMode to composite ID
		const compositeIdMap: Record<string, string> = {
			list: 'todo.composite.content.list',
			kanban: 'todo.composite.content.kanban',
			timeline: 'todo.composite.content.timeline',
		}
		
		const compositeId = compositeIdMap[viewMode]
		if (compositeId) {
			// Use the generic swapViewNode action internally
			swapViewNodeSkill.execute(data, {
				nodeId: compositeId,
				targetPath: 'view.contentCompositeId',
				nodeType: 'composite',
			})
			// Also update viewMode for button visibility
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
	execute: async (data: Data) => {
		// Ensure data.queries exists
		if (!data.queries) data.queries = {}
		
		const queries = data.queries as Data
		
		// Check if Jazz is available
		const jazzQueryManager = data._jazzQueryManager as any
		const jazzAccount = data._jazzAccount as any
		if (jazzQueryManager && jazzAccount) {
			// Use Jazz to delete all todo entities
			try {
				const todos = (queries.todos as Array<{ id?: string }>) || []
				// Delete all todos from Jazz
				for (const todo of todos) {
					if (todo.id) {
						try {
							await deleteTodoEntity(jazzAccount, todo.id)
						} catch (_error) {
							// Delete failed - continue with next todo
						}
					}
				}
				// Subscription will update data.queries.todos automatically
			} catch (_error) {
				// Clear failed - silently fail
			}
		} else {
			// Fallback to in-memory mode
			queries.todos = []
			// Create new object reference to ensure reactivity
			data.queries = { ...queries }
		}
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
	'@ui/swapViewNode': swapViewNodeSkill,
	'@ui/setView': setViewSkill,
	'@ui/openModal': openModalSkill,
	'@ui/closeModal': closeModalSkill,
}
