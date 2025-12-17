/**
 * Todo Vibe State Machine Configuration
 * Defines all states, transitions, and initial data
 */

import type { Data, StateMachineConfig } from '../../compositor/dataStore'
import { defaultKanbanColumns } from './composites/kanbanColumn'

// Initialize kanban column IDs from column definitions
const initialKanbanColumnIds: Record<string, string> = {}
for (const column of defaultKanbanColumns) {
	initialKanbanColumnIds[column.key] = `todo.composite.kanbanColumn.${column.key}.expanded`
}

export const todoStateMachine: StateMachineConfig = {
	initial: 'idle',
	// Split data into queries (database/user data) and view (app/view state)
	data: {
		queries: {
			title: 'Todos', // non-query property
			todos: {
				schemaName: 'Todo',
			},
		},
		view: {
			newTodoText: '',
			isLoading: false,
			error: null,
			viewMode: 'list', // "list" | "kanban" | "timeline" - used for button active/inactive states
			contentCompositeId: 'todo.composite.content.list', // ID of the active content composite
			kanbanColumnIds: initialKanbanColumnIds, // IDs of active kanban column leaf configs (expanded/collapsed)
			kanbanColumns: defaultKanbanColumns, // Column definitions for dynamic generation
			showModal: false,
			selectedTodo: null,
			configJson: '', // Will be populated by Vibe.svelte to avoid circular dependency
		},
	},
	states: {
		idle: {
			on: {
				ADD_TODO: {
					target: 'idle',
					actions: ['@entity/validateInput', '@entity/createEntity'],
				},
				TOGGLE_TODO: {
					target: 'idle',
					actions: ['@entity/toggleStatus'],
				},
				REMOVE_TODO: {
					target: 'idle',
					actions: ['@entity/deleteEntity'],
				},
				UPDATE_INPUT: {
					target: 'idle',
					actions: ['@ui/updateInput'],
				},
				UPDATE_TODO_STATUS: {
					target: 'idle',
					actions: ['@entity/updateEntity'],
				},
				UPDATE_TODO_TEXT: {
					target: 'idle',
					actions: ['@entity/updateEntity'],
				},
				SET_VIEW: {
					target: 'idle',
					actions: ['@ui/setView'],
				},
				CLEAR_TODOS: {
					target: 'idle',
					actions: ['@entity/clearEntities'],
				},
				OPEN_MODAL: {
					target: 'idle',
					actions: ['@ui/openModal'],
				},
				CLOSE_MODAL: {
					target: 'idle',
					actions: ['@ui/closeModal'],
				},
				SWAP_VIEW_NODE: {
					target: 'idle',
					actions: ['@ui/swapViewNode'],
				},
			},
		},
		adding: {
			on: {
				SUCCESS: 'idle',
				ERROR: 'error',
				ADD_TODO: 'adding', // Ignore duplicate ADD_TODO events (can happen on double-click)
				UPDATE_INPUT: {
					target: 'adding',
					actions: ['@ui/updateInput'],
				},
			},
		},
		error: {
			on: {
				RETRY: 'idle',
				CLEAR_ERROR: 'idle',
			},
		},
	},
	actions: {
		// Wrapper actions for schema-specific logic (Todo)
		// These wrap generic entity skills with Todo-specific data transformation
		'@entity/createEntity': async (data: Data, payload?: unknown) => {
			const payloadData = payload as {
				schemaName?: string
				entityData?: Record<string, unknown>
				name?: string
			} || {}

			const schemaName = payloadData.schemaName || 'Todo'
			
			// Build entityData based on schema
			let entityData: Record<string, unknown> = payloadData.entityData || {}

			if (schemaName === 'Todo') {
				// Todo-specific: Extract name from view.newTodoText if not provided
				let name = payloadData.name
				if (!name && data.view) {
					name = (data.view as any).newTodoText as string || ''
				}

				if (!name || !name.trim()) {
					if (!data.view) data.view = {}
					const view = data.view as Data
					view.error = 'Todo name cannot be empty'
					data.view = { ...view }
					return
				}

				// Generate random endDate between now and 7 days
				const now = new Date()
				const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
				const randomTime = now.getTime() + Math.random() * (sevenDaysFromNow.getTime() - now.getTime())
				const endDate = new Date(randomTime)

				// Generate random duration between 1 and 8 hours (in minutes)
				const duration = Math.floor(Math.random() * 8 * 60) + 60

				entityData = {
					name: name.trim(),
					status: 'todo',
					endDate: endDate.toISOString(),
					duration,
				}

				// Clear input after successful creation
				if (!data.view) data.view = {}
				const view = data.view as Data
				view.newTodoText = ''
				view.error = null
				data.view = { ...view }
			}

			// Call the generic skill with built entityData
			const { entitySkills } = await import('../../compositor/skills/entity-skills.js')
			const createEntitySkill = entitySkills['@entity/createEntity']
			if (createEntitySkill) {
				await createEntitySkill.execute(data, {
					schemaName,
					entityData,
				})
			}
		},
		'@entity/toggleStatus': async (data: Data, payload?: unknown) => {
			const payloadData = payload as {
				id?: string
				statusField?: string
				value1?: string
				value2?: string
			} || {}

			// Todo-specific defaults
			const finalPayload = {
				...payloadData,
				value1: payloadData.value1 || 'todo',
				value2: payloadData.value2 || 'done',
			}

			// Call the generic skill
			const { entitySkills } = await import('../../compositor/skills/entity-skills.js')
			const toggleStatusSkill = entitySkills['@entity/toggleStatus']
			if (toggleStatusSkill) {
				await toggleStatusSkill.execute(data, finalPayload)
			}
		},
	},
}
