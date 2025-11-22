/**
 * Create Calendar Entry Function
 * Creates a new calendar entry with auto-generated ID
 * Always passes full calendar state as context to AI
 */

import {
	addEntry,
	getCalendarContextString,
	getWeekEntries
} from './calendar-store.js';

/**
 * Function handler - creates a new calendar entry
 * @param {Object} args - Function arguments
 * @param {string} args.title - Entry title (required)
 * @param {string} args.date - Date in YYYY-MM-DD format (required)
 * @param {string} args.time - Time in HH:MM format (required)
 * @param {number} args.duration - Duration in minutes (required)
 * @param {string} [args.description] - Optional description
 * @param {Object} context - Function context
 * @param {string} context.dataContext - Data context string (includes full calendar state)
 * @param {string} [context.userId] - Current user ID
 * @param {string} context.agentId - Agent ID
 * @returns {Promise<Object>}
 */
export async function handler(args, context) {
	const { title, date, time, duration, description } = args || {};
	
	// Validate required fields
	if (!title || !date || !time || duration === undefined) {
		return {
			success: false,
			error: 'Missing required fields: title, date, time, and duration are required'
		};
	}
	
	// Validate date format
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return {
			success: false,
			error: 'Invalid date format. Use YYYY-MM-DD format'
		};
	}
	
	// Validate time format
	if (!/^\d{2}:\d{2}$/.test(time)) {
		return {
			success: false,
			error: 'Invalid time format. Use HH:MM format (24-hour)'
		};
	}
	
	// Validate duration
	if (typeof duration !== 'number' || duration <= 0) {
		return {
			success: false,
			error: 'Duration must be a positive number (minutes)'
		};
	}
	
	try {
		// Create the entry
		const newEntry = await addEntry({
			title,
			date,
			time,
			duration,
			description: description || ''
		});
		
		// Get updated calendar state for context
		const calendarContext = await getCalendarContextString();
		
		// Prepare UI data: Week view centered on the new entry's date
		const weekEntries = await getWeekEntries(date);
		
		// Group entries by date for display
		const entriesByDate = {};
		weekEntries.forEach((entry) => {
			if (!entriesByDate[entry.date]) {
				entriesByDate[entry.date] = [];
			}
			entriesByDate[entry.date].push(entry);
		});
		
		// Calculate week range
		const startDate = new Date(date);
		startDate.setHours(0, 0, 0, 0);
		const endDate = new Date(startDate);
		endDate.setDate(endDate.getDate() + 7);
		
		return {
			success: true,
			data: {
				entry: newEntry,
				entries: weekEntries,
				entriesByDate,
				weekStart: startDate.toISOString().split('T')[0],
				weekEnd: endDate.toISOString().split('T')[0],
				calendarContext,
				message: `Termin "${title}" erfolgreich erstellt für ${date} um ${time}`
			},
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to create calendar entry: ${error.message}`
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
	title: {
		type: 'string',
		optional: false,
		description: 'Entry title'
	},
	date: {
		type: 'string',
		optional: false,
		description: 'Date in YYYY-MM-DD format'
	},
	time: {
		type: 'string',
		optional: false,
		description: 'Time in HH:MM format (24-hour)'
	},
	duration: {
		type: 'number',
		optional: false,
		description: 'Duration in minutes'
	},
	description: {
		type: 'string',
		optional: true,
		description: 'Optional description'
	}
};

