/**
 * Derive inbox path (relative under actors/) from actor path key.
 * Accepts legacy full refs (°maia/...) or relative paths (os/ai/actor.maia, chat/intent/intent.actor.maia).
 */

export function deriveInboxId(actorPathKey) {
	if (!actorPathKey || typeof actorPathKey !== 'string') return null
	const lower = actorPathKey.toLowerCase()
	if (lower.endsWith('intent.actor.maia')) {
		return `${actorPathKey.slice(0, -'intent.actor.maia'.length)}inbox.maia`
	}
	if (lower.endsWith('/actor.maia')) {
		const dir = actorPathKey.slice(0, actorPathKey.lastIndexOf('/'))
		return `${dir}/inbox.maia`
	}
	if (lower.endsWith('.actor.maia')) {
		const dir = actorPathKey.slice(0, actorPathKey.lastIndexOf('/'))
		return `${dir}/inbox.maia`
	}
	return null
}
