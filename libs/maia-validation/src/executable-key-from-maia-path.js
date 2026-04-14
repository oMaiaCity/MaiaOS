/**
 * Derives native JS dispatch key from °maia/... $label (file-path refs only).
 */

/**
 * @param {string} maiaPath - $label (same as pre-seed $id from annotateMaiaConfig)
 * @returns {string|null}
 */
export function executableKeyFromMaiaPath(maiaPath) {
	if (typeof maiaPath !== 'string' || !maiaPath.startsWith('°')) return null
	const norm = maiaPath.slice(1).toLowerCase().replace(/\\/g, '/')

	// maia/<vibe>/intent/intent.actor.maia -> <vibe>/intent
	const intentRoot = /^maia\/([^/]+)\/intent\/intent\.actor\.maia$/.exec(norm)
	if (intentRoot) return `${intentRoot[1]}/intent`

	// maia/.../something.actor.maia (for-list, for-chat, etc.) -> maia/.../something
	const dottedActor = /^maia\/(.+)\/([^/.]+)\.actor\.maia$/.exec(norm)
	if (dottedActor) return `maia/${dottedActor[1]}/${dottedActor[2]}`

	// maia/<...>/actor.maia -> maia/<...>  (service actors: os/ai/actor.maia)
	const actorMaia = /^maia\/(.+)\/actor\.maia$/.exec(norm)
	if (actorMaia) return `maia/${actorMaia[1]}`

	if (norm.startsWith('maia/')) return norm
	return norm
}
