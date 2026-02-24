/**
 * Seed config for service actors - contributes actors and states to genesis seed.
 * Merged by moai into buildSeedConfig output; replaces separate tool config.
 * Also includes standalone UI actors (e.g. coming-soon).
 */

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
import detailActor from './services/detail/actor.maia'
import detailContext from './services/detail/context.maia'
import detailInbox from './services/detail/inbox.maia'
import detailProcess from './services/detail/process.maia'
import detailView from './services/detail/view.maia'
import listActor from './services/list/actor.maia'
import listContext from './services/list/context.maia'
import listInbox from './services/list/inbox.maia'
import listProcess from './services/list/process.maia'
import listView from './services/list/view.maia'
import logsActor from './services/logs/actor.maia'
import logsContext from './services/logs/context.maia'
import logsInbox from './services/logs/inbox.maia'
import logsProcess from './services/logs/process.maia'
import logsView from './services/logs/view.maia'
import messagesActor from './services/messages/actor.maia'
import messagesContext from './services/messages/context.maia'
import messagesInbox from './services/messages/inbox.maia'
import messagesProcess from './services/messages/process.maia'
import messagesView from './services/messages/view.maia'
import comingSoonActor from './views/comingSoon/actor.maia'
import comingSoonContext from './views/comingSoon/context.maia'
import comingSoonInbox from './views/comingSoon/inbox.maia'
import comingSoonProcess from './views/comingSoon/process.maia'
import comingSoonStyle from './views/comingSoon/style.maia'
import comingSoonView from './views/comingSoon/view.maia'

/** Map role to folder name for consistent °Maia/actor/{folder} $ids */
export const ROLE_TO_FOLDER = {
	'@maia/actor/os/ai': 'os/ai',
	'@maia/actor/os/db': 'os/db',
	'@maia/actor/os/names': 'os/names',
	'@maia/actor/os/paper': 'os/paper',
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

	// View actors (UI components)
	const viewActors = [
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
	for (const { actor, context, view, process, style, inbox } of viewActors) {
		if (actor?.$id) actors[actor.$id] = actor
		if (context?.$id) uiContexts[context.$id] = context
		if (view?.$id) uiViews[view.$id] = view
		if (process?.$id) uiProcesses[process.$id] = process
		if (style?.$id) uiStyles[style.$id] = style
		if (inbox?.$id) inboxes[inbox.$id] = inbox
	}

	// Service actors (messages, logs, list, detail)
	const serviceActors = [
		{
			actor: messagesActor,
			context: messagesContext,
			view: messagesView,
			process: messagesProcess,
			inbox: messagesInbox,
		},
		{
			actor: logsActor,
			context: logsContext,
			view: logsView,
			process: logsProcess,
			inbox: logsInbox,
		},
		{
			actor: listActor,
			context: listContext,
			view: listView,
			process: listProcess,
			inbox: listInbox,
		},
		{
			actor: detailActor,
			context: detailContext,
			view: detailView,
			process: detailProcess,
			inbox: detailInbox,
		},
	]
	for (const { actor, context, view, process: proc, inbox: inboxCfg } of serviceActors) {
		if (actor?.$id) actors[actor.$id] = actor
		if (context?.$id) uiContexts[context.$id] = context
		if (view?.$id) uiViews[view.$id] = view
		if (proc?.$id) uiProcesses[proc.$id] = proc
		if (inboxCfg?.$id) inboxes[inboxCfg.$id] = inboxCfg
	}

	// Merge all processes
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
