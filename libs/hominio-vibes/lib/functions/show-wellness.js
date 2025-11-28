/**
 * Show Wellness Function
 * Displays wellness/spa services sorted by categories
 * 
 * Wellness data is dynamically loaded from agent config's dataContext
 * Single source of truth: agent config JSON
 */

/**
 * Function handler - executes the skill logic
 * @param {Object} args - Function arguments
 * @param {string} [args.category] - Optional category filter
 * @param {Object} context - Function context
 * @param {string} context.dataContext - Data context string from agent config (formatted)
 * @param {Object[]} [context.rawDataContext] - Raw data context from agent config (for extracting wellness data)
 * @param {Object[]} [context.skillDataContext] - Skill-specific data context (e.g., wellness data for show-wellness skill)
 * @param {string} [context.userId] - Current user ID
 * @param {string} context.vibeId - Vibe ID
 * @returns {Promise<Object>}
 */
export async function handler(args, context) {
	const { category } = args || {};
	
	// Get wellness data from store (single source of truth)
	try {
		const { getWellnessData } = await import('./wellness-store.js');
		const wellness = await getWellnessData();
		
		if (!wellness) {
			return {
				success: false,
				error: 'Wellness data not available'
			};
		}
		
		// Filter by category if specified
		const result = category ? { [category]: wellness[category] || [] } : wellness;
		
		return {
			success: true,
			data: {
				wellness: result,
				category: category || 'all',
				timestamp: new Date().toISOString()
			}
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to load wellness data: ${error instanceof Error ? error.message : 'Unknown error'}`
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
 * Generate wellness context string for LLM from agent config data
 * Formats the wellness data from agent config into a readable string for LLM prompts
 * @param {Object} wellnessData - Wellness data from store
 * @param {Object} contextConfig - Context config from skill.contextConfig (REQUIRED)
 * @param {string[]} contextConfig.instructions - Array of instruction strings for LLM
 * @param {string} contextConfig.reminder - Reminder text to append at end
 * @param {Object<string, string>} contextConfig.categoryNames - Mapping of category keys to display names
 * @param {Object} contextConfig.currency - Currency configuration
 * @param {string} contextConfig.currency.code - Currency code (e.g., 'EUR')
 * @param {string} contextConfig.currency.locale - Locale for formatting (e.g., 'de-DE')
 * @returns {string} Formatted wellness context string
 */
export function getWellnessContextString(wellnessData, contextConfig) {
	if (!wellnessData) {
		return '';
	}
	
	if (!contextConfig) {
		throw new Error('contextConfig is required for getWellnessContextString');
	}
	
	// Get configurable values from contextConfig (from skill config JSON)
	const instructions = contextConfig.instructions || [];
	const reminder = contextConfig.reminder || '';
	const categoryNames = contextConfig.categoryNames || {};
	const currency = contextConfig.currency || { code: 'EUR', locale: 'de-DE' };
	
	const lines = [
		'[Wellness Context - CRITICAL INSTRUCTIONS]',
		'',
		...instructions,
		'',
		'TATSÄCHLICHE WELLNESS-DIENSTLEISTUNGEN (NUR DIESE EXISTIEREN):',
		''
	];
	
	// Format each category using configurable category names
	for (const [categoryKey, categoryName] of Object.entries(categoryNames)) {
		// @ts-ignore - Dynamic category access from wellnessData
		const categoryItems = wellnessData[categoryKey];
		if (categoryItems && categoryItems.length > 0) {
			lines.push(`${categoryName}:`);
			for (const item of categoryItems) {
				const priceFormatted = new Intl.NumberFormat(currency.locale, {
					style: 'currency',
					currency: currency.code,
					minimumFractionDigits: 2,
					maximumFractionDigits: 2
				}).format(item.price);
				const duration = item.duration ? ` (${item.duration})` : '';
				lines.push(`- ${item.name} - ${priceFormatted}${duration}`);
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
		enum: ['massages', 'treatments', 'packages', 'facilities'],
		description: 'Wellness category filter'
	}
};

