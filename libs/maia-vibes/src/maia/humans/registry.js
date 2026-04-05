/**
 * Registries Vibe Registry
 */

import { buildIntentVibeRegistry } from '../build-intent-vibe-registry.js'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import registriesVibe from './manifest.vibe.maia'

export const RegistriesVibeRegistry = buildIntentVibeRegistry({
	vibe: registriesVibe,
	idPrefix: 'humans',
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
