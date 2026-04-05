/**
 * Attach identity from file path to imported .maia JSON (no hardcoded $id in files).
 */

import { maiaRefFromPathKey, nanoidFromPath, normalizeMaiaPathKey } from './nanoid.js'

/**
 * @param {object} raw - Parsed .maia object
 * @param {string} pathKey - Path relative to package src/maia/, e.g. "chat/intent/intent.actor.maia"
 * @returns {object} raw + $id + $label + $nanoid + maiaPathKey
 */
export function annotateMaiaConfig(raw, pathKey) {
	if (!raw || typeof raw !== 'object') {
		throw new Error('[annotateMaia] raw config required')
	}
	const fullKey = pathKey.includes('maia/') ? pathKey : `maia/${pathKey.replace(/^\/+/, '')}`
	const normalized = normalizeMaiaPathKey(fullKey)
	const ref = maiaRefFromPathKey(fullKey)
	const nanoid = nanoidFromPath(fullKey)
	return {
		...raw,
		$id: ref,
		$label: ref,
		$nanoid: nanoid,
		maiaPathKey: normalized,
	}
}
