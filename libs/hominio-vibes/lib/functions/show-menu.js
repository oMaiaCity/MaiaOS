/**
 * Show Menu Function
 * Displays restaurant menu items sorted by categories
 * 
 * Menu data is dynamically loaded from agent config's dataContext
 * Single source of truth: agent config JSON
 */

/**
 * Function handler - executes the skill logic
 * @param {Object} args - Function arguments
 * @param {string} [args.category] - Optional category filter
 * @param {Object} context - Function context
 * @param {string} context.dataContext - Data context string from agent config (formatted)
 * @param {Object[]} [context.rawDataContext] - Raw data context from agent config (for extracting menu data)
 * @param {Object[]} [context.skillDataContext] - Skill-specific data context (e.g., menu data for show-menu skill)
 * @param {string} [context.userId] - Current user ID
 * @param {string} context.agentId - Agent ID
 * @returns {Promise<Object>}
 */
export async function handler(args, context) {
	const { category } = args || {};
	
	// Extract menu data from skill-specific dataContext
	// Menu should be in skill.dataContext with id: "menu"
	/** @type {any} */
	let menu = null;
	/** @type {any} */
	let menuConfig = null;
	
	// First try skill-specific dataContext (preferred)
	if (context.skillDataContext && Array.isArray(context.skillDataContext)) {
		/** @type {any} */
		const menuContext = context.skillDataContext.find((/** @type {any} */ item) => item && item.id === 'menu');
		if (menuContext) {
			menuConfig = menuContext; // Store full config for instructions
			if (menuContext.data) {
				menu = menuContext.data;
			}
		}
	}
	
	// Fallback to rawDataContext (for backwards compatibility)
	if (!menu && context.rawDataContext && Array.isArray(context.rawDataContext)) {
		/** @type {any} */
		const menuContext = context.rawDataContext.find((/** @type {any} */ item) => item && item.id === 'menu');
		if (menuContext) {
			menuConfig = menuContext;
			if (menuContext.data) {
				menu = menuContext.data;
			}
		}
	}
	
	// Fallback: if menu not found in context, return error with configurable message
	if (!menu) {
		const errorMsg = (menuConfig && menuConfig.errorMessage) || 'Menu data not found in agent configuration';
		return {
			success: false,
			error: errorMsg
		};
	}
	
	// Filter by category if specified
	const result = category ? { [category]: menu[category] || [] } : menu;
	
	return {
		success: true,
		data: {
			menu: result,
			category: category || 'all',
			timestamp: new Date().toISOString()
		}
	};
}

/**
 * UI Component - dynamically loaded Svelte component
 * Note: UI component loading is handled by function-loader.js
 * This export is kept for compatibility but is overridden by function-loader.js
 */
export const uiComponent = () => Promise.resolve({ default: null });

/**
 * Generate menu context string for LLM from agent config data
 * Formats the menu data from agent config into a readable string for LLM prompts
 * Uses configurable instructions, category names, currency, and reminder from menu config
 * @param {Object} menuData - Menu data from agent config dataContext
 * @param {Object} [menuConfig={}] - Full menu config item with instructions, categoryNames, currency, reminder
 * @param {string[]} [menuConfig.instructions] - Array of instruction strings for LLM
 * @param {string} [menuConfig.reminder] - Reminder text to append at end
 * @param {Object<string, string>} [menuConfig.categoryNames] - Mapping of category keys to display names
 * @param {Object} [menuConfig.currency] - Currency configuration
 * @param {string} [menuConfig.currency.code] - Currency code (e.g., 'EUR')
 * @param {string} [menuConfig.currency.locale] - Locale for formatting (e.g., 'de-DE')
 * @returns {string} Formatted menu context string
 */
export function getMenuContextString(menuData, menuConfig = {}) {
	if (!menuData) {
		return '';
	}
	
	// Get configurable values from menuConfig, with fallbacks
	const instructions = menuConfig.instructions || [
		'DU MUSST DIESE REGELN STRENG BEFOLGEN:',
		'1. Du darfst NUR Menüpunkte erwähnen, die unten aufgelistet sind.',
		'2. ALLE Preise sind in EUR (Euro) NUR.',
		'3. Wenn ein Benutzer nach einem Artikel fragt, der NICHT auf dieser Liste steht, musst du ihn höflich informieren, dass dieser Artikel nicht verfügbar ist.'
	];
	
	const reminder = menuConfig.reminder || 'ERINNERE DICH: Wenn ein Benutzer nach IRGENDEINEM Artikel fragt, der oben NICHT aufgeführt ist, musst du sagen, dass er nicht verfügbar ist. Alle Preise sind nur in EUR.';
	
	const categoryNames = menuConfig.categoryNames || {
		appetizers: 'VORSPEISEN',
		mains: 'HAUPTGERICHTE',
		desserts: 'NACHSPEISEN',
		drinks: 'GETRÄNKE'
	};
	
	const currency = menuConfig.currency || {
		code: 'EUR',
		locale: 'de-DE'
	};
	
	const lines = [
		'[Menu Context - CRITICAL INSTRUCTIONS]',
		'',
		...instructions,
		'',
		'TATSÄCHLICHE MENÜPUNKTE (NUR DIESE EXISTIEREN):',
		''
	];
	
	// Format each category using configurable category names
	for (const [categoryKey, categoryName] of Object.entries(categoryNames)) {
		// @ts-ignore - Dynamic category access from menuData
		const categoryItems = menuData[categoryKey];
		if (categoryItems && categoryItems.length > 0) {
			lines.push(`${categoryName}:`);
			for (const item of categoryItems) {
				const priceFormatted = new Intl.NumberFormat(currency.locale, {
					style: 'currency',
					currency: currency.code,
					minimumFractionDigits: 2,
					maximumFractionDigits: 2
				}).format(item.price);
				lines.push(`- ${item.name} - ${priceFormatted} (${item.type})`);
			}
			lines.push('');
		}
	}
	
	lines.push(reminder);
	
	return lines.join('\n');
}

/**
 * Schema for validation
 */
export const schema = {
	category: {
		type: 'string',
		optional: true,
		enum: ['appetizers', 'mains', 'desserts', 'drinks'],
		description: 'Menu category filter'
	}
};

