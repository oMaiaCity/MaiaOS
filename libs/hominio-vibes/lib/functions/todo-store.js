/**
 * Todo Store
 * In-memory Svelte store for todos
 * Resets on page refresh (no persistence)
 */

import { writable } from 'svelte/store';
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
	return new Promise((resolve) => {
		todos.subscribe((data) => {
			resolve([...data]);
		})();
	});
}

/**
 * Add a new todo
 * @param {string} title - Todo title
 * @returns {Promise<Todo>}
 */
export async function addTodo(title) {
	return new Promise((resolve) => {
		todos.subscribe((currentTodos) => {
			const newTodo = {
				id: nanoid(),
				title: title.trim(),
				completed: false
			};
			const updatedTodos = [...currentTodos, newTodo];
			todos.set(updatedTodos);
			resolve(newTodo);
		})();
	});
}

/**
 * Toggle todo completion status
 * @param {string} id - Todo ID
 * @returns {Promise<Todo | null>}
 */
export async function toggleTodo(id) {
	return new Promise((resolve) => {
		todos.subscribe((currentTodos) => {
			const updatedTodos = currentTodos.map(todo => 
				todo.id === id ? { ...todo, completed: !todo.completed } : todo
			);
			todos.set(updatedTodos);
			const updatedTodo = updatedTodos.find(t => t.id === id);
			resolve(updatedTodo || null);
		})();
	});
}

/**
 * Delete a todo
 * @param {string} id - Todo ID
 * @returns {Promise<boolean>}
 */
export async function deleteTodo(id) {
	return new Promise((resolve) => {
		todos.subscribe((currentTodos) => {
			const updatedTodos = currentTodos.filter(todo => todo.id !== id);
			todos.set(updatedTodos);
			resolve(true);
		})();
	});
}


