/**
 * Agent Registry - Central registry for all agents
 * Manages agent configurations and their tool associations
 */

import type { AgentConfig } from './types'

class AgentRegistryImpl {
	private agents: Map<string, AgentConfig> = new Map()

	/**
	 * Register an agent
	 */
	register(agent: AgentConfig): void {
		if (this.agents.has(agent.id)) {
		}
		this.agents.set(agent.id, agent)
	}

	/**
	 * Register multiple agents at once
	 */
	registerAll(agents: AgentConfig[]): void {
		agents.forEach((agent) => this.register(agent))
	}

	/**
	 * Get an agent by ID
	 */
	get(id: string): AgentConfig | undefined {
		return this.agents.get(id)
	}

	/**
	 * Get all registered agents
	 */
	getAll(): AgentConfig[] {
		return Array.from(this.agents.values())
	}

	/**
	 * Get skills for a specific agent
	 */
	getAgentSkills(agentId: string): string[] {
		const agent = this.get(agentId)
		return agent?.skills || []
	}

	/**
	 * Check if an agent exists
	 */
	has(agentId: string): boolean {
		return this.agents.has(agentId)
	}
}

// ========== GLOBAL AGENT REGISTRY INSTANCE ==========

/**
 * Global agent registry instance
 */
export const agentRegistry = new AgentRegistryImpl()

/**
 * Register agents from a config object
 */
export function registerAgentsFromConfig(agents: Record<string, AgentConfig>): void {
	Object.values(agents).forEach((agent) => {
		agentRegistry.register(agent)
	})
}
