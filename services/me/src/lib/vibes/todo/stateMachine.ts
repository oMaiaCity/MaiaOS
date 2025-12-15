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
			todos: [
				{
					id: '1',
					text: 'Design user authentication flow',
					status: 'todo',
					endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 180,
				},
				{
					id: '2',
					text: 'Write API documentation for endpoints',
					status: 'done',
					endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 90,
				},
				{
					id: '3',
					text: 'Implement dark mode toggle',
					status: 'in-progress',
					endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 120,
				},
				{
					id: '4',
					text: 'Review pull requests from team',
					status: 'todo',
					endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 60,
				},
				{
					id: '5',
					text: 'Set up CI/CD pipeline',
					status: 'done',
					endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 240,
				},
				{
					id: '6',
					text: 'Optimize database queries',
					status: 'in-progress',
					endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 300,
				},
				{
					id: '7',
					text: 'Create onboarding tutorial',
					status: 'todo',
					endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 150,
				},
				{
					id: '8',
					text: 'Fix responsive layout issues',
					status: 'done',
					endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 75,
				},
				{
					id: '9',
					text: 'Plan next sprint features',
					status: 'in-progress',
					endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
					duration: 210,
				},
			],
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
					actions: ['@todo/validateTodo', '@todo/addTodo'],
				},
				TOGGLE_TODO: {
					target: 'idle',
					actions: ['@todo/toggleTodo'],
				},
				REMOVE_TODO: {
					target: 'idle',
					actions: ['@todo/removeTodo'],
				},
				UPDATE_INPUT: {
					target: 'idle',
					actions: ['@ui/updateInput'],
				},
				UPDATE_TODO_STATUS: {
					target: 'idle',
					actions: ['@todo/updateStatus'],
				},
				SET_VIEW: {
					target: 'idle',
					actions: ['@ui/setView'],
				},
				CLEAR_TODOS: {
					target: 'idle',
					actions: ['@todo/clearTodos'],
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
