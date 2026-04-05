/**
 * Shared seeding utilities - used by vibes and actors for config building.
 */

/** Derive inbox namekey from actor $id (same convention as engine). File-path refs only. */
export function deriveInboxId(actorId) {
	if (!actorId || typeof actorId !== 'string') return null
	const lower = actorId.toLowerCase()
	// File path: .../intent/intent.actor.maia -> .../intent/inbox.maia
	if (lower.endsWith('intent.actor.maia')) {
		return `${actorId.slice(0, -'intent.actor.maia'.length)}inbox.maia`
	}
	// Filename is literally actor.maia (e.g. add-form/actor.maia) -> sibling inbox.maia
	if (lower.endsWith('/actor.maia')) {
		const dir = actorId.slice(0, actorId.lastIndexOf('/'))
		return `${dir}/inbox.maia`
	}
	// Any other *.actor.maia -> sibling inbox.maia
	if (lower.endsWith('.actor.maia')) {
		const dir = actorId.slice(0, actorId.lastIndexOf('/'))
		return `${dir}/inbox.maia`
	}
	return null
}
