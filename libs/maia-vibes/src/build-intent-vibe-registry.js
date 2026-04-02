/**
 * Single factory for "intent" vibes: manifest + shared brand + four intent.*.maia slots.
 */

import maiacityBrand from './brand/maiacity.style.maia'

/**
 * @param {object} opts
 * @param {object} opts.vibe - manifest.vibe.maia default export
 * @param {string} opts.idPrefix - Path segment after °Maia/ (e.g. sparks, registries, logs)
 * @param {{ actor: object, context: object, process: object, view: object }} opts.intent
 * @param {object} [opts.data] - Optional seeded data (e.g. todos list)
 */
export function buildIntentVibeRegistry({ vibe, idPrefix, intent, data }) {
	const base = `°Maia/${idPrefix}`
	const registry = {
		vibe,
		styles: {
			'°Maia/brand/maiacity': maiacityBrand,
		},
		actors: {
			[`${base}/actor/intent`]: intent.actor,
		},
		views: {
			[`${base}/view/intent`]: intent.view,
		},
		contexts: {
			[`${base}/context/intent`]: intent.context,
		},
		processes: {
			[`${base}/process/intent`]: intent.process,
		},
	}
	if (data !== undefined) registry.data = data
	return registry
}
