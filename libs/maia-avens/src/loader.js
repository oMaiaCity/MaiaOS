/**
 * Universal Aven Loader
 * Boots MaiaOS with CoJSON backend, loads aven from account.registries.sparks[spark].avens[avenKey]
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
 * @param {string} avenKey - Key in spark.avens (e.g. 'todos', 'chat')
 * @param {Object} Registry - Aven registry (e.g. TodosAvenRegistry)
 * @param {string[]} [modules=['db','core']] - MaiaOS modules to load
 * @returns {(container: HTMLElement) => Promise<{os: MaiaOS, aven: Object, actor: Object}>}
 */
export function createAvenLoader(avenKey, Registry, modules = ['db', 'core']) {
	return async (container) => {
		console.log(`🚀 Booting MaiaOS for ${avenKey.charAt(0).toUpperCase() + avenKey.slice(1)} Aven...`)
		let os = checkForExistingSession()
		if (os) {
			console.log('ℹ️  Reusing existing MaiaOS session from main app')
		} else {
			console.log('ℹ️  No existing session found, creating new authentication')
			const { node, account } = await signInWithPasskey({ salt: 'maia.city' })
			os = await MaiaOS.boot({ node, account, modules, registry: Registry })
		}
		const { aven, actor } = await os.loadAvenFromAccount(avenKey, container)
		return { os, aven, actor }
	}
}

export { MaiaOS }
