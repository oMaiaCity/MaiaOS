/**
 * Seed config for service actors - contributes actors and states to genesis seed.
 * Merged by moai into buildSeedConfig output; replaces separate tool config.
 * Also includes standalone UI actors (e.g. coming-soon).
 */

import comingSoonActor from './library/comingSoon/actor.maia'
import comingSoonContext from './library/comingSoon/context.maia'
import comingSoonInbox from './library/comingSoon/inbox.maia'
import comingSoonProcess from './library/comingSoon/process.maia'
import comingSoonStyle from './library/comingSoon/style.maia'
import comingSoonView from './library/comingSoon/view.maia'
import aiChatActor from './os/ai/actor.maia'
import aiChatProcess from './os/ai/process.maia'
import aiChatTool from './os/ai/tool.maia'
import dbActor from './os/db/actor.maia'
import dbProcess from './os/db/process.maia'
import dbTool from './os/db/tool.maia'
import computeMessageNamesActor from './os/names/actor.maia'
import computeMessageNamesProcess from './os/names/process.maia'
import computeMessageNamesTool from './os/names/tool.maia'
import updatePaperContentActor from './os/paper/actor.maia'
import updatePaperContentProcess from './os/paper/process.maia'
import updatePaperContentTool from './os/paper/tool.maia'
import sparksActor from './os/spark/actor.maia'
import sparksProcess from './os/spark/process.maia'
import sparksTool from './os/spark/tool.maia'

/** Map role to folder name for consistent °Maia/actor/{folder} $ids */
export const ROLE_TO_FOLDER = {
	'@maia/actor/os/ai': 'os/ai',
	'@maia/actor/os/db': 'os/db',
	'@maia/actor/os/names': 'os/names',
	'@maia/actor/os/paper': 'os/paper',
	'@maia/actor/os/spark': 'os/spark',
	'@maia/actor/coming-soon': 'coming-soon',
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
	'°Maia/actor/os/ai': 'CHAT',
	'°Maia/actor/os/db': 'DB_OP',
	'°Maia/actor/os/names': 'COMPUTE_NAMES',
	'°Maia/actor/os/paper': 'UPDATE_PAPER',
	'°Maia/actor/os/spark': 'SPARK_OP',
}

/** Build actor config for seeding - uses actor schema */
function toActorConfig(raw, inboxId) {
	const { role, interface: iface, process: processRef, tool } = raw
	if (!role || !iface || !processRef) return null
	const folder = ROLE_TO_FOLDER[role] ?? role.replace('@', '').replace(/\//g, '-')
	return {
		$schema: '°Maia/schema/actor',
		$id: `°Maia/actor/${folder}`,
		role,
		interface: iface,
		process: processRef,
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
		[aiChatActor, aiChatProcess, aiChatTool],
		[computeMessageNamesActor, computeMessageNamesProcess, computeMessageNamesTool],
		[dbActor, dbProcess, dbTool],
		[sparksActor, sparksProcess, sparksTool],
		[updatePaperContentActor, updatePaperContentProcess, updatePaperContentTool],
	]

	const actors = {}
	const processes = {}
	const tools = {}
	const inboxes = {}

	for (const [actorDef, processDef, toolDef] of actorDefs) {
		const folder =
			ROLE_TO_FOLDER[actorDef?.role] ?? actorDef?.role?.replace('@', '')?.replace(/\//g, '-')
		const inboxId = `°Maia/actor/${folder}/inbox`
		const actorConfig = toActorConfig(actorDef, inboxId)
		if (!actorConfig) continue
		const processId = processDef?.$id || actorDef?.process
		if (!processId) continue
		actors[actorConfig.$id] = actorConfig
		processes[processId] = processDef
		if (toolDef?.$id) tools[toolDef.$id] = toolDef
		inboxes[inboxId] = toInboxConfig(folder)
	}

	// Standalone UI actors (process-based, no state/function)
	const uiActors = [
		{
			actor: comingSoonActor,
			context: comingSoonContext,
			view: comingSoonView,
			process: comingSoonProcess,
			style: comingSoonStyle,
			inbox: comingSoonInbox,
		},
	]
	const uiContexts = {}
	const uiViews = {}
	const uiProcesses = {}
	const uiStyles = {}
	for (const { actor, context, view, process, style, inbox } of uiActors) {
		if (actor?.$id) actors[actor.$id] = actor
		if (context?.$id) uiContexts[context.$id] = context
		if (view?.$id) uiViews[view.$id] = view
		if (process?.$id) uiProcesses[process.$id] = process
		if (style?.$id) uiStyles[style.$id] = style
		if (inbox?.$id) inboxes[inbox.$id] = inbox
	}

	// Merge service actor processes with UI processes
	const allProcesses = { ...processes, ...uiProcesses }

	return {
		actors,
		processes: allProcesses,
		tools,
		inboxes,
		contexts: uiContexts,
		views: uiViews,
		styles: uiStyles,
	}
}
