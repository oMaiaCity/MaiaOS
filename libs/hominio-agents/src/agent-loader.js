/**
 * Agent Config Loader
 * Loads agent configuration from JSON files
 * Browser-compatible: Uses direct imports
 */

// Import configs directly - Vite will bundle them
import charlesConfig from '../lib/agents/charles/config.json';

const agentConfigs = {
	charles: charlesConfig
};

/**
 * Load agent configuration
 * @param {string} agentId - Agent ID (e.g., 'charles')
 * @returns {Promise<import('./types.ts').AgentConfig>}
 */
export async function loadAgentConfig(agentId) {
	try {
		const config = agentConfigs[agentId];
		
		if (!config) {
			throw new Error(`Agent config not found: ${agentId}`);
		}
		
		// Validate required fields
		if (!config.id || !config.name || !config.skills) {
			throw new Error(`Invalid agent config: missing required fields`);
		}
		
		return config;
	} catch (error) {
		throw new Error(`Failed to load agent config: ${agentId} - ${error.message}`);
	}
}

/**
 * Get all available agent IDs
 * @returns {Promise<string[]>}
 */
export async function listAgents() {
	// For now, return hardcoded list
	// Later can scan lib/agents directory
	return ['charles'];
}

