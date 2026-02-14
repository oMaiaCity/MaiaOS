/**
 * Universal Vibe Loader
 * Boots MaiaOS with CoJSON backend, loads vibe from account.vibes[vibeKey]
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
 * @param {string} vibeKey - Key in account.vibes (e.g. 'todos', 'db')
 * @param {Object} Registry - Vibe registry (e.g. TodosVibeRegistry)
 * @param {string[]} [modules=['db','core']] - MaiaOS modules to load
 * @returns {(container: HTMLElement) => Promise<{os: MaiaOS, vibe: Object, actor: Object}>}
 */
export function createVibeLoader(vibeKey, Registry, modules = ['db', 'core']) {
	return async (container) => {
		console.log(`🚀 Booting MaiaOS for ${vibeKey.charAt(0).toUpperCase() + vibeKey.slice(1)} Vibe...`)
		let os = checkForExistingSession()
		if (os) {
			console.log('ℹ️  Reusing existing MaiaOS session from main app')
		} else {
			console.log('ℹ️  No existing session found, creating new authentication')
			const { node, account } = await signInWithPasskey({ salt: 'maia.city' })
			os = await MaiaOS.boot({ node, account, modules, registry: Registry })
		}
		const { vibe, actor } = await os.loadVibeFromAccount(vibeKey, container)
		return { os, vibe, actor }
	}
}

export { MaiaOS }
