/**
 * View Resolver - Resolves data paths to values for view nodes
 * Generic data path resolver supporting dot notation and array access
 */

import type { Data } from '../dataStore'

/**
 * Format a date string (ISO format) to a readable format
 */
function formatDate(dateString: string | undefined): string {
	if (!dateString) return ''
	try {
		const date = new Date(dateString)
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		})
	} catch {
		return dateString
	}
}

/**
 * Resolve a data path to a value
 * Supports dot notation: "data.title", "data.todos.0.text", etc.
 * Also supports date formatting: "item.endDate|date" formats the date
 */
export function resolveDataPath(data: Data, path: string): unknown {
	// Check for formatting pipe (e.g., "item.endDate|date")
	const [dataPath, format] = path.split('|')

	const parts = dataPath.split('.')

	// Remove "data" prefix if present (data.title -> title)
	const dataParts = parts[0] === 'data' ? parts.slice(1) : parts

	let current: unknown = data

	for (const part of dataParts) {
		if (current === null || current === undefined) {
			return undefined
		}

		// Handle array index access (e.g., "todos.0.text")
		const arrayIndexMatch = part.match(/^(\d+)$/)
		if (arrayIndexMatch && Array.isArray(current)) {
			const index = parseInt(arrayIndexMatch[1], 10)
			current = current[index]
		} else if (typeof current === 'object' && current !== null) {
			// Use bracket notation to handle property names with hyphens or special characters
			// This works for both regular properties and properties with hyphens (e.g., "in-progress")
			const currentObj = current as Record<string, unknown>
			// Always use bracket notation to access properties (handles hyphens and special chars)
			if (part in currentObj) {
				current = currentObj[part]
			} else {
				// Property doesn't exist
				return undefined
			}
		} else {
			return undefined
		}
	}

	// Apply formatting if specified
	if (format === 'date' && typeof current === 'string') {
		return formatDate(current)
	}

	return current
}
