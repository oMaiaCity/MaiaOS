/**
 * System Instruction Builder
 * Builds system instructions for Hominio (unified assistant)
 * Can optionally include vibe-specific context
 */

import { listVibes } from './vibe-loader.js';
import { loadCallConfig } from './call-config-loader.js';

/**
 * Build unified Hominio system instruction
 * @param {Object} options - Additional options
 * @param {string[]} [options.activeVibeIds] - Currently active vibe IDs
 * @param {Object<string, import('./types.ts').VibeConfig>} [options.vibeConfigs] - Vibe configs to include context from
 * @returns {Promise<string>} - Complete system instruction
 */
export async function buildSystemInstruction(options = {}) {
	const { activeVibeIds = [], vibeConfigs = {}, includeRepeatedPrompt = false } = options;
	
	// Load call config
	const callConfig = await loadCallConfig();
	
	// Get list of available vibes
	const availableVibes = await listVibes();
	
	// Start with callPrompt from callConfig
	let instruction = callConfig.callPrompt;
	
	// Add available vibes list
	instruction += '\n\nDu kannst verschiedene "Vibes" abfragen, um zusätzlichen Kontext und Funktionen zu erhalten:\n';
	for (const vibeId of availableVibes) {
		const vibeConfig = vibeConfigs[vibeId] || await import('./vibe-loader.js').then(m => m.loadVibeConfig(vibeId).catch(() => null));
		if (vibeConfig) {
			instruction += `- **${vibeConfig.name} Vibe** (vibeId: "${vibeId}"): ${vibeConfig.description}\n`;
		}
	}

	// Add available data context schemas from active vibes
	const availableSchemas = new Set();
	for (const vibeId of activeVibeIds) {
		const vibeConfig = vibeConfigs[vibeId];
		if (vibeConfig?.dataContextSchemas) {
			for (const schemaId of vibeConfig.dataContextSchemas) {
				availableSchemas.add(schemaId);
			}
		}
	}
	
	// Data context schemas removed - queryDataContext tool no longer exists

	// Add active vibe prompts if any
	if (activeVibeIds.length > 0) {
		instruction += `\nAktuell aktive Vibes: ${activeVibeIds.join(', ')}\n`;
		
		for (const vibeId of activeVibeIds) {
			const vibeConfig = vibeConfigs[vibeId];
			if (vibeConfig?.vibePrompt) {
				instruction += `\n**${vibeConfig.name} Vibe Kontext:**\n${vibeConfig.vibePrompt}\n`;
			}
		}
	}
	
	// Repeated prompt removed - no longer used
	return instruction;
}

/**
 * Build vibe-specific context string for injection
 * @param {import('./types.ts').VibeConfig} vibeConfig - Vibe configuration
 * @param {Object} options - Additional options (unused, kept for compatibility)
 * @returns {Promise<string>} - Vibe context string
 */
export async function buildVibeContext(vibeConfig, options = {}) {
	// Use the single vibePrompt field from config - pure, no dynamic additions
	// Current date/time is automatically available in context.now
	let context = `**${vibeConfig.name} Vibe Kontext geladen**\n\n`;
	
	if (vibeConfig.vibePrompt) {
		context += vibeConfig.vibePrompt;
	} else {
		// Fallback if vibePrompt not set
		context += `${vibeConfig.description}\n\nVerfügbare Funktionen:\n`;
		context += vibeConfig.skills.map((skill) =>
			`- **${skill.name}** (skillId: "${skill.id}"): ${skill.description}`
		).join('\n');
	}
	
	return context;
}

