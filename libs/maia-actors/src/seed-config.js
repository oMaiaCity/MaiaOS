/**
 * Seed config for service actors - contributes actors to genesis seed.
 * Merged by the sync server into buildSeedConfig output; replaces separate tool config.
 * Also includes standalone UI actors (e.g. placeholder).
 */

import { deriveInboxId } from '@MaiaOS/factories/seeding-utils'
import aiChatActor from './os/ai/actor.maia'
import aiChatInterface from './os/ai/interface.maia'
import aiChatProcess from './os/ai/process.maia'
import dbActor from './os/db/actor.maia'
import dbInterface from './os/db/interface.maia'
import dbProcess from './os/db/process.maia'
import osMessagesActor from './os/messages/actor.maia'
import osMessagesContext from './os/messages/context.maia'
import osMessagesInterface from './os/messages/interface.maia'
import osMessagesProcess from './os/messages/process.maia'
import computeMessageNamesActor from './services/names/actor.maia'
import computeMessageNamesInterface from './services/names/interface.maia'
import computeMessageNamesProcess from './services/names/process.maia'
import paperServiceActor from './services/paper/actor.maia'
import paperServiceContext from './services/paper/context.maia'
import paperActorInterface from './services/paper/interface.maia'
import paperServiceProcess from './services/paper/process.maia'
import profileImageServiceActor from './services/profile-image/actor.maia'
import profileImageServiceInterface from './services/profile-image/interface.maia'
import profileImageServiceProcess from './services/profile-image/process.maia'
import sandboxedAddActor from './services/sandboxed-add/actor.maia'
import sandboxedAddInterface from './services/sandboxed-add/interface.maia'
import sandboxedAddProcess from './services/sandboxed-add/process.maia'
import sandboxedAddWasm from './services/sandboxed-add/wasm.maia'
import sparkActor from './services/spark/actor.maia'
import sparkContext from './services/spark/context.maia'
import sparkActorInterface from './services/spark/interface.maia'
import sparkProcess from './services/spark/process.maia'
import todosActor from './services/todos/actor.maia'
import todosContext from './services/todos/context.maia'
import todosActorInterface from './services/todos/interface.maia'
import todosProcess from './services/todos/process.maia'
import updateWasmCodeActor from './services/update-wasm-code/actor.maia'
import updateWasmCodeInterface from './services/update-wasm-code/interface.maia'
import updateWasmCodeProcess from './services/update-wasm-code/process.maia'
import addressbookAvensGridActor from './views/addressbook-avens-grid/actor.maia'
import addressbookAvensGridContext from './views/addressbook-avens-grid/context.maia'
import addressbookAvensGridInterface from './views/addressbook-avens-grid/interface.maia'
import addressbookGridProcess from './views/addressbook-grid/process.maia'
import addressbookGridStyle from './views/addressbook-grid/style.maia'
import addressbookGridView from './views/addressbook-grid/view.maia'
import addressbookHumansGridActor from './views/addressbook-humans-grid/actor.maia'
import addressbookHumansGridContext from './views/addressbook-humans-grid/context.maia'
import addressbookHumansGridInterface from './views/addressbook-humans-grid/interface.maia'
import detailActor from './views/detail/actor.maia'
import detailContext from './views/detail/context.maia'
import detailInterface from './views/detail/interface.maia'
import detailProcess from './views/detail/process.maia'
import detailStyle from './views/detail/style.maia'
import detailView from './views/detail/view.maia'
import layoutHumansActor from './views/humans/actor.maia'
import layoutHumansContext from './views/humans/context.maia'
import layoutHumansInterface from './views/humans/interface.maia'
import infoCardActor from './views/info-card/actor.maia'
import infoCardContext from './views/info-card/context.maia'
import infoCardInterface from './views/info-card/interface.maia'
import infoCardProcess from './views/info-card/process.maia'
import infoCardStyle from './views/info-card/style.maia'
import infoCardView from './views/info-card/view.maia'
import inputForChatActor from './views/input/for-chat.actor.maia'
import inputForChatContext from './views/input/for-chat.context.maia'
import inputForChatInterface from './views/input/for-chat.interface.maia'
import inputForChatProcess from './views/input/for-chat.process.maia'
import inputForDetailActor from './views/input/for-detail.actor.maia'
import inputForDetailContext from './views/input/for-detail.context.maia'
import inputForDetailInterface from './views/input/for-detail.interface.maia'
import inputForListActor from './views/input/for-list.actor.maia'
import inputForListContext from './views/input/for-list.context.maia'
import inputForListInterface from './views/input/for-list.interface.maia'
import inputForListProcess from './views/input/for-list.process.maia'
import inputForSparksActor from './views/input/for-sparks.actor.maia'
import inputForSparksContext from './views/input/for-sparks.context.maia'
import inputForSparksInterface from './views/input/for-sparks.interface.maia'
import inputProcess from './views/input/process.maia'
import inputStyle from './views/input/style.maia'
import inputView from './views/input/view.maia'
import layoutChatActor from './views/layout-chat/actor.maia'
import layoutChatContext from './views/layout-chat/context.maia'
import layoutChatInterface from './views/layout-chat/interface.maia'
import layoutChatProcess from './views/layout-chat/process.maia'
import layoutChatView from './views/layout-chat/view.maia'
import layoutPaperActor from './views/layout-paper/actor.maia'
import layoutPaperContext from './views/layout-paper/context.maia'
import layoutPaperInterface from './views/layout-paper/interface.maia'
import layoutPaperProcess from './views/layout-paper/process.maia'
import layoutPaperStyle from './views/layout-paper/style.maia'
import layoutPaperView from './views/layout-paper/view.maia'
import listActor from './views/list/actor.maia'
import listContext from './views/list/context.maia'
import listInterface from './views/list/interface.maia'
import listProcess from './views/list/process.maia'
import listStyle from './views/list/style.maia'
import listView from './views/list/view.maia'
import listDetailStyle from './views/list-detail/style.maia'
import logsActor from './views/logs/actor.maia'
import logsContext from './views/logs/context.maia'
import logsInterface from './views/logs/interface.maia'
import logsProcess from './views/logs/process.maia'
import logsStyle from './views/logs/style.maia'
import logsView from './views/logs/view.maia'
import messagesActor from './views/messages/actor.maia'
import messagesContext from './views/messages/context.maia'
import messagesInterface from './views/messages/interface.maia'
import messagesProcess from './views/messages/process.maia'
import messagesStyle from './views/messages/style.maia'
import messagesView from './views/messages/view.maia'
import paperActor from './views/paper/actor.maia'
import paperContext from './views/paper/context.maia'
import paperInterface from './views/paper/interface.maia'
import paperProcess from './views/paper/process.maia'
import paperStyle from './views/paper/style.maia'
import paperView from './views/paper/view.maia'
import placeholderActor from './views/placeholder/actor.maia'
import placeholderContext from './views/placeholder/context.maia'
import placeholderInterface from './views/placeholder/interface.maia'
import placeholderProcess from './views/placeholder/process.maia'
import placeholderStyle from './views/placeholder/style.maia'
import placeholderView from './views/placeholder/view.maia'
import profileImageContext from './views/profile-image/context.maia'
import profileImageStyle from './views/profile-image/style.maia'
import profileImageView from './views/profile-image/view.maia'
import layoutSparksActor from './views/sparks/actor.maia'
import layoutSparksContext from './views/sparks/context.maia'
import layoutSparksInterface from './views/sparks/interface.maia'
import layoutSparksProcess from './views/sparks/process.maia'
import sparksStyle from './views/sparks/style.maia'
import sparksView from './views/sparks/view.maia'
import tabsProcess from './views/tabs/process.maia'
import tabsStyle from './views/tabs/style.maia'
import layoutTodosActor from './views/tabs/todos.actor.maia'
import layoutTodosContext from './views/tabs/todos.context.maia'
import layoutTodosInterface from './views/tabs/todos.interface.maia'
import tabsView from './views/tabs/view.maia'

/** Map role to folder name for consistent °Maia/actor/{folder} $ids */
export const ROLE_TO_FOLDER = {
	'@maia/actor/os/ai': 'os/ai',
	'@maia/actor/os/db': 'os/db',
	'@maia/actor/services/names': 'services/names',
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
	'°Maia/actor/services/names': 'COMPUTE_NAMES',
	'°Maia/actor/services/paper': 'UPDATE_PAPER',
	'°Maia/actor/services/updateWasmCode': 'UPDATE_WASM_CODE',
	'°Maia/actor/views/paper': 'UPDATE_PAPER',
}

/** Build actor config for seeding - uses actor schema */
function toActorConfig(raw, inboxId) {
	const label = raw['@label']
	const { interface: iface, process: processRef } = raw
	if (!label || !iface || !processRef) return null
	const folder = ROLE_TO_FOLDER[label] ?? label.replace('@', '').replace(/\//g, '-')
	return {
		$schema: '°Maia/factory/actor',
		$id: `°Maia/actor/${folder}`,
		'@label': label,
		interface: iface,
		process: processRef,
		view: null,
		context: null,
		inbox: inboxId || null,
	}
}

/** Build minimal inbox config for seeding - cotype comes from schema. */
function toInboxConfig(inboxId) {
	return {
		$factory: '°Maia/factory/inbox',
		$id: inboxId,
	}
}

/**
 * Seed config for all service actors.
 * Merge into mergedConfigs.actors, mergedConfigs.inboxes before seed.
 * Inboxes must be seeded before actors (actor config references inbox).
 */
export function getSeedConfig() {
	const actorDefs = [
		[aiChatActor, aiChatProcess],
		[computeMessageNamesActor, computeMessageNamesProcess],
		[dbActor, dbProcess],
	]

	const actors = {}
	const processes = {}
	const interfaces = {}
	const inboxes = {}

	for (const [actorDef, processDef] of actorDefs) {
		const actorConfig = toActorConfig(actorDef, null)
		if (!actorConfig) continue
		const inboxId = deriveInboxId(actorConfig.$id)
		if (!inboxId) continue
		actorConfig.inbox = inboxId
		const processId = processDef?.$id || actorDef?.process
		if (!processId) continue
		actors[actorConfig.$id] = actorConfig
		processes[processId] = processDef
		inboxes[inboxId] = toInboxConfig(inboxId)
	}

	// Interface schemas (keyed by $id) - must be seeded before actors
	const interfaceDefs = [
		aiChatInterface,
		dbInterface,
		computeMessageNamesInterface,
		osMessagesInterface,
		paperActorInterface,
		profileImageServiceInterface,
		sandboxedAddInterface,
		updateWasmCodeInterface,
		sparkActorInterface,
		todosActorInterface,
		detailInterface,
		layoutHumansInterface,
		inputForChatInterface,
		inputForDetailInterface,
		inputForListInterface,
		inputForSparksInterface,
		listInterface,
		logsInterface,
		messagesInterface,
		infoCardInterface,
		layoutChatInterface,
		layoutPaperInterface,
		paperInterface,
		placeholderInterface,
		layoutSparksInterface,
		layoutTodosInterface,
		addressbookHumansGridInterface,
		addressbookAvensGridInterface,
	]
	for (const iface of interfaceDefs) {
		if (iface?.$id) interfaces[iface.$id] = iface
	}

	// View actors (UI components)
	const viewActors = [
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
			actor: listActor,
			context: listContext,
			view: listView,
			process: listProcess,
			style: listStyle,
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
			view: tabsView,
			process: tabsProcess,
			style: tabsStyle,
		},
		{
			actor: addressbookHumansGridActor,
			context: addressbookHumansGridContext,
			view: addressbookGridView,
			process: addressbookGridProcess,
			style: addressbookGridStyle,
		},
		{
			actor: addressbookAvensGridActor,
			context: addressbookAvensGridContext,
			view: addressbookGridView,
			process: addressbookGridProcess,
			style: addressbookGridStyle,
		},
		{
			actor: layoutChatActor,
			context: layoutChatContext,
			view: layoutChatView,
			process: layoutChatProcess,
		},
		{
			actor: infoCardActor,
			context: infoCardContext,
			view: infoCardView,
			process: infoCardProcess,
			style: infoCardStyle,
		},
		{
			actor: layoutPaperActor,
			context: layoutPaperContext,
			view: layoutPaperView,
			process: layoutPaperProcess,
			style: layoutPaperStyle,
		},
		{
			actor: messagesActor,
			context: messagesContext,
			view: messagesView,
			process: messagesProcess,
			style: messagesStyle,
		},
		{
			actor: paperActor,
			context: paperContext,
			view: paperView,
			process: paperProcess,
			style: paperStyle,
		},
		{
			actor: logsActor,
			context: logsContext,
			view: logsView,
			process: logsProcess,
			style: logsStyle,
		},
		{
			actor: detailActor,
			context: detailContext,
			view: detailView,
			process: detailProcess,
			style: detailStyle,
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
	if (listDetailStyle?.$id) uiStyles[listDetailStyle.$id] = listDetailStyle

	// Service actors (messages, logs, list, detail, paper, todos)
	const serviceActors = [
		{
			actor: todosActor,
			context: todosContext,
			process: todosProcess,
		},
		{
			actor: sparkActor,
			context: sparkContext,
			process: sparkProcess,
		},
		{
			actor: paperServiceActor,
			context: paperServiceContext,
			process: paperServiceProcess,
		},
		{
			actor: profileImageServiceActor,
			context: profileImageContext,
			process: profileImageServiceProcess,
			view: profileImageView,
			style: profileImageStyle,
		},
		{
			actor: osMessagesActor,
			context: osMessagesContext,
			process: osMessagesProcess,
		},
		{
			actor: sandboxedAddActor,
			process: sandboxedAddProcess,
		},
		{
			actor: updateWasmCodeActor,
			process: updateWasmCodeProcess,
		},
	]
	for (const { actor, context, view, process: proc, style: styleCfg } of serviceActors) {
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
	}

	// Merge all processes
	const allProcesses = { ...processes, ...uiProcesses }

	const wasms = {
		'°Maia/actor/services/sandboxed-add/wasm': sandboxedAddWasm,
	}

	return {
		actors,
		processes: allProcesses,
		interfaces,
		inboxes,
		contexts: uiContexts,
		views: uiViews,
		styles: uiStyles,
		wasms,
	}
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
