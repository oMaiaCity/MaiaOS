/**
 * Action Skill Handler
 * Generic handler for actionSkill tool calls
 * Routes to appropriate function based on agent and skill ID
 */

import { loadAgentConfig } from './agent-loader.js';
import { loadFunction } from './function-loader.js';
import { loadDataContext } from './data-context-loader.js';
import { getCalendarContextString } from '../lib/functions/calendar-store.js';

/**
 * Handle actionSkill tool call
 * @param {Object} params - Tool call parameters
 * @param {string} params.agentId - Agent ID (e.g., 'charles')
 * @param {string} params.skillId - Skill ID (e.g., 'show-menu')
 * @param {Object} params.args - Skill arguments
 * @param {Object} options - Handler options
 * @param {string} options.userId - Current user ID (optional)
 * @returns {Promise<import('./types.ts').FunctionResult>}
 */
export async function handleActionSkill(
	{ agentId, skillId, args },
	{ userId }
) {
	try {
		// 1. Load agent config
		const agentConfig = await loadAgentConfig(agentId);
		
		// 2. Find skill in config
		const skill = agentConfig.skills.find(s => s.id === skillId);
		if (!skill) {
			return {
				success: false,
				error: `Skill "${skillId}" not found in agent "${agentId}"`
			};
		}
		
		// 3. Load function implementation
		const functionImpl = await loadFunction(skill.functionId);
		
		// 4. Load data context (JSON-based, no queries)
		// Use skill-specific dataContext if available, otherwise fall back to agent-level dataContext
		const skillDataContext = skill.dataContext 
			? (Array.isArray(skill.dataContext) ? skill.dataContext : [skill.dataContext])
			: [];
		
		// Combine agent-level and skill-specific data context
		const combinedDataContext = [
			...(agentConfig.dataContext || []),
			...skillDataContext
		];
		
		// Create temporary agent config with combined context for loadDataContext
		const tempAgentConfig = {
			...agentConfig,
			dataContext: combinedDataContext
		};
		
		let dataContextString = await loadDataContext(tempAgentConfig);
		
		// Inject calendar context for calendar-related skills
		if (agentId === 'karl' || skillId?.includes('calendar')) {
			try {
				const calendarContext = await getCalendarContextString();
				if (calendarContext) {
					dataContextString = dataContextString 
						? `${dataContextString}\n\n${calendarContext}`
						: calendarContext;
				}
			} catch (error) {
				console.warn('[ActionSkill] Failed to load calendar context:', error);
				// Continue without calendar context if it fails
			}
		}
		
		// 5. Build function context
		const context = {
			dataContext: dataContextString, // String format for LLM prompt
			rawDataContext: combinedDataContext, // Raw data context including skill-specific context
			skillDataContext: skillDataContext, // Skill-specific data context (for easy access)
			userId,
			agentId
		};
		
		// 6. Execute function handler
		const result = await functionImpl.handler(args || {}, context);
		
		return result;
	} catch (error) {
		console.error('[ActionSkill] Error handling actionSkill:', error);
		return {
			success: false,
			error: error.message || 'Unknown error executing skill'
		};
	}
}

