/**
 * MaiaOS Agents Package
 *
 * This package contains agent configurations (.maia files) for MaiaOS applications.
 *
 * Exports:
 * - @MaiaOS/agents/todos/loader - Loader for the Todos agent
 * - @MaiaOS/agents/todos/registry - Registry for Todos agent configs
 */

export { MaiaOS } from '@MaiaOS/loader'
export { loadSparksAgent, SparksAgentRegistry } from './sparks/loader.js'
export { SparksAgentRegistry as SparksRegistry } from './sparks/registry.js'
export { loadTodosAgent, TodosAgentRegistry } from './todos/loader.js'
export { TodosAgentRegistry as TodosRegistry } from './todos/registry.js'

import { ChatAgentRegistry } from './chat/registry.js'
import { LogsAgentRegistry } from './creator/registry.js'
import { HumansAgentRegistry } from './humans/registry.js'
import { SparksAgentRegistry } from './sparks/registry.js'
import { TodosAgentRegistry } from './todos/registry.js'

const ALL_REGISTRIES = [
	TodosAgentRegistry,
	ChatAgentRegistry,
	SparksAgentRegistry,
	LogsAgentRegistry,
	HumansAgentRegistry,
]

/**
 * Return all agent registries (statically imported - no runtime fetch).
 * @returns {Promise<Array>} Array of agent registry objects
 */
export async function getAllAgentRegistries() {
	return ALL_REGISTRIES.filter((R) => R?.agent)
}

/**
 * Extract agent key from agent object
 * @param {Object} agent - Agent object with $id or name property
 * @returns {string} Agent key (e.g., "todos" from "°Maia/agent/todos")
 */
export function getAgentKey(agent) {
	if (!agent) return null
	const originalAgentId = agent.$id || ''
	if (originalAgentId.startsWith('°Maia/agent/')) {
		return originalAgentId.replace('°Maia/agent/', '')
	}
	return (agent.name || 'default').toLowerCase().replace(/\s+/g, '-')
}

export { buildSeedConfig } from './seeding.js'

/**
 * Filter agent registries based on seeding configuration
 *
 * @param {Array} agentRegistries - Array of agent registry objects
 * @param {string|Array|null} config - Seeding configuration:
 *   - `null` or `undefined` or `[]` = no agents (default)
 *   - `"all"` = all agents
 *   - `["todos", "chat"]` = specific agents by key
 * @returns {Array} Filtered array of agent registries
 */
export function filterAgentsForSeeding(agentRegistries, config = null) {
	// Default: no agents
	if (config === null || config === undefined || (Array.isArray(config) && config.length === 0)) {
		return []
	}

	// "all" = all agents
	if (config === 'all') {
		return agentRegistries
	}

	if (Array.isArray(config)) {
		const configKeys = config.map((k) => k.toLowerCase().trim())
		return agentRegistries.filter((registry) => {
			if (!registry.agent) return false
			const agentKey = getAgentKey(registry.agent)
			return configKeys.includes(agentKey)
		})
	}
	return []
}

export { getAgentActorConfigs, getDependenciesForAgents, getRuntimeConfig } from './seeding.js'
