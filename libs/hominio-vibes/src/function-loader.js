/**
 * Function Loader
 * Dynamically loads function implementations by ID
 * Browser-compatible: Uses relative imports from package root
 */

// Import all functions statically - use relative path from this file
// Vite will resolve these correctly when the package is imported
import * as queryTodosModule from '../lib/functions/query-todos.js';
import * as createTodoModule from '../lib/functions/create-todo.js';

// Import UI components from @hominio/brand (pure views)
import { TodoView } from '@hominio/brand/views';

const functionModules = {
	'query-todos': queryTodosModule,
	'create-todo': createTodoModule
};

/**
 * Load function implementation by ID
 * @param {string} functionId - Function ID (e.g., 'show-menu')
 * @returns {Promise<import('./types.ts').FunctionHandler>}
 */
export async function loadFunction(functionId) {
	try {
		const module = functionModules[functionId];
		
		if (!module) {
			throw new Error(`Function not found: ${functionId}`);
		}
		
		// Validate required exports
		if (!module.handler || typeof module.handler !== 'function') {
			throw new Error(`Function ${functionId} missing handler export`);
		}
		
		// For todo functions, use TodoView component from @hominio/brand
		const uiComponentLoader = (functionId === 'query-todos' || functionId === 'create-todo')
			? () => Promise.resolve({ default: TodoView })
			: () => Promise.resolve({ default: null });
		
		return {
			handler: module.handler,
			uiComponent: uiComponentLoader
		};
	} catch (error) {
		throw new Error(`Failed to load function ${functionId}: ${error.message}`);
	}
}

