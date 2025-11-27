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
 * @param {string} context.agentId - Agent ID
 * @returns {Promise<Object>}
 */
export async function handler(args, context) {
	const { category } = args || {};
	
	console.log('[show-wellness] Handler called with args:', args);
	console.log('[show-wellness] Context:', {
		hasSkillDataContext: !!context.skillDataContext,
		skillDataContextType: Array.isArray(context.skillDataContext) ? 'array' : typeof context.skillDataContext,
		skillDataContextLength: Array.isArray(context.skillDataContext) ? context.skillDataContext.length : 'N/A',
		hasRawDataContext: !!context.rawDataContext,
		rawDataContextType: Array.isArray(context.rawDataContext) ? 'array' : typeof context.rawDataContext,
		rawDataContextLength: Array.isArray(context.rawDataContext) ? context.rawDataContext.length : 'N/A'
	});
	
	// Extract wellness data from skill-specific dataContext
	// Wellness should be in skill.dataContext with id: "wellness"
	/** @type {any} */
	let wellness = null;
	/** @type {any} */
	let wellnessConfig = null;
	
	// First try skill-specific dataContext (preferred)
	if (context.skillDataContext) {
		// Handle both array and single object cases
		const skillDataContextArray = Array.isArray(context.skillDataContext) 
			? context.skillDataContext 
			: [context.skillDataContext];
		
		console.log('[show-wellness] Searching skillDataContext:', skillDataContextArray.map((item) => item?.id));
		
		/** @type {any} */
		const wellnessContext = skillDataContextArray.find((item) => item && item.id === 'wellness');
		if (wellnessContext) {
			console.log('[show-wellness] Found wellness context in skillDataContext');
			wellnessConfig = wellnessContext; // Store full config for instructions
			if (wellnessContext.data) {
				wellness = wellnessContext.data;
				console.log('[show-wellness] Wellness data loaded:', Object.keys(wellness || {}));
			} else {
				console.warn('[show-wellness] Wellness context found but no data property');
			}
		}
	}
	
	// Fallback to rawDataContext (for backwards compatibility)
	if (!wellness && context.rawDataContext) {
		// Handle both array and single object cases
		const rawDataContextArray = Array.isArray(context.rawDataContext)
			? context.rawDataContext
			: [context.rawDataContext];
		
		console.log('[show-wellness] Searching rawDataContext:', rawDataContextArray.map((item) => item?.id));
		
		/** @type {any} */
		const wellnessContext = rawDataContextArray.find((item) => item && item.id === 'wellness');
		if (wellnessContext) {
			console.log('[show-wellness] Found wellness context in rawDataContext');
			wellnessConfig = wellnessContext;
			if (wellnessContext.data) {
				wellness = wellnessContext.data;
				console.log('[show-wellness] Wellness data loaded from rawDataContext:', Object.keys(wellness || {}));
			}
		}
	}
	
	// Fallback: if wellness not found in context, return error with configurable message
	if (!wellness) {
		const errorMsg = (wellnessConfig && wellnessConfig.errorMessage) || 'Wellness data not found in agent configuration';
		console.error('[show-wellness] Wellness data not found. skillDataContext:', context.skillDataContext, 'rawDataContext:', context.rawDataContext);
		return {
			success: false,
			error: errorMsg
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
 * @param {Object} wellnessData - Wellness data from agent config dataContext
 * @param {Object} [wellnessConfig={}] - Full wellness config item with instructions, categoryNames, currency, reminder
 * @returns {string} Formatted wellness context string
 */
export function getWellnessContextString(wellnessData, wellnessConfig = {}) {
	if (!wellnessData) {
		return '';
	}
	
	const instructions = wellnessConfig.instructions || [
		'DU MUSST DIESE REGELN STRENG BEFOLGEN:',
		'1. Du darfst NUR Wellness-Dienstleistungen erwähnen, die unten aufgelistet sind.',
		'2. ALLE Preise sind in EUR (Euro) NUR.',
		'3. Wenn ein Benutzer nach einer Dienstleistung fragt, die NICHT auf dieser Liste steht, musst du ihn höflich informieren, dass diese Dienstleistung nicht verfügbar ist.'
	];
	
	const reminder = wellnessConfig.reminder || 'ERINNERE DICH: Wenn ein Benutzer nach IRGENDEINER Dienstleistung fragt, die oben NICHT aufgeführt ist, musst du sagen, dass sie nicht verfügbar ist. Alle Preise sind nur in EUR.';
	
	const categoryNames = wellnessConfig.categoryNames || {
		massages: 'MASSAGEN',
		treatments: 'BEHANDLUNGEN',
		packages: 'PAKETE',
		facilities: 'EINRICHTUNGEN'
	};
	
	const currency = wellnessConfig.currency || {
		code: 'EUR',
		locale: 'de-DE'
	};
	
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

