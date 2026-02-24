/**
 * Inbox-by-convention: derive inbox ref (namekey) from actor $id.
 * Used when actor config has no explicit "inbox" key.
 * - maia-actors: °Maia/actor/{path} → °Maia/actor/{path}/inbox (append /inbox)
 * - maia-agents: °Maia/{agent}/actor/intent → °Maia/{agent}/inbox/intent (replace /actor/ with /inbox/)
 * @param {string} actorId - Actor $id (namekey or co-id; derivation only applies to namekeys with /)
 * @returns {string|null} Inbox namekey, or null if actorId has no path (e.g. plain co-id)
 */
export function deriveInboxRef(actorId) {
	if (!actorId || typeof actorId !== 'string') return null
	// Agent pattern: °Maia/chat/actor/intent → °Maia/chat/inbox/intent
	if (actorId.includes('/actor/') && !actorId.startsWith('°Maia/actor/')) {
		return actorId.replace('/actor/', '/inbox/')
	}
	if (actorId.includes('/')) return `${actorId}/inbox`
	return null
}
