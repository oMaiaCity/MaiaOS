/**
 * Agents Seeding API - Cycle-free entry for moai genesis
 *
 * No dependency on @MaiaOS/loader - safe for static import in bundled moai-server.mjs.
 * Used by loader for getAllAgentRegistries, buildSeedConfig, filterAgentsForSeeding.
 */

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

function getAgentKey(agent) {
	if (!agent) return null
	const originalAgentId = agent.$id || ''
	if (originalAgentId.startsWith('°Maia/agent/')) {
		return originalAgentId.replace('°Maia/agent/', '')
	}
	return (agent.name || 'default').toLowerCase().replace(/\s+/g, '-')
}

const AGENT_SCHEMA = '°Maia/schema/agent'

function normalizeAgentForSeeding(agent) {
	if (!agent || typeof agent !== 'object') {
		throw new Error('[agents] Agent must be a non-null object')
	}
	const key = getAgentKey(agent)
	const normalized = { ...agent }
	if (!normalized.$schema || typeof normalized.$schema !== 'string') {
		normalized.$schema = AGENT_SCHEMA
	}
	if (!normalized.$id || !normalized.$id.startsWith('°Maia/agent/')) {
		normalized.$id = `°Maia/agent/${key}`
	}
	return normalized
}

export async function getAllAgentRegistries() {
	return ALL_REGISTRIES.filter((R) => R?.agent)
}

export function buildSeedConfig(agentRegistries) {
	const validRegistries = agentRegistries.filter((r) => r?.agent && typeof r.agent === 'object')
	if (agentRegistries.length > 0 && validRegistries.length === 0) {
		throw new Error(
			'[agents] All agent manifests invalid (null or not object). Ensure .maia files load as JSON (bunfig.toml: [loader] ".maia" = "json")',
		)
	}
	const merged = {
		styles: {},
		actors: {},
		views: {},
		contexts: {},
		states: {},
		inboxes: {},
		agents: validRegistries.map((r) => normalizeAgentForSeeding(r.agent)),
		data: {},
	}
	for (const registry of agentRegistries) {
		Object.assign(merged.styles, registry.styles || {})
		Object.assign(merged.actors, registry.actors || {})
		Object.assign(merged.views, registry.views || {})
		Object.assign(merged.contexts, registry.contexts || {})
		Object.assign(merged.states, registry.states || {})
		Object.assign(merged.inboxes, registry.inboxes || {})
		Object.assign(merged.data, registry.data || {})
	}
	return { configs: merged, data: merged.data || {} }
}

/** Runtime config (v1: static). Maps runtime type to agents list. */
const RUNTIME_CONFIGS = {
	browser: ['todos', 'chat', 'sparks', 'logs', 'humans'],
}

/**
 * Get runtime config for a given runtime type.
 * @param {string} runtimeType - e.g. 'browser'
 * @returns {{ agents: string[] }} Agent keys for this runtime
 */
export function getRuntimeConfig(runtimeType) {
	const agents = RUNTIME_CONFIGS[runtimeType]
	if (!agents) return { agents: [] }
	return { agents: [...agents] }
}

/**
 * Get union of dependencies for given agent keys.
 * Each agent manifest declares dependencies: actor $ids to watch.
 * @param {string[]} agentKeys - e.g. ['todos', 'chat']
 * @returns {string[]} Deduped union of actor refs
 */
export function getDependenciesForAgents(agentKeys) {
	const registryByKey = new Map()
	for (const r of ALL_REGISTRIES) {
		if (!r?.agent) continue
		const key = getAgentKey(r.agent)
		if (key) registryByKey.set(key, r)
	}
	const union = new Set()
	for (const key of agentKeys) {
		const reg = registryByKey.get(key)
		const deps = reg?.agent?.dependencies
		if (Array.isArray(deps)) {
			for (const ref of deps) union.add(ref)
		}
	}
	return [...union]
}

/**
 * Build a merged map of all actor configs from all agent registries.
 * Genesis seed only (buildSeedConfig). Runtime loads actor config from DB.
 */
export function getAgentActorConfigs() {
	const map = {}
	for (const registry of ALL_REGISTRIES) {
		if (!registry?.actors) continue
		for (const [id, config] of Object.entries(registry.actors)) {
			map[id] = config
		}
	}
	return map
}

export function filterAgentsForSeeding(agentRegistries, config = null) {
	if (config === null || config === undefined || (Array.isArray(config) && config.length === 0)) {
		return []
	}
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
