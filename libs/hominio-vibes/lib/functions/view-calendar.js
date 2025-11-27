/**
 * View Calendar Function
 * Returns current week's entries (starting from today, 7 days)
 * Always passes full calendar state as context to AI
 */

import {
	getWeekEntries,
	getCalendarContextString
} from './calendar-store.js';

/**
 * Function handler - returns current week's calendar entries
 * @param {Object} args - Function arguments
 * @param {string} [args.date] - Optional date filter (YYYY-MM-DD), defaults to today
 * @param {Object} context - Function context
 * @param {string} context.dataContext - Data context string (includes full calendar state)
 * @param {string} [context.userId] - Current user ID
 * @param {string} context.agentId - Agent ID
 * @returns {Promise<Object>}
 */
export async function handler(args, context) {
	const { date } = args || {};
	
	// Validate date format if provided
	if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return {
			success: false,
			error: 'Invalid date format. Use YYYY-MM-DD format'
		};
	}
	
	try {
		// Determine query date
		// If no date provided, start from yesterday to cover global timezones (Server might be ahead of Client)
		let queryDate = date;
		if (!queryDate) {
			const yesterday = new Date(Date.now() - 86400000);
			queryDate = yesterday.toISOString().split('T')[0];
		}

		// Get week entries
		const weekEntries = await getWeekEntries(queryDate);
		
		// Get full calendar context for AI
		const calendarContext = await getCalendarContextString();
		
		// Group entries by date for display
		const entriesByDate = {};
		weekEntries.forEach((entry) => {
			if (!entriesByDate[entry.date]) {
				entriesByDate[entry.date] = [];
			}
			entriesByDate[entry.date].push(entry);
		});
		
		// Calculate week range for response metadata
		// Note: We don't send weekStart/weekEnd if date was not provided, 
		// allowing the UI to determine "Today" based on client local time.
		const startDate = new Date(queryDate);
		startDate.setHours(0, 0, 0, 0);
		const endDate = new Date(startDate);
		endDate.setDate(endDate.getDate() + 7); // 7 days from query start
		
		// Get current date/time for AI context
		const now = new Date();
		const currentDateISO = now.toISOString().split('T')[0];
		const currentDateFormatted = now.toLocaleDateString('de-DE', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
		const currentTime = now.toLocaleTimeString('de-DE', {
			hour: '2-digit',
			minute: '2-digit'
		});
		
		return {
			success: true,
			data: {
				entries: weekEntries,
				entriesByDate,
				// Only force week view start if specific date requested
				weekStart: date ? startDate.toISOString().split('T')[0] : undefined,
				weekEnd: date ? endDate.toISOString().split('T')[0] : undefined,
				calendarContext,
				// Current date/time for AI reference
				currentDate: {
					iso: currentDateISO,
					formatted: currentDateFormatted,
					time: currentTime,
					timestamp: now.toISOString()
				},
				timestamp: now.toISOString()
			}
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to load calendar: ${error.message}`
		};
	}
}

/**
 * UI Component - dynamically loaded Svelte component
 * Note: UI component loading is handled by function-loader.js
 * This export is kept for compatibility but is overridden by function-loader.js
 */
export const uiComponent = () => Promise.resolve({ default: null });

/**
 * Schema for validation
 */
export const schema = {
	date: {
		type: 'string',
		optional: true,
		description: 'Date for week view (YYYY-MM-DD), defaults to today'
	}
};

