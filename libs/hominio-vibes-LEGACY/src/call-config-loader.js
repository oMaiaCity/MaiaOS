/**
 * Call Config Loader
 * Loads and processes call configuration (callPrompt)
 */

import callConfigData from '../lib/callConfig.json'

/**
 * Load call config
 * @returns {Promise<Object>} Call config object
 */
export async function loadCallConfig() {
	return callConfigData
}

/**
 * Build initial system instruction (callPrompt only)
 * @returns {Promise<string>} Complete initial system instruction
 */
export async function buildInitialSystemInstruction() {
	const callConfig = await loadCallConfig()
	return callConfig.callPrompt
}
