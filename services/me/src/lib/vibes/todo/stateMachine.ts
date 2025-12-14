/**
 * Todo Vibe State Machine Configuration
 * Defines all states, transitions, and initial data
 */

import type { StateMachineConfig } from '../../compositor/types'

export const todoStateMachine: StateMachineConfig = {
	initial: 'idle',
	// Unified data - everything is just data, no distinction
	data: {
		title: 'Todos',
		todos: [
			{
				id: '1',
				text: 'Learn Svelte stores',
				status: 'todo',
				endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
				duration: 120,
			},
			{
				id: '2',
				text: 'Build vibe page',
				status: 'done',
				endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
				duration: 180,
			},
			{
				id: '3',
				text: 'Add todo list feature',
				status: 'in-progress',
				endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
				duration: 240,
			},
				{
				id: '4',
				text: 'Learn Svelte stores',
				status: 'todo',
				endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
				duration: 120,
			},
			{
				id: '5',
				text: 'Build vibe page',
				status: 'done',
				endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
				duration: 180,
			},
			{
				id: '6',
				text: 'Add todo list feature',
				status: 'in-progress',
				endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
				duration: 240,
			},	{
				id: '7',
				text: 'Learn Svelte stores',
				status: 'todo',
				endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
				duration: 120,
			},
			{
				id: '8',
				text: 'Build vibe page',
				status: 'done',
				endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
				duration: 180,
			},
			{
				id: '9',
				text: 'Add todo list feature',
				status: 'in-progress',
				endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
				duration: 240,
			},
		],
		newTodoText: '',
		isLoading: false,
		error: null,
		viewMode: 'list', // "list" | "kanban" | "timeline" | "config"
		showModal: false,
		selectedTodo: null,
		configJson: '', // Will be populated by Vibe.svelte to avoid circular dependency
	},
	states: {
		idle: {
			on: {
				ADD_TODO: {
					target: 'idle',
					actions: ['@todo/validateTodo', '@todo/addTodo', '@ui/clearInput'],
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
			},
		},
		adding: {
			entry: ['@ui/clearInput'],
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
