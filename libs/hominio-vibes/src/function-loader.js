/**
 * Function Loader
 * Dynamically loads function implementations by ID
 * Browser-compatible: Uses relative imports from package root
 */

// Import all functions statically - use relative path from this file
// Vite will resolve these correctly when the package is imported
import * as showMenuModule from '../lib/functions/show-menu.js';
import * as showWellnessModule from '../lib/functions/show-wellness.js';
import * as createCalendarEntryModule from '../lib/functions/create-calendar-entry.js';
import * as editCalendarEntryModule from '../lib/functions/edit-calendar-entry.js';
import * as deleteCalendarEntryModule from '../lib/functions/delete-calendar-entry.js';
import * as viewCalendarModule from '../lib/functions/view-calendar.js';

// Import UI components from local components
import MenuView from './components/MenuView.svelte';
import WellnessView from './components/WellnessView.svelte';
import CalendarView from './components/CalendarView.svelte';
import CalendarEntryView from './components/CalendarEntryView.svelte';

const functionModules = {
	'show-menu': showMenuModule,
	'show-wellness': showWellnessModule,
	'create-calendar-entry': createCalendarEntryModule,
	'edit-calendar-entry': editCalendarEntryModule,
	'delete-calendar-entry': deleteCalendarEntryModule,
	'view-calendar': viewCalendarModule
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
		
		// For show-menu, show-wellness, and calendar functions, use components from vibes package
		let uiComponentLoader = module.uiComponent;
		if (functionId === 'show-menu') {
			uiComponentLoader = () => Promise.resolve({ default: MenuView });
		} else if (functionId === 'show-wellness') {
			uiComponentLoader = () => Promise.resolve({ default: WellnessView });
		} else if (functionId === 'view-calendar' || functionId === 'delete-calendar-entry') {
			uiComponentLoader = () => Promise.resolve({ default: CalendarView });
		} else if (functionId === 'create-calendar-entry' || functionId === 'edit-calendar-entry') {
			uiComponentLoader = () => Promise.resolve({ default: CalendarEntryView });
		}
		
		return {
			handler: module.handler,
			uiComponent: uiComponentLoader,
			schema: module.schema
		};
	} catch (error) {
		throw new Error(`Failed to load function ${functionId}: ${error.message}`);
	}
}

