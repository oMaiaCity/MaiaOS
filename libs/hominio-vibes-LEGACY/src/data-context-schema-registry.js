/**
 * Data Context Schema Registry
 * Centralized registry of available data context schemas and their handlers
 * Maps schemaId → handler functions for querying and formatting context
 * Returns simple formatted JSON data - no complex contextConfig needed
 */

import { getCalendarContextString } from '../lib/functions/calendar-store.js'
import { getMenuData } from '../lib/functions/menu-store.js'
import { getWellnessData } from '../lib/functions/wellness-store.js'

/**
 * Simple formatter for menu data - returns formatted JSON string
 */
async function getMenuContextString(params = {}) {
	const menu = await getMenuData()
	if (!menu) return ''

	// Filter by category if specified
	const { category } = params
	const filteredMenu = category ? { [category]: menu[category] || [] } : menu

	// Return simple formatted JSON string
	return JSON.stringify(filteredMenu, null, 2)
}

/**
 * Simple formatter for wellness data - returns formatted JSON string
 */
async function getWellnessContextString(params = {}) {
	const wellness = await getWellnessData()
	if (!wellness) return ''

	// Filter by category if specified
	const { category } = params
	const filteredWellness = category ? { [category]: wellness[category] || [] } : wellness

	// Return simple formatted JSON string
	return JSON.stringify(filteredWellness, null, 2)
}

/**
 * Schema handler definition
 * @typedef {Object} SchemaHandler
 * @property {Function} getContextString - Function that returns formatted context string
 * @property {Object} paramsSchema - JSON schema for query parameters
 * @property {string} description - Description of what this schema provides
 */

/**
 * Registry of available data context schemas
 * Maps schemaId → handler configuration
 */
const SCHEMA_REGISTRY = {
	menu: {
		getContextString: getMenuContextString,
		paramsSchema: {
			type: 'object',
			properties: {
				category: {
					type: 'string',
					description: 'Optional category filter (appetizers, mains, desserts, drinks)',
					enum: ['appetizers', 'mains', 'desserts', 'drinks'],
				},
			},
			required: [],
		},
		description: 'Restaurant menu items with prices and categories',
	},
	wellness: {
		getContextString: getWellnessContextString,
		paramsSchema: {
			type: 'object',
			properties: {
				category: {
					type: 'string',
					description: 'Optional category filter (massages, treatments, packages, facilities)',
					enum: ['massages', 'treatments', 'packages', 'facilities'],
				},
			},
			required: [],
		},
		description: 'Wellness and spa services with prices and durations',
	},
	calendar: {
		getContextString: getCalendarContextString,
		paramsSchema: {
			type: 'object',
			properties: {
				date: {
					type: 'string',
					description: 'Optional date filter (YYYY-MM-DD), defaults to today',
					pattern: '^\\d{4}-\\d{2}-\\d{2}$',
				},
			},
			required: [],
		},
		description: 'Calendar entries and appointments',
	},
}

/**
 * Get schema handler for a schema ID
 * @param {string} schemaId - Schema ID (e.g., "menu", "wellness", "calendar")
 * @returns {SchemaHandler|null} Schema handler or null if not found
 */
export function getSchemaHandler(schemaId) {
	return SCHEMA_REGISTRY[schemaId] || null
}

/**
 * Check if a schema ID is registered
 * @param {string} schemaId - Schema ID to check
 * @returns {boolean} True if schema is registered
 */
export function hasSchema(schemaId) {
	return schemaId in SCHEMA_REGISTRY
}

/**
 * Get all registered schema IDs
 * @returns {string[]} Array of schema IDs
 */
export function getRegisteredSchemaIds() {
	return Object.keys(SCHEMA_REGISTRY)
}

/**
 * Get params schema for a schema ID
 * @param {string} schemaId - Schema ID
 * @returns {Object|null} JSON schema for parameters or null if not found
 */
export function getSchemaParamsSchema(schemaId) {
	const handler = getSchemaHandler(schemaId)
	return handler ? handler.paramsSchema : null
}

/**
 * Register a new schema handler
 * @param {string} schemaId - Schema ID
 * @param {SchemaHandler} handler - Handler configuration
 */
export function registerSchema(schemaId, handler) {
	SCHEMA_REGISTRY[schemaId] = handler
}

/**
 * Get all available schemas with their metadata
 * @returns {Object<string, {description: string, paramsSchema: Object}>} Map of schemaId to metadata
 */
export function getAllSchemasMetadata() {
	const metadata = {}
	for (const [schemaId, handler] of Object.entries(SCHEMA_REGISTRY)) {
		metadata[schemaId] = {
			description: handler.description,
			paramsSchema: handler.paramsSchema,
		}
	}
	return metadata
}
