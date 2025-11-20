/**
 * Function Loader
 * Dynamically loads function implementations by ID
 * Browser-compatible: Uses relative imports from package root
 */

// Import all functions statically - use relative path from this file
// Vite will resolve these correctly when the package is imported
import * as showMenuModule from '../lib/functions/show-menu.js';

const functionModules = {
	'show-menu': showMenuModule
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
		if (!module.uiComponent || typeof module.uiComponent !== 'function') {
			throw new Error(`Function ${functionId} missing uiComponent export`);
		}
		if (!module.schema) {
			throw new Error(`Function ${functionId} missing schema export`);
		}
		
		return {
			handler: module.handler,
			uiComponent: module.uiComponent,
			schema: module.schema
		};
	} catch (error) {
		throw new Error(`Failed to load function ${functionId}: ${error.message}`);
	}
}

