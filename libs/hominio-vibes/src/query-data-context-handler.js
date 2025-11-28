/**
 * Query Data Context Handler
 * Handles queryDataContext tool calls
 * Routes to appropriate store-based handlers and returns data (no context injection)
 */

import { getSchemaHandler } from './data-context-schema-registry.js';
import { getCalendarContextString } from '../lib/functions/calendar-store.js';

/**
 * Handle queryDataContext tool call
 * Returns simple formatted JSON data - AI uses this directly, no complex formatting needed
 * @param {Object} options - Handler options
 * @param {string} options.schemaId - Schema ID (e.g., "menu", "wellness", "calendar")
 * @param {Object} [options.params={}] - Query parameters (schema-specific)
 * @param {Function} [options.injectFn] - Function to inject context (deprecated - no longer used)
 * @returns {Promise<{success: boolean, message?: string, error?: string, data?: any}>}
 */
export async function handleQueryDataContext({ schemaId, params = {}, injectFn }) {
	try {
		// Get schema handler
		const handler = getSchemaHandler(schemaId);
		
		if (!handler) {
			return {
				success: false,
				error: `Unknown schema ID: ${schemaId}. Available schemas: menu, wellness, calendar`
			};
		}
		
		// Get context string - simple formatted data, no complex contextConfig needed
		const contextString = await handler.getContextString(params);
		
		if (!contextString) {
			return {
				success: false,
				error: `No context available for schema: ${schemaId}`
			};
		}
		
		// Parse the JSON string to get the actual data object
		let data = null;
		try {
			data = JSON.parse(contextString);
		} catch (e) {
			// If parsing fails, use the string as-is
			data = contextString;
		}
		
		// Return data without injecting context - context injection removed
		return {
			success: true,
			message: `Loaded ${schemaId} data context`,
			data: data
		};
	} catch (error) {
		console.error(`[QueryDataContext] Error handling query:`, error);
		return {
			success: false,
			error: `Failed to query data context: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}
