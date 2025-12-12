/**
 * System Instruction Builder
 * Builds system instructions for Hominio
 */

import { loadCallConfig } from './call-config-loader.js'

/**
 * Build unified Hominio system instruction
 * @param {Object} options - Additional options (unused, kept for API compatibility)
 * @returns {Promise<string>} - Complete system instruction
 */
export async function buildSystemInstruction(_options = {}) {
	// Load call config
	const callConfig = await loadCallConfig()

	// Return callPrompt from callConfig
	return callConfig.callPrompt
}
