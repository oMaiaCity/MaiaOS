/**
 * Todo Vibe State Machine Configuration
 * Defines all states, transitions, and initial data
 */

import type { StateMachineConfig } from '../../compositor/dataStore'
import { defaultKanbanColumns } from './leafs/kanbanColumn'

// Initialize kanban column IDs from column definitions
const initialKanbanColumnIds: Record<string, string> = {}
for (const column of defaultKanbanColumns) {
	initialKanbanColumnIds[column.key] = `todo.leaf.kanbanColumn.${column.key}.expanded`
}

export const todoStateMachine: StateMachineConfig = {
	initial: 'idle',
	// Split data into queries (database/user data) and view (app/view state)
	data: {
		queries: {
			title: 'Todos',
			todos: [], // Empty array - populated by Jazz when account is available
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
				CREATE_HUMAN: {
					target: 'idle',
					actions: ['@entity/createEntity'],
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
	actions: {},
}
