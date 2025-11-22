/**
 * System Instruction Builder
 * Builds system instructions from agent config templates
 * Replaces placeholders with actual values
 */

import { loadDataContext } from './data-context-loader.js';

/**
 * Build system instruction from agent config
 * @param {import('./types.ts').AgentConfig} agentConfig - Agent configuration
 * @param {Object} options - Additional options
 * @param {string} [options.calendarContext] - Calendar context string (for Karl)
 * @returns {Promise<string>} - Complete system instruction
 */
export async function buildSystemInstruction(agentConfig, options = {}) {
	const { calendarContext } = options;
	
	// Build skills description
	const skillsDesc = agentConfig.skills.map((skill) =>
		`- **${skill.name}** (skillId: "${skill.id}"): ${skill.description}`
	).join('\n');
	
	// Load data context
	let dataContextString = await loadDataContext(agentConfig);
	
	// Get examples text from config or use default
	let examplesText = '';
	if (agentConfig.prompts?.examplesText) {
		examplesText = agentConfig.prompts.examplesText;
	} else {
		// Default examples text
		examplesText = 'Wenn der Benutzer nach etwas fragt, verwende die entsprechende skillId mit dem actionSkill-Tool.';
	}
	
	// Format data context with header if present
	let dataContextFormatted = '';
	if (dataContextString) {
		dataContextFormatted = `\nHintergrundwissen:\n${dataContextString}`;
	}
	
	// Add calendar context for Karl if provided
	let calendarContextFormatted = '';
	if (calendarContext) {
		calendarContextFormatted = `\n${calendarContext}`;
	}
	
	// Add current date to context for all agents (useful for relative date calculations)
	const now = new Date();
	const currentDateISO = now.toISOString().split('T')[0];
	const currentDateFormatted = now.toLocaleDateString('de-DE', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	const currentDateContext = `\nAKTUELLES DATUM: ${currentDateFormatted} (${currentDateISO})\nVerwende dieses Datum als Referenz für relative Datumsangaben wie "heute", "morgen", "übermorgen".`;
	
	// Get template from config or use default
	let template = '';
	if (agentConfig.prompts?.systemInstructionTemplate) {
		template = agentConfig.prompts.systemInstructionTemplate;
	} else {
		// Default template
		template = `Du bist {name}, {role}. {description}

Verfügbare Funktionen, die du mit actionSkill ausführen kannst:
{skillsDesc}

{examplesText}

{dataContext}`;
	}
	
	// Replace placeholders
	let instruction = template
		.replace(/{name}/g, agentConfig.name)
		.replace(/{role}/g, agentConfig.role)
		.replace(/{description}/g, agentConfig.description)
		.replace(/{skillsDesc}/g, skillsDesc)
		.replace(/{examplesText}/g, examplesText)
		.replace(/{dataContext}/g, dataContextFormatted)
		.replace(/{calendarContext}/g, calendarContextFormatted);
	
	// Append current date context to all instructions
	instruction += currentDateContext;
	
	return instruction;
}

