/**
 * Universal reference pattern helpers
 * Use spark name as prefix (e.g. °Maia/schema/, °Maia/aven/) - matches account.registries.sparks keys
 */
export const SCHEMA_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/schema\//
export const AVEN_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/aven\//

/** Instance config refs (actor, inbox, tool, view, context, state, style, process, wasm) - stored in spark.os.schematas. */
export const INSTANCE_REF_PATTERN =
	/^°[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\/(actor|inbox|tool|view|context|state|style|process|wasm)(\/|$)/

/** Actor config refs (°Maia/actor/db) - service actor definition in spark.os.schematas. */
export const ACTOR_CONFIG_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/actor\/[a-zA-Z0-9_-]+$/

/** Aven actor refs (°Maia/todos/actor/intent, °Maia/chat/actor/messages) - aven-scoped actor configs. */
export const AVEN_ACTOR_REF_PATTERN = /^°[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)+\/actor\/[a-zA-Z0-9_-]+$/

export function isSchemaRef(s) {
	return typeof s === 'string' && SCHEMA_REF_PATTERN.test(s)
}

export function isAvenRef(s) {
	return typeof s === 'string' && AVEN_REF_PATTERN.test(s)
}

export function isInstanceRef(s) {
	return typeof s === 'string' && INSTANCE_REF_PATTERN.test(s)
}
