/**
 * Agents Index - Central export for all agents
 * Import and register agents here
 */

export * from './registry'
export * from './tom'
export * from './types'

import { registerAgentsFromConfig } from './registry'
// Import all agent modules
import { tomAgentConfig } from './tom'

// ========== AUTO-REGISTER ALL AGENTS ==========

/**
 * Register all available agents
 * This can be called on app initialization
 */
export function registerAllAgents(): void {
	registerAgentsFromConfig({
		'@Tom': tomAgentConfig,
		// Add more agent registrations here as they're created
	})
}
