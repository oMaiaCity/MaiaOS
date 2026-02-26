/**
 * Universal reference pattern helpers
 * Use spark name as prefix (e.g. °Maia/schema/, °Maia/agent/) - matches account.registries.sparks keys
 */
export const SCHEMA_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/schema\//
export const AGENT_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/agent\//

/** Instance config refs (actor, inbox, tool, view, context, state, style, process) - stored in spark.os.schematas. */
export const INSTANCE_REF_PATTERN =
	/^°[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\/(actor|inbox|tool|view|context|state|style|process)(\/|$)/

/** Actor config refs (°Maia/actor/db) - service actor definition in spark.os.schematas. */
export const ACTOR_CONFIG_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/actor\/[a-zA-Z0-9_-]+$/

/** Agent actor refs (°Maia/todos/actor/intent, °Maia/chat/actor/messages) - agent-scoped actor configs. */
export const AGENT_ACTOR_REF_PATTERN = /^°[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)+\/actor\/[a-zA-Z0-9_-]+$/

export function isSchemaRef(s) {
	return typeof s === 'string' && SCHEMA_REF_PATTERN.test(s)
}

export function isAgentRef(s) {
	return typeof s === 'string' && AGENT_REF_PATTERN.test(s)
}

export function isInstanceRef(s) {
	return typeof s === 'string' && INSTANCE_REF_PATTERN.test(s)
}
