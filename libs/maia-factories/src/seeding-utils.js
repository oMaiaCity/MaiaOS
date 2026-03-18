/**
 * Shared seeding utilities - used by vibes and actors for config building.
 */

/** Derive inbox namekey from actor $id (same convention as engine). */
export function deriveInboxId(actorId) {
	if (!actorId || typeof actorId !== 'string') return null
	if (actorId.includes('/actor/') && !actorId.startsWith('°Maia/actor/')) {
		return actorId.replace('/actor/', '/inbox/')
	}
	if (actorId.includes('/')) return `${actorId}/inbox`
	return null
}
