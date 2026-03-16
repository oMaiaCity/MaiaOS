/**
 * Universal reference pattern helpers
 * Use spark name as prefix (e.g. °Maia/factory/, °Maia/vibe/) - matches account.registries.sparks keys
 */
export const FACTORY_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/factory\//
export const VIBE_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/vibe\//

/** Instance config refs (actor, inbox, tool, view, context, state, style, process, wasm) - stored in spark.os.factories. */
export const INSTANCE_REF_PATTERN =
	/^°[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\/(actor|inbox|tool|view|context|state|style|process|wasm)(\/|$)/

/** Actor config refs (°Maia/actor/db) - service actor definition in spark.os.factories. */
export const ACTOR_CONFIG_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/actor\/[a-zA-Z0-9_-]+$/

/** Vibe actor refs (°Maia/todos/actor/intent, °Maia/chat/actor/messages) - vibe-scoped actor configs. */
export const VIBE_ACTOR_REF_PATTERN = /^°[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)+\/actor\/[a-zA-Z0-9_-]+$/

export function isFactoryRef(s) {
	return typeof s === 'string' && FACTORY_REF_PATTERN.test(s)
}

export function isVibeRef(s) {
	return typeof s === 'string' && VIBE_REF_PATTERN.test(s)
}

export function isInstanceRef(s) {
	return typeof s === 'string' && INSTANCE_REF_PATTERN.test(s)
}
