/**
 * Todo Store
 * In-memory Svelte store for todos
 * Resets on page refresh (no persistence)
 */

import { writable, get } from 'svelte/store';
import { nanoid } from 'nanoid';

/**
 * Todo item structure
 * @typedef {Object} Todo
 * @property {string} id - Unique identifier
 * @property {string} title - Todo title
 * @property {boolean} completed - Completion status
 */

// Seed data (empty array initially)
const SEED_TODOS = [];

/**
 * Todo data store
 * @type {import('svelte/store').Writable<Todo[]>}
 */
export const todos = writable(SEED_TODOS);

/**
 * Todo configuration
 * @type {Object}
 */
export const todoConfig = {};

/**
 * Get all todos
 * @returns {Promise<Todo[]>}
 */
export async function getTodos() {
	// Get todos synchronously using get()
	return Promise.resolve([...get(todos)]);
}

/**
 * Add a new todo
 * @param {string} title - Todo title
 * @returns {Promise<Todo>}
 */
export async function addTodo(title) {
	try {
		// Get current todos synchronously
		const currentTodos = get(todos);
		
		// Create new todo
		const newTodo = {
			id: nanoid(),
			title: title.trim(),
			completed: false
		};
		
		// Update store
		const updatedTodos = [...currentTodos, newTodo];
		todos.set(updatedTodos);
		
		// Return immediately
		return newTodo;
	} catch (error) {
		throw new Error(`Failed to add todo: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Toggle todo completion status
 * @param {string} id - Todo ID
 * @returns {Promise<Todo | null>}
 */
export async function toggleTodo(id) {
	try {
		const currentTodos = get(todos);
		const updatedTodos = currentTodos.map(todo => 
			todo.id === id ? { ...todo, completed: !todo.completed } : todo
		);
		todos.set(updatedTodos);
		const updatedTodo = updatedTodos.find(t => t.id === id);
		return updatedTodo || null;
	} catch (error) {
		throw new Error(`Failed to toggle todo: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Delete a todo
 * @param {string} id - Todo ID
 * @returns {Promise<boolean>}
 */
export async function deleteTodo(id) {
	try {
		const currentTodos = get(todos);
		const updatedTodos = currentTodos.filter(todo => todo.id !== id);
		todos.set(updatedTodos);
		return true;
	} catch (error) {
		throw new Error(`Failed to delete todo: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}


