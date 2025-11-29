/**
 * Context Injection Manager
 * Unified system for injecting context for skills
 * Maps skill IDs to context formatters
 */

import { loadVibeConfig } from './vibe-loader.js';
import { getMenuData } from '../lib/functions/menu-store.js';
import { getWellnessData } from '../lib/functions/wellness-store.js';
import { getCalendarContextString } from '../lib/functions/calendar-store.js';
import { getMenuContextString } from '../lib/functions/show-menu.js';
import { getWellnessContextString } from '../lib/functions/show-wellness.js';

/**
 * Registry of skill IDs to data getters and formatters
 * Maps skillId → { getData, formatter }
 */
const CONTEXT_FORMATTERS = {
	'show-menu': {
		getData: getMenuData,
		formatter: getMenuContextString
	},
	'show-wellness': {
		getData: getWellnessData,
		formatter: getWellnessContextString
	},
	'view-calendar': {
		getData: null, // Calendar doesn't need data getter
		formatter: getCalendarContextString
	},
	'create-calendar-entry': {
		getData: null,
		formatter: getCalendarContextString
	},
	'edit-calendar-entry': {
		getData: null,
		formatter: getCalendarContextString
	},
	'delete-calendar-entry': {
		getData: null,
		formatter: getCalendarContextString
	}
};

/**
 * Inject context for a skill
 * @param {Object} options - Injection options
 * @param {string} options.skillId - Skill ID (e.g., "show-menu", "show-wellness")
 * @param {string} options.vibeId - Vibe ID (e.g., "charles", "karl")
 * @param {Function} options.injectFn - Function to inject context (e.g., session.sendClientContent)
 * @returns {Promise<void>}
 */
export async function injectContextForSkill({ skillId, vibeId, injectFn }) {
	try {
		// Get formatter configuration for this skill
		const formatterConfig = CONTEXT_FORMATTERS[skillId];
		
		if (!formatterConfig) {
			// No context formatter for this skill - that's okay, some skills don't need context injection
			return;
		}
		
		// Load vibe config to get skill's contextConfig
		const vibeConfig = await loadVibeConfig(vibeId);
		const skill = vibeConfig.skills.find(s => s.id === skillId);
		
		if (!skill) {
			console.warn(`[ContextInjection] Skill not found: ${skillId} in vibe ${vibeId}`);
			return;
		}
		
		// Get context string
		let contextString;
		
		if (formatterConfig.getData) {
			// Skills that need data from stores (menu, wellness)
			const data = await formatterConfig.getData();
			if (!skill.contextConfig) {
				throw new Error(`Skill ${skillId} requires contextConfig but it's missing in vibe config`);
			}
			contextString = formatterConfig.formatter(data, skill.contextConfig);
		} else {
			// Skills that don't need data (calendar)
			contextString = await formatterConfig.formatter();
		}
		
		if (!contextString) {
			console.warn(`[ContextInjection] No context returned for skill: ${skillId}`);
			return;
		}
		
		// Inject context
		if (injectFn) {
			injectFn({
				turns: contextString,
				turnComplete: true
			});
			console.log(`[ContextInjection] ✅ Injected context for skill: ${skillId}`);
		}
	} catch (error) {
		console.error(`[ContextInjection] Error injecting context for skill ${skillId}:`, error);
		// Don't throw - context injection failure shouldn't break skill execution
	}
}

/**
 * Register a context formatter for a skill
 * @param {string} skillId - Skill ID
 * @param {Function} formatter - Async function that returns context string
 */
export function registerContextFormatter(skillId, formatter) {
	CONTEXT_FORMATTERS[skillId] = formatter;
}

/**
 * Check if a skill has a context formatter
 * @param {string} skillId - Skill ID
 * @returns {boolean} True if formatter exists
 */
export function hasContextFormatter(skillId) {
	return skillId in CONTEXT_FORMATTERS;
}
