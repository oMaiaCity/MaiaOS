/**
 * Vibe Creator Loader
 * Boots MaiaOS with CoJSON backend, loads vibe from account.vibes.vibe-creator
 */

import { MaiaOS, signInWithPasskey } from '@MaiaOS/kernel'
import { VibeCreatorVibeRegistry } from './registry.js'

/**
 * Load and boot the Vibe Creator vibe
 * @param {HTMLElement} container - Container element to render into
 * @returns {Promise<{os: MaiaOS, vibe: Object, actor: Object}>}
 */
export async function loadVibeCreatorVibe(container) {
	console.log('🚀 Booting MaiaOS for Vibe Creator Vibe...')

	let os
	const checkForExistingSession = () => {
		if (window.maia?.id?.node && window.maia.id.maiaId) {
			return window.maia
		}
		try {
			if (window.parent && window.parent !== window && window.parent.maia) {
				return window.parent.maia
			}
		} catch (_e) {}
		try {
			if (window.opener?.maia) {
				return window.opener.maia
			}
		} catch (_e) {}
		return null
	}

	const existingSession = checkForExistingSession()
	if (existingSession) {
		console.log('ℹ️  Reusing existing MaiaOS session from main app')
		os = existingSession
	} else {
		console.log('ℹ️  No existing session found, creating new authentication')
		const { node, account } = await signInWithPasskey({ salt: 'maia.city' })
		os = await MaiaOS.boot({
			node,
			account,
			modules: ['db', 'core'],
			registry: VibeCreatorVibeRegistry,
		})
	}

	const { vibe, actor } = await os.loadVibeFromAccount('vibe-creator', container)

	return { os, vibe, actor }
}

export { MaiaOS, VibeCreatorVibeRegistry }
