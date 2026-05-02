/**
 * Lightweight actor ref helpers — no schema JSON graph (safe for bundled actor metadata).
 * Genesis tables driven by `@AvenOS/universe/helpers/seed/build-seed-config.js`.
 */

/** File-path actor $id: intent.actor.json, *\/actor.json, or *\/*.actor.json */
export function isActorFilePathId(ref) {
	if (typeof ref !== 'string' || !ref.startsWith('°maia/')) return false
	const lower = ref.toLowerCase()
	return (
		lower.endsWith('intent.actor.json') ||
		lower.endsWith('/actor.json') ||
		lower.endsWith('.actor.json')
	)
}

/** Resolve actor ref to registry key (file-path actor *.json). */
export function resolveServiceActorCoId(actorRef) {
	if (typeof actorRef !== 'string' || !actorRef.startsWith('°')) return null
	if (isActorFilePathId(actorRef)) return actorRef
	return null
}

/** Map actor $id to primary interface event type (path-based $id). */
export const ACTOR_ID_TO_EVENT_TYPE = {
	'°maia/services/ai/actor.json': 'CHAT',
	'°maia/services/db/actor.json': 'DB_OP',
	'°maia/services/names/actor.json': 'COMPUTE_NAMES',
	'°maia/services/paper/actor.json': 'UPDATE_PAPER',
	'°maia/services/update-wasm-code/actor.json': 'UPDATE_WASM_CODE',
	'°maia/views/paper/actor.json': 'UPDATE_PAPER',
}
