/**
 * Delete Calendar Entry Function
 * Deletes a calendar entry by ID
 * Always passes full calendar state as context to AI
 */

import {
	deleteEntry,
	getEntryById,
	getCalendarContextString,
	getWeekEntries
} from './calendar-store.js';

/**
 * Function handler - deletes a calendar entry
 * @param {Object} args - Function arguments
 * @param {string} args.id - Entry ID (required)
 * @param {Object} context - Function context
 * @param {string} context.dataContext - Data context string (includes full calendar state)
 * @param {string} [context.userId] - Current user ID
 * @param {string} context.agentId - Agent ID
 * @returns {Promise<Object>}
 */
export async function handler(args, context) {
	const { id } = args || {};
	
	// Validate ID
	if (!id) {
		return {
			success: false,
			error: 'Entry ID is required for deletion'
		};
	}
	
	// Check if entry exists
	const existingEntry = await getEntryById(id);
	if (!existingEntry) {
		return {
			success: false,
			error: `Calendar entry with ID "${id}" not found`
		};
	}
	
	try {
		// Delete the entry
		const deleted = await deleteEntry(id);
		
		if (!deleted) {
			return {
				success: false,
				error: 'Failed to delete calendar entry'
			};
		}
		
		// Get updated calendar state for context
		const calendarContext = await getCalendarContextString();
		
		// Prepare UI data: Week view centered on the deleted entry's date
		const viewDate = existingEntry.date;
		const weekEntries = await getWeekEntries(viewDate);
		
		// Group entries by date for display
		const entriesByDate = {};
		weekEntries.forEach((entry) => {
			if (!entriesByDate[entry.date]) {
				entriesByDate[entry.date] = [];
			}
			entriesByDate[entry.date].push(entry);
		});
		
		// Calculate week range
		const startDate = new Date(viewDate);
		startDate.setHours(0, 0, 0, 0);
		const endDate = new Date(startDate);
		endDate.setDate(endDate.getDate() + 7);
		
		return {
			success: true,
			data: {
				deletedEntry: existingEntry,
				entries: weekEntries,
				entriesByDate,
				weekStart: startDate.toISOString().split('T')[0],
				weekEnd: endDate.toISOString().split('T')[0],
				calendarContext,
				message: `Termin "${existingEntry.title}" erfolgreich gelöscht`
			},
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to delete calendar entry: ${error.message}`
		};
	}
}

/**
 * UI Component - dynamically loaded Svelte component
 */
export const uiComponent = () => import('./calendar-ui.svelte');

/**
 * Schema for validation
 */
export const schema = {
	id: {
		type: 'string',
		optional: false,
		description: 'Entry ID to delete'
	}
};

