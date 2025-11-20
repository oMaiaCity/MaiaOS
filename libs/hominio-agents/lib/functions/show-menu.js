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
 * @param {Object} context.rawDataContext - Raw data context from agent config (for extracting menu data)
 * @param {string} context.userId - Current user ID
 * @param {string} context.agentId - Agent ID
 * @returns {Promise<Object>}
 */
export async function handler(args, context) {
	const { category } = args || {};
	
	// Extract menu data from agent config's dataContext
	// Menu should be in a dataContext entry with id: "menu"
	let menu = null;
	
	if (context.rawDataContext && Array.isArray(context.rawDataContext)) {
		const menuContext = context.rawDataContext.find(item => item.id === 'menu');
		if (menuContext && menuContext.data) {
			menu = menuContext.data;
		}
	}
	
	// Fallback: if menu not found in context, return error
	if (!menu) {
		return {
			success: false,
			error: 'Menu data not found in agent configuration'
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
 */
export const uiComponent = () => import('./show-menu-ui.svelte');

/**
 * Generate menu context string for LLM from agent config data
 * Formats the menu data from agent config into a readable string for LLM prompts
 * @param {Object} menuData - Menu data from agent config dataContext
 * @returns {string} Formatted menu context string
 */
export function getMenuContextString(menuData) {
	if (!menuData) {
		return '';
	}
	
	const categoryNames = {
		appetizers: 'APPETIZERS',
		mains: 'MAIN COURSES',
		desserts: 'DESSERTS',
		drinks: 'DRINKS'
	};
	
	const lines = [
		'[Menu Context - CRITICAL INSTRUCTIONS]',
		'',
		'DU MUSST DIESE REGELN STRENG BEFOLGEN:',
		'1. Du darfst NUR Menüpunkte erwähnen, die unten aufgelistet sind. Erfinde, erfinde oder schlage KEINE Menüpunkte vor, die NICHT auf dieser Liste stehen.',
		'2. ALLE Preise sind in EUR (Euro) NUR. Erwähne KEINE Dollar, USD oder andere Währungen.',
		'3. Wenn ein Benutzer nach einem Artikel fragt, der NICHT auf dieser Liste steht (wie "Erdbeeren mit Sahne", "Crème Brûlée", "Club Sandwich" usw.), musst du ihn höflich informieren, dass dieser Artikel nicht verfügbar ist.',
		'4. Übersetze Menüpunkte NICHT in andere Sprachen, es sei denn, der Benutzer fragt ausdrücklich danach.',
		'5. Die EINZIGEN verfügbaren Nachspeisen sind: Schokoladen-Lava-Kuchen, Tiramisu und Käsekuchen. Nichts anderes.',
		'',
		'TATSÄCHLICHE MENÜPUNKTE (NUR DIESE EXISTIEREN):',
		''
	];
	
	const categoryNamesDE = {
		appetizers: 'VORSPEISEN',
		mains: 'HAUPTGERICHTE',
		desserts: 'NACHSPEISEN',
		drinks: 'GETRÄNKE'
	};
	
	// Format each category
	for (const [categoryKey, categoryName] of Object.entries(categoryNamesDE)) {
		if (menuData[categoryKey] && menuData[categoryKey].length > 0) {
			lines.push(`${categoryName}:`);
			for (const item of menuData[categoryKey]) {
				const priceEUR = new Intl.NumberFormat('de-DE', {
					style: 'currency',
					currency: 'EUR',
					minimumFractionDigits: 2,
					maximumFractionDigits: 2
				}).format(item.price);
				lines.push(`- ${item.name} - ${priceEUR} (${item.type})`);
			}
			lines.push('');
		}
	}
	
	lines.push('ERINNERE DICH: Wenn ein Benutzer nach IRGENDEINEM Artikel fragt, der oben NICHT aufgeführt ist, musst du sagen, dass er nicht verfügbar ist. Alle Preise sind nur in EUR. Erfinde keine Artikel und verwende keine anderen Währungen.');
	
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

