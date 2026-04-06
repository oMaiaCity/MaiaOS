/**
 * Single factory for "intent" vibes: manifest + shared brand + four intent.*.maia slots.
 */

import { annotateMaiaConfig } from '@MaiaOS/factories/annotate-maia'
import maiacityBrand from './vibes/brand/maiacity.style.maia'

/**
 * @param {object} opts
 * @param {object} opts.vibe - manifest.vibe.maia default export
 * @param {string} opts.idPrefix - Folder under maia/ (e.g. chat, todos, sparks, logs)
 * @param {{ actor: object, context: object, process: object, view: object }} opts.intent
 * @param {object} [opts.data] - Optional seeded data (e.g. todos list)
 */
export function buildIntentVibeRegistry({ vibe, idPrefix, intent, data }) {
	const p = idPrefix
	const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
	const v = annotateMaiaConfig(vibe, `${p}/manifest.vibe.maia`)
	const actor = annotateMaiaConfig(intent.actor, `${p}/intent/intent.actor.maia`)
	const context = annotateMaiaConfig(intent.context, `${p}/intent/intent.context.maia`)
	const view = annotateMaiaConfig(intent.view, `${p}/intent/intent.view.maia`)
	const process = annotateMaiaConfig(intent.process, `${p}/intent/intent.process.maia`)

	const registry = {
		vibe: v,
		styles: {
			[brand.$id]: brand,
		},
		actors: {
			[actor.$id]: actor,
		},
		views: {
			[view.$id]: view,
		},
		contexts: {
			[context.$id]: context,
		},
		processes: {
			[process.$id]: process,
		},
	}
	if (data !== undefined) registry.data = data
	return registry
}
