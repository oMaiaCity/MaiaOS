/**
 * Logs Vibe Registry
 */

import { buildIntentVibeRegistry } from '../build-intent-vibe-registry.js'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import logsVibe from './manifest.vibe.maia'

export const LogsVibeRegistry = buildIntentVibeRegistry({
	vibe: logsVibe,
	idPrefix: 'logs',
	intent: {
		actor: intentActor,
		context: intentContext,
		process: intentProcess,
		view: intentView,
	},
	data: {},
})

export { LogsVibeRegistry as LogsAvenRegistry }

if (import.meta.hot) {
	import.meta.hot.accept()
}
