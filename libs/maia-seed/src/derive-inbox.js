/**
 * Derive inbox path (relative under actors/) from actor path key.
 * Accepts legacy full refs (°maia/...) or relative paths (os/ai/actor.maia, chat/intent/intent.actor.maia).
 */

export function deriveInboxId(actorPathKey) {
	if (!actorPathKey || typeof actorPathKey !== 'string') return null
	let path = actorPathKey
	if (path.startsWith('°maia/')) path = path.slice('°maia/'.length)
	const lower = path.toLowerCase()
	if (lower.endsWith('intent.actor.maia')) {
		return `${path.slice(0, -'intent.actor.maia'.length)}inbox.maia`
	}
	if (lower.endsWith('/actor.maia')) {
		const dir = path.slice(0, path.lastIndexOf('/'))
		return `${dir}/inbox.maia`
	}
	if (lower.endsWith('.actor.maia')) {
		const dir = path.slice(0, path.lastIndexOf('/'))
		return `${dir}/inbox.maia`
	}
	return null
}
