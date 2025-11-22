/**
 * Edit Calendar Entry Function
 * Updates an existing calendar entry by ID
 * Always passes full calendar state as context to AI
 */

import {
	updateEntry,
	getEntryById,
	getCalendarContextString,
	getWeekEntries
} from './calendar-store.js';

/**
 * Function handler - updates an existing calendar entry
 * @param {Object} args - Function arguments
 * @param {string} args.id - Entry ID (required)
 * @param {string} [args.title] - New title (optional)
 * @param {string} [args.date] - New date in YYYY-MM-DD format (optional)
 * @param {string} [args.time] - New time in HH:MM format (optional)
 * @param {number} [args.duration] - New duration in minutes (optional)
 * @param {string} [args.description] - New description (optional)
 * @param {Object} context - Function context
 * @param {string} context.dataContext - Data context string (includes full calendar state)
 * @param {string} [context.userId] - Current user ID
 * @param {string} context.agentId - Agent ID
 * @returns {Promise<Object>}
 */
export async function handler(args, context) {
	const { id, ...updates } = args || {};
	
	// Validate ID
	if (!id) {
		return {
			success: false,
			error: 'Entry ID is required for editing'
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
	
	// Validate date format if provided
	if (updates.date && !/^\d{4}-\d{2}-\d{2}$/.test(updates.date)) {
		return {
			success: false,
			error: 'Invalid date format. Use YYYY-MM-DD format'
		};
	}
	
	// Validate time format if provided
	if (updates.time && !/^\d{2}:\d{2}$/.test(updates.time)) {
		return {
			success: false,
			error: 'Invalid time format. Use HH:MM format (24-hour)'
		};
	}
	
	// Validate duration if provided
	if (updates.duration !== undefined && (typeof updates.duration !== 'number' || updates.duration <= 0)) {
		return {
			success: false,
			error: 'Duration must be a positive number (minutes)'
		};
	}
	
	// Remove undefined values
	const cleanUpdates = {};
	if (updates.title !== undefined) cleanUpdates.title = updates.title;
	if (updates.date !== undefined) cleanUpdates.date = updates.date;
	if (updates.time !== undefined) cleanUpdates.time = updates.time;
	if (updates.duration !== undefined) cleanUpdates.duration = updates.duration;
	if (updates.description !== undefined) cleanUpdates.description = updates.description;
	
	// Check if there are any updates
	if (Object.keys(cleanUpdates).length === 0) {
		return {
			success: false,
			error: 'No fields provided to update'
		};
	}
	
	try {
		// Update the entry
		const updatedEntry = await updateEntry(id, cleanUpdates);
		
		if (!updatedEntry) {
			return {
				success: false,
				error: 'Failed to update calendar entry'
			};
		}
		
		// Get updated calendar state for context
		const calendarContext = await getCalendarContextString();
		
		// Prepare UI data: Week view centered on the updated entry's date
		const viewDate = updatedEntry.date;
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
				entry: updatedEntry,
				entries: weekEntries,
				entriesByDate,
				weekStart: startDate.toISOString().split('T')[0],
				weekEnd: endDate.toISOString().split('T')[0],
				calendarContext,
				message: `Termin "${updatedEntry.title}" erfolgreich aktualisiert`
			},
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to update calendar entry: ${error.message}`
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
		description: 'Entry ID to edit'
	},
	title: {
		type: 'string',
		optional: true,
		description: 'New title'
	},
	date: {
		type: 'string',
		optional: true,
		description: 'New date in YYYY-MM-DD format'
	},
	time: {
		type: 'string',
		optional: true,
		description: 'New time in HH:MM format (24-hour)'
	},
	duration: {
		type: 'number',
		optional: true,
		description: 'New duration in minutes'
	},
	description: {
		type: 'string',
		optional: true,
		description: 'New description'
	}
};

