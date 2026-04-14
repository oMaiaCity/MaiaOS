/**
 * Derive inbox path (relative under spark maia/) from actor spark-relative path key.
 * Input: same convention as {@link maiaIdentity} — path under spark root, no `°`, no `maia/` prefix
 * (e.g. services/ai/actor.maia, chat/intent/intent.actor.maia).
 */

export function deriveInboxId(actorPathKey) {
	if (!actorPathKey || typeof actorPathKey !== 'string') return null
	const path = actorPathKey.trim().replace(/^\/+/, '')
	if (path.startsWith('°') || path.startsWith('maia/')) return null
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
