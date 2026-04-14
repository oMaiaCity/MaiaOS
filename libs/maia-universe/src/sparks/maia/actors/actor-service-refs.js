/**
 * Lightweight actor ref helpers — no .maia graph (safe for browser via @MaiaOS/universe/actors).
 * Genesis tables live in maia-universe config/build-seed-config.js.
 */

/** File-path actor $id: intent.actor.maia, *\/actor.maia, or *\/*.actor.maia */
export function isActorFilePathId(ref) {
	if (typeof ref !== 'string' || !ref.startsWith('°maia/')) return false
	const lower = ref.toLowerCase()
	return (
		lower.endsWith('intent.actor.maia') ||
		lower.endsWith('/actor.maia') ||
		lower.endsWith('.actor.maia')
	)
}

/** Resolve actor ref to registry key (file-path actor .maia). */
export function resolveServiceActorCoId(actorRef) {
	if (typeof actorRef !== 'string' || !actorRef.startsWith('°')) return null
	if (isActorFilePathId(actorRef)) return actorRef
	return null
}

/** Map actor $id to primary interface event type (path-based $id). */
export const ACTOR_ID_TO_EVENT_TYPE = {
	'°maia/services/ai/actor.maia': 'CHAT',
	'°maia/services/db/actor.maia': 'DB_OP',
	'°maia/services/names/actor.maia': 'COMPUTE_NAMES',
	'°maia/services/paper/actor.maia': 'UPDATE_PAPER',
	'°maia/services/update-wasm-code/actor.maia': 'UPDATE_WASM_CODE',
	'°maia/views/paper/actor.maia': 'UPDATE_PAPER',
}
