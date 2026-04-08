/**
 * Derive inbox maia path from actor $id (same convention as engine). File-path refs only.
 */

export function deriveInboxId(actorId) {
	if (!actorId || typeof actorId !== 'string') return null
	const lower = actorId.toLowerCase()
	if (lower.endsWith('intent.actor.maia')) {
		return `${actorId.slice(0, -'intent.actor.maia'.length)}inbox.maia`
	}
	if (lower.endsWith('/actor.maia')) {
		const dir = actorId.slice(0, actorId.lastIndexOf('/'))
		return `${dir}/inbox.maia`
	}
	if (lower.endsWith('.actor.maia')) {
		const dir = actorId.slice(0, actorId.lastIndexOf('/'))
		return `${dir}/inbox.maia`
	}
	return null
}
