/**
 * Seed config for service actors - contributes actors and states to genesis seed.
 * Merged by moai into buildSeedConfig output; replaces separate tool config.
 */

import aiChatActor from './aiChat/aiChat.actor.maia'
import aiChatState from './aiChat/aiChat.state.maia'
import aiChatTool from './aiChat/aiChat.tool.maia'
import computeMessageNamesActor from './computeMessageNames/computeMessageNames.actor.maia'
import computeMessageNamesState from './computeMessageNames/computeMessageNames.state.maia'
import computeMessageNamesTool from './computeMessageNames/computeMessageNames.tool.maia'
import dbActor from './db/db.actor.maia'
import dbState from './db/db.state.maia'
import dbTool from './db/db.tool.maia'
import sparksActor from './sparks/sparks.actor.maia'
import sparksState from './sparks/sparks.state.maia'
import sparksTool from './sparks/sparks.tool.maia'
import updatePaperContentActor from './updatePaperContent/updatePaperContent.actor.maia'
import updatePaperContentState from './updatePaperContent/updatePaperContent.state.maia'
import updatePaperContentTool from './updatePaperContent/updatePaperContent.tool.maia'

/** Map role to folder name for consistent °Maia/actor/{folder} $ids */
export const ROLE_TO_FOLDER = {
	'@ai/chat': 'aiChat',
	'@core/updatePaperContent': 'updatePaperContent',
	'@core/computeMessageNames': 'computeMessageNames',
	'@db/db': 'db',
	'@db': 'db',
	'@sparks': 'sparks',
}

/** Resolve actor ref to registry key. Only accepts °Maia/actor/... $ids (id-based lookup). */
export function resolveServiceActorCoId(actorRef) {
	if (typeof actorRef === 'string' && actorRef.startsWith('°') && actorRef.includes('/actor/')) {
		return actorRef
	}
	return null
}

/** Map actor $id to primary interface event type. Id-based only (°Maia/actor/...). */
export const ACTOR_ID_TO_EVENT_TYPE = {
	'°Maia/actor/aiChat': 'CHAT',
	'°Maia/actor/updatePaperContent': 'UPDATE_PAPER',
	'°Maia/actor/computeMessageNames': 'COMPUTE_NAMES',
	'°Maia/actor/db': 'DB_OP',
	'°Maia/actor/sparks': 'SPARK_OP',
}

/** Build actor config for seeding - uses actor schema */
function toActorConfig(raw, inboxId) {
	const { role, interface: iface, state, tool } = raw
	if (!role || !iface || !state) return null
	const folder = ROLE_TO_FOLDER[role] ?? role.replace('@', '').replace(/\//g, '-')
	return {
		$schema: '°Maia/schema/actor',
		$id: `°Maia/actor/${folder}`,
		role,
		interface: iface,
		state,
		tool: tool || null,
		view: null,
		context: null,
		inbox: inboxId || null,
	}
}

/** Build inbox config for seeding - one CoStream per service actor */
function toInboxConfig(folder) {
	return {
		$schema: '°Maia/schema/inbox',
		$id: `°Maia/actor/${folder}/inbox`,
		cotype: 'costream',
	}
}

/**
 * Seed config for all service actors.
 * Merge into mergedConfigs.actors, mergedConfigs.states, mergedConfigs.inboxes before seed.
 * Inboxes must be seeded before actors (actor config references inbox).
 */
export function getSeedConfig() {
	const actorDefs = [
		[aiChatActor, aiChatState, aiChatTool],
		[computeMessageNamesActor, computeMessageNamesState, computeMessageNamesTool],
		[dbActor, dbState, dbTool],
		[sparksActor, sparksState, sparksTool],
		[updatePaperContentActor, updatePaperContentState, updatePaperContentTool],
	]

	const actors = {}
	const states = {}
	const tools = {}
	const inboxes = {}

	for (const [actorDef, stateDef, toolDef] of actorDefs) {
		const folder =
			ROLE_TO_FOLDER[actorDef?.role] ?? actorDef?.role?.replace('@', '')?.replace(/\//g, '-')
		const inboxId = `°Maia/actor/${folder}/inbox`
		const actorConfig = toActorConfig(actorDef, inboxId)
		if (!actorConfig) continue
		const stateId = stateDef?.$id || actorDef?.state
		if (!stateId) continue
		actors[actorConfig.$id] = actorConfig
		states[stateId] = stateDef
		if (toolDef?.$id) tools[toolDef.$id] = toolDef
		inboxes[inboxId] = toInboxConfig(folder)
	}

	return { actors, states, tools, inboxes }
}
