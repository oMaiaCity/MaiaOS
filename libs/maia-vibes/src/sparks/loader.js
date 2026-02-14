/**
 * Sparks Vibe Loader
 * Loads the Sparks vibe registry
 */

import { MaiaOS } from '@MaiaOS/loader'
import { SparksVibeRegistry } from './registry.js'

/**
 * Load Sparks vibe
 * @param {MaiaOS} maia - MaiaOS instance
 * @param {HTMLElement} container - Container element
 * @returns {Promise<Object>} Vibe metadata and actor instance
 */
export async function loadSparksVibe(maia, container) {
	if (!maia || !container) {
		throw new Error('[SparksVibe] MaiaOS instance and container required')
	}

	// Load vibe from registry
	const vibe = SparksVibeRegistry.vibe
	if (!vibe) {
		throw new Error('[SparksVibe] Vibe not found in registry')
	}

	// Load actor from registry
	const actorConfig = SparksVibeRegistry.actors[vibe.actor]
	if (!actorConfig) {
		throw new Error(`[SparksVibe] Actor ${vibe.actor} not found in registry`)
	}

	// Create actor instance
	const actor = await maia.actors.create(actorConfig, container)

	return {
		vibe,
		actor,
	}
}

export { SparksVibeRegistry }
