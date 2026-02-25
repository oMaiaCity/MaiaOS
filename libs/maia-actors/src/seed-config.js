/**
 * Seed config for service actors - contributes actors and states to genesis seed.
 * Merged by moai into buildSeedConfig output; replaces separate tool config.
 * Also includes standalone UI actors (e.g. placeholder).
 */

import { getAllSchemas } from '@MaiaOS/schemata'
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
import listActor from './services/list/actor.maia'
import listContext from './services/list/context.maia'
import listProcess from './services/list/process.maia'
import logsActor from './services/logs/actor.maia'
import logsContext from './services/logs/context.maia'
import logsProcess from './services/logs/process.maia'
import messagesActor from './services/messages/actor.maia'
import messagesContext from './services/messages/context.maia'
import messagesProcess from './services/messages/process.maia'
import paperActor from './services/paper/actor.maia'
import paperContext from './services/paper/context.maia'
import paperProcess from './services/paper/process.maia'
import paperTool from './services/paper/tool.maia'
import messagesStyle from './views/conversation/style.maia'
import messagesView from './views/conversation/view.maia'
import detailStyle from './views/detail-panel/style.maia'
import detailView from './views/detail-panel/view.maia'
import gridStyle from './views/grid/style.maia'
import gridView from './views/grid/view.maia'
import layoutHumansActor from './views/humans/actor.maia'
import layoutHumansContext from './views/humans/context.maia'
import layoutHumansProcess from './views/humans/process.maia'
import inputForChatActor from './views/input/actor-for-chat.maia'
import inputForDetailActor from './views/input/actor-for-detail.maia'
import inputForListActor from './views/input/actor-for-list.maia'
import inputForSparksActor from './views/input/actor-for-sparks.maia'
import inputForChatContext from './views/input/context-for-chat.maia'
import inputForDetailContext from './views/input/context-for-detail.maia'
import inputForListContext from './views/input/context-for-list.maia'
import inputForSparksContext from './views/input/context-for-sparks.maia'
import inputProcess from './views/input/process.maia'
import inputForChatProcess from './views/input/process-for-chat.maia'
import inputForListProcess from './views/input/process-for-list.maia'
import inputStyle from './views/input/style.maia'
import inputView from './views/input/view.maia'
import listDetailForActorsActor from './views/list-detail/actor-for-actors.maia'
import listDetailForSchemasActor from './views/list-detail/actor-for-schemas.maia'
import listDetailForActorsContext from './views/list-detail/context-for-actors.maia'
import listDetailForSchemasContextBase from './views/list-detail/context-for-schemas.maia'
import listDetailDetailActorsActor from './views/list-detail/detail-actors-actor.maia'
import listDetailDetailActorsContext from './views/list-detail/detail-actors-context.maia'
import listDetailDetailActorsProcess from './views/list-detail/detail-actors-process.maia'
import listDetailDetailActorsView from './views/list-detail/detail-actors-view.maia'
import listDetailDetailSchemasActor from './views/list-detail/detail-schemas-actor.maia'
import listDetailDetailSchemasContext from './views/list-detail/detail-schemas-context.maia'
import listDetailDetailSchemasProcess from './views/list-detail/detail-schemas-process.maia'
import listDetailDetailSchemasView from './views/list-detail/detail-schemas-view.maia'
import listDetailForActorsProcess from './views/list-detail/process-for-actors.maia'
import listDetailForSchemasProcess from './views/list-detail/process-for-schemas.maia'
import listDetailStyle from './views/list-detail/style.maia'
import listDetailView from './views/list-detail/view.maia'
import listStyle from './views/list-view/style.maia'
import listView from './views/list-view/view.maia'
import logsStyle from './views/log-viewer/style.maia'
import logsView from './views/log-viewer/view.maia'
import layoutChatActor from './views/modal-chat/actor.maia'
import layoutChatContext from './views/modal-chat/context.maia'
import layoutChatProcess from './views/modal-chat/process.maia'
import modalChatView from './views/modal-chat/view.maia'
import paperStyle from './views/paper-view/style.maia'
import paperView from './views/paper-view/view.maia'
import placeholderActor from './views/placeholder/actor.maia'
import placeholderContext from './views/placeholder/context.maia'
import placeholderProcess from './views/placeholder/process.maia'
import placeholderStyle from './views/placeholder/style.maia'
import placeholderView from './views/placeholder/view.maia'
import layoutSparksActor from './views/sparks/actor.maia'
import layoutSparksContext from './views/sparks/context.maia'
import layoutSparksProcess from './views/sparks/process.maia'
import sparksStyle from './views/sparks/style.maia'
import sparksView from './views/sparks/view.maia'
import layoutCreatorActor from './views/tabs/actor-creator.maia'
import layoutTodosActor from './views/tabs/actor-todos.maia'
import layoutCreatorContext from './views/tabs/context-creator.maia'
import layoutTodosContext from './views/tabs/context-todos.maia'
import tabsProcess from './views/tabs/process.maia'
import tabsStyle from './views/tabs/style.maia'
import tabsView from './views/tabs/view.maia'

/** Build listItems from getAllSchemas() for list-detail/for-schemas */
function buildListDetailSchemasContext() {
	const allSchemas = getAllSchemas()
	const listItems = Object.entries(allSchemas).map(([id, def]) => ({
		id,
		label: id.startsWith('°Maia/schema/') ? id.replace('°Maia/schema/', '') : id,
		definition: JSON.stringify(def, null, 2),
	}))
	return { ...listDetailForSchemasContextBase, listItems }
}

const listDetailForSchemasContext = buildListDetailSchemasContext()

/** Map role to folder name for consistent °Maia/actor/{folder} $ids */
export const ROLE_TO_FOLDER = {
	'@maia/actor/os/ai': 'os/ai',
	'@maia/actor/os/db': 'os/db',
	'@maia/actor/os/names': 'os/names',
	'@maia/actor/views/placeholder': 'views/placeholder',
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
			actor: listDetailDetailActorsActor,
			context: listDetailDetailActorsContext,
			view: listDetailDetailActorsView,
			process: listDetailDetailActorsProcess,
			style: listDetailStyle,
		},
		{
			actor: listDetailDetailSchemasActor,
			context: listDetailDetailSchemasContext,
			view: listDetailDetailSchemasView,
			process: listDetailDetailSchemasProcess,
			style: listDetailStyle,
		},
		{
			actor: listDetailForActorsActor,
			context: listDetailForActorsContext,
			view: listDetailView,
			process: listDetailForActorsProcess,
			style: listDetailStyle,
		},
		{
			actor: listDetailForSchemasActor,
			context: listDetailForSchemasContext,
			view: listDetailView,
			process: listDetailForSchemasProcess,
			style: listDetailStyle,
		},
		{
			actor: placeholderActor,
			context: placeholderContext,
			view: placeholderView,
			process: placeholderProcess,
			style: placeholderStyle,
		},
		{
			actor: layoutTodosActor,
			context: layoutTodosContext,
			view: tabsView,
			process: tabsProcess,
			style: tabsStyle,
		},
		{
			actor: layoutCreatorActor,
			context: layoutCreatorContext,
			view: tabsView,
			process: tabsProcess,
			style: tabsStyle,
		},
		{
			actor: layoutSparksActor,
			context: layoutSparksContext,
			view: sparksView,
			process: layoutSparksProcess,
			style: sparksStyle,
		},
		{
			actor: inputForListActor,
			context: inputForListContext,
			view: inputView,
			process: inputForListProcess,
			style: inputStyle,
		},
		{
			actor: inputForSparksActor,
			context: inputForSparksContext,
			view: inputView,
			process: inputProcess,
			style: inputStyle,
		},
		{
			actor: inputForChatActor,
			context: inputForChatContext,
			view: inputView,
			process: inputForChatProcess,
			style: inputStyle,
		},
		{
			actor: inputForDetailActor,
			context: inputForDetailContext,
			view: inputView,
			process: inputProcess,
			style: inputStyle,
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
			style: paperStyle,
			tool: paperTool,
		},
		{
			actor: messagesActor,
			context: messagesContext,
			view: messagesView,
			process: messagesProcess,
			style: messagesStyle,
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
			style: detailStyle,
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
