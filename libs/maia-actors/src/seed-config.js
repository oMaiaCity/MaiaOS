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
import detailActor from './services/detail/actor.maia'
import detailContext from './services/detail/context.maia'
import detailProcess from './services/detail/process.maia'
import detailView from './services/detail/view.maia'
import listActor from './services/list/actor.maia'
import listContext from './services/list/context.maia'
import listStyle from './services/list/list.style.maia'
import listProcess from './services/list/process.maia'
import listView from './services/list/view.maia'
import logsActor from './services/logs/actor.maia'
import logsContext from './services/logs/context.maia'
import logsStyle from './services/logs/logs.style.maia'
import logsProcess from './services/logs/process.maia'
import logsView from './services/logs/view.maia'
import messagesActor from './services/messages/actor.maia'
import messagesContext from './services/messages/context.maia'
import messagesProcess from './services/messages/process.maia'
import messagesView from './services/messages/view.maia'
import paperActor from './services/paper/actor.maia'
import paperContext from './services/paper/context.maia'
import paperProcess from './services/paper/process.maia'
import paperTool from './services/paper/tool.maia'
import paperView from './services/paper/view.maia'
import comingSoonActor from './views/comingSoon/actor.maia'
import comingSoonContext from './views/comingSoon/context.maia'
import comingSoonProcess from './views/comingSoon/process.maia'
import comingSoonStyle from './views/comingSoon/style.maia'
import comingSoonView from './views/comingSoon/view.maia'
import layoutSparksActor from './views/formWithSplit/actor.maia'
import layoutSparksContext from './views/formWithSplit/context.maia'
import layoutSparksProcess from './views/formWithSplit/process.maia'
import formWithSplitStyle from './views/formWithSplit/style.maia'
import formWithSplitView from './views/formWithSplit/view.maia'
import layoutHumansActor from './views/grid/actor.maia'
import layoutHumansContext from './views/grid/context.maia'
import layoutHumansProcess from './views/grid/process.maia'
import gridStyle from './views/grid/style.maia'
import gridView from './views/grid/view.maia'
import layoutCreatorActor from './views/headerWithViewSwitcher/actor-creator.maia'
import layoutTodosActor from './views/headerWithViewSwitcher/actor-todos.maia'
import layoutCreatorContext from './views/headerWithViewSwitcher/context-creator.maia'
import layoutTodosContext from './views/headerWithViewSwitcher/context-todos.maia'
import layoutCreatorProcess from './views/headerWithViewSwitcher/process-creator.maia'
import layoutTodosProcess from './views/headerWithViewSwitcher/process-todos.maia'
import headerWithViewSwitcherStyle from './views/headerWithViewSwitcher/style.maia'
import headerWithViewSwitcherView from './views/headerWithViewSwitcher/view.maia'
import layoutChatActor from './views/modalChat/actor.maia'
import layoutChatContext from './views/modalChat/context.maia'
import layoutChatProcess from './views/modalChat/process.maia'
import modalChatView from './views/modalChat/view.maia'

/** Map role to folder name for consistent °Maia/actor/{folder} $ids */
export const ROLE_TO_FOLDER = {
	'@maia/actor/os/ai': 'os/ai',
	'@maia/actor/os/db': 'os/db',
	'@maia/actor/os/names': 'os/names',
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
	'°Maia/actor/services/paper': 'UPDATE_PAPER',
}

/** Build actor config for seeding - uses actor schema */
function toActorConfig(raw, inboxId) {
	const label = raw['@label']
	const { interface: iface, process: processRef, tool } = raw
	if (!label || !iface || !processRef) return null
	const folder = ROLE_TO_FOLDER[label] ?? label.replace('@', '').replace(/\//g, '-')
	return {
		$schema: '°Maia/schema/actor',
		$id: `°Maia/actor/${folder}`,
		'@label': label,
		interface: iface,
		process: processRef,
		tool: tool || null,
		view: null,
		context: null,
		inbox: inboxId || null,
	}
}

/** Derive inbox namekey from actor $id (same convention as engine). */
function deriveInboxId(actorId) {
	if (!actorId || typeof actorId !== 'string') return null
	if (actorId.includes('/actor/') && !actorId.startsWith('°Maia/actor/')) {
		return actorId.replace('/actor/', '/inbox/')
	}
	if (actorId.includes('/')) return `${actorId}/inbox`
	return null
}

/** Build minimal inbox config for seeding - cotype comes from schema. */
function toInboxConfig(inboxId) {
	return {
		$schema: '°Maia/schema/inbox',
		$id: inboxId,
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
	]

	const actors = {}
	const processes = {}
	const tools = {}
	const inboxes = {}

	for (const [actorDef, processDef, toolDef] of actorDefs) {
		const actorConfig = toActorConfig(actorDef, null)
		if (!actorConfig) continue
		const inboxId = deriveInboxId(actorConfig.$id)
		if (!inboxId) continue
		actorConfig.inbox = inboxId
		const processId = processDef?.$id || actorDef?.process
		if (!processId) continue
		actors[actorConfig.$id] = actorConfig
		processes[processId] = processDef
		if (toolDef?.$id) tools[toolDef.$id] = toolDef
		inboxes[inboxId] = toInboxConfig(inboxId)
	}

	// View actors (UI components)
	const viewActors = [
		{
			actor: comingSoonActor,
			context: comingSoonContext,
			view: comingSoonView,
			process: comingSoonProcess,
			style: comingSoonStyle,
		},
		{
			actor: layoutTodosActor,
			context: layoutTodosContext,
			view: headerWithViewSwitcherView,
			process: layoutTodosProcess,
			style: headerWithViewSwitcherStyle,
		},
		{
			actor: layoutCreatorActor,
			context: layoutCreatorContext,
			view: headerWithViewSwitcherView,
			process: layoutCreatorProcess,
			style: headerWithViewSwitcherStyle,
		},
		{
			actor: layoutSparksActor,
			context: layoutSparksContext,
			view: formWithSplitView,
			process: layoutSparksProcess,
			style: formWithSplitStyle,
		},
		{
			actor: layoutHumansActor,
			context: layoutHumansContext,
			view: gridView,
			process: layoutHumansProcess,
			style: gridStyle,
		},
		{
			actor: layoutChatActor,
			context: layoutChatContext,
			view: modalChatView,
			process: layoutChatProcess,
		},
	]
	const uiContexts = {}
	const uiViews = {}
	const uiProcesses = {}
	const uiStyles = {}
	for (const { actor, context, view, process, style } of viewActors) {
		if (actor?.$id) {
			const config = { ...actor }
			const inboxId = deriveInboxId(config.$id)
			if (inboxId) {
				config.inbox = inboxId
				inboxes[inboxId] = toInboxConfig(inboxId)
			}
			actors[config.$id] = config
		}
		if (context?.$id) uiContexts[context.$id] = context
		if (view?.$id) uiViews[view.$id] = view
		if (process?.$id) uiProcesses[process.$id] = process
		if (style?.$id) uiStyles[style.$id] = style
	}

	// Service actors (messages, logs, list, detail, paper)
	const serviceActors = [
		{
			actor: paperActor,
			context: paperContext,
			view: paperView,
			process: paperProcess,
			tool: paperTool,
		},
		{
			actor: messagesActor,
			context: messagesContext,
			view: messagesView,
			process: messagesProcess,
		},
		{
			actor: logsActor,
			context: logsContext,
			view: logsView,
			process: logsProcess,
			style: logsStyle,
		},
		{
			actor: listActor,
			context: listContext,
			view: listView,
			process: listProcess,
			style: listStyle,
		},
		{
			actor: detailActor,
			context: detailContext,
			view: detailView,
			process: detailProcess,
		},
	]
	for (const {
		actor,
		context,
		view,
		process: proc,
		style: styleCfg,
		tool: toolCfg,
	} of serviceActors) {
		if (actor?.$id) {
			const config = { ...actor }
			const inboxId = deriveInboxId(config.$id)
			if (inboxId) {
				config.inbox = inboxId
				inboxes[inboxId] = toInboxConfig(inboxId)
			}
			actors[config.$id] = config
		}
		if (context?.$id) uiContexts[context.$id] = context
		if (view?.$id) uiViews[view.$id] = view
		if (proc?.$id) uiProcesses[proc.$id] = proc
		if (styleCfg?.$id) uiStyles[styleCfg.$id] = styleCfg
		if (toolCfg?.$id) tools[toolCfg.$id] = toolCfg
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

if (import.meta.hot) {
	import.meta.hot.accept()
}
