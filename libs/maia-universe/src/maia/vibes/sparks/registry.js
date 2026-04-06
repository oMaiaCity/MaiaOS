/**
 * Sparks Vibe Registry
 */

import { buildIntentVibeRegistry } from '../../build-intent-vibe-registry.js'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import sparksVibe from './manifest.vibe.maia'

export const SparksVibeRegistry = buildIntentVibeRegistry({
	vibe: sparksVibe,
	idPrefix: 'sparks',
	intent: {
		actor: intentActor,
		context: intentContext,
		process: intentProcess,
		view: intentView,
	},
})

if (import.meta.hot) {
	import.meta.hot.accept()
}
