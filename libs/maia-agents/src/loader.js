/**
 * Universal Agent Loader
 * Boots MaiaOS with CoJSON backend, loads agent from account.registries.sparks[spark].agents[agentKey]
 * Reuses existing MaiaOS session from main app if available
 */

import { MaiaOS, signInWithPasskey } from '@MaiaOS/loader'

function checkForExistingSession() {
	if (window.maia?.id?.node && window.maia.id.maiaId) return window.maia
	try {
		if (window.parent !== window && window.parent.maia) return window.parent.maia
	} catch (_e) {}
	try {
		if (window.opener?.maia) return window.opener.maia
	} catch (_e) {}
	return null
}

/**
 * @param {string} agentKey - Key in spark.agents (e.g. 'todos', 'chat')
 * @param {Object} Registry - Agent registry (e.g. TodosAgentRegistry)
 * @param {string[]} [modules=['db','core']] - MaiaOS modules to load
 * @returns {(container: HTMLElement) => Promise<{os: MaiaOS, agent: Object, actor: Object}>}
 */
export function createAgentLoader(agentKey, Registry, modules = ['db', 'core']) {
	return async (container) => {
		console.log(
			`🚀 Booting MaiaOS for ${agentKey.charAt(0).toUpperCase() + agentKey.slice(1)} Agent...`,
		)
		let os = checkForExistingSession()
		if (os) {
			console.log('ℹ️  Reusing existing MaiaOS session from main app')
		} else {
			console.log('ℹ️  No existing session found, creating new authentication')
			const { node, account } = await signInWithPasskey({ salt: 'maia.city' })
			os = await MaiaOS.boot({ node, account, modules, registry: Registry })
		}
		const { agent, actor } = await os.loadAgentFromAccount(agentKey, container)
		return { os, agent, actor }
	}
}

export { MaiaOS }
