/**
 * Seed config for service actors - contributes actors and states to genesis seed.
 * Merged by moai into buildSeedConfig output; replaces separate tool config.
 * Also includes standalone UI actors (e.g. placeholder).
 */

import { getAllSchemas } from '@MaiaOS/schemata'
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
import schemaActor from './os/schema/actor.maia'
import schemaContext from './os/schema/context.maia'
import osSchemaInterface from './os/schema/interface.maia'
import schemaProcess from './os/schema/process.maia'
import computeMessageNamesActor from './services/names/actor.maia'
import computeMessageNamesInterface from './services/names/interface.maia'
import computeMessageNamesProcess from './services/names/process.maia'
import paperServiceActor from './services/paper/actor.maia'
import paperServiceContext from './services/paper/context.maia'
import paperActorInterface from './services/paper/interface.maia'
import paperServiceProcess from './services/paper/process.maia'
import sparkActor from './services/spark/actor.maia'
import sparkContext from './services/spark/context.maia'
import sparkActorInterface from './services/spark/interface.maia'
import sparkProcess from './services/spark/process.maia'
import todosActor from './services/todos/actor.maia'
import todosContext from './services/todos/context.maia'
import todosActorInterface from './services/todos/interface.maia'
import todosProcess from './services/todos/process.maia'
import detailActor from './views/detail/actor.maia'
import detailContext from './views/detail/context.maia'
import detailInterface from './views/detail/interface.maia'
import detailProcess from './views/detail/process.maia'
import detailStyle from './views/detail/style.maia'
import detailView from './views/detail/view.maia'
import layoutHumansActor from './views/humans/actor.maia'
import layoutHumansContext from './views/humans/context.maia'
import layoutHumansInterface from './views/humans/interface.maia'
import layoutHumansProcess from './views/humans/process.maia'
import layoutHumansStyle from './views/humans/style.maia'
import layoutHumansView from './views/humans/view.maia'
import inputForChatActor from './views/input/actor-for-chat.maia'
import inputForDetailActor from './views/input/actor-for-detail.maia'
import inputForListActor from './views/input/actor-for-list.maia'
import inputForSparksActor from './views/input/actor-for-sparks.maia'
import inputForChatContext from './views/input/for-chat.context.maia'
import inputForChatInterface from './views/input/for-chat.interface.maia'
import inputForChatProcess from './views/input/for-chat.process.maia'
import inputForDetailContext from './views/input/for-detail.context.maia'
import inputForDetailInterface from './views/input/for-detail.interface.maia'
import inputForListContext from './views/input/for-list.context.maia'
import inputForListInterface from './views/input/for-list.interface.maia'
import inputForListProcess from './views/input/for-list.process.maia'
import inputForSparksContext from './views/input/for-sparks.context.maia'
import inputForSparksInterface from './views/input/for-sparks.interface.maia'
import inputProcess from './views/input/process.maia'
import inputStyle from './views/input/style.maia'
import inputView from './views/input/view.maia'
import layoutChatInterface from './views/layout-chat/interface.maia'
import listActor from './views/list/actor.maia'
import listContext from './views/list/context.maia'
import listInterface from './views/list/interface.maia'
import listProcess from './views/list/process.maia'
import listStyle from './views/list/style.maia'
import listView from './views/list/view.maia'
import listDetailForActorsActor from './views/list-detail/actor-for-actors.maia'
import listDetailForSchemasActor from './views/list-detail/actor-for-schemas.maia'
import listDetailDetailActorsContext from './views/list-detail/detail-actors.context.maia'
import listDetailDetailActorsInterface from './views/list-detail/detail-actors.interface.maia'
import listDetailDetailActorsProcess from './views/list-detail/detail-actors.process.maia'
import listDetailDetailActorsActor from './views/list-detail/detail-actors-actor.maia'
import listDetailDetailActorsView from './views/list-detail/detail-actors-view.maia'
import listDetailDetailSchemasContext from './views/list-detail/detail-schemas.context.maia'
import listDetailDetailSchemasInterface from './views/list-detail/detail-schemas.interface.maia'
import listDetailDetailSchemasProcess from './views/list-detail/detail-schemas.process.maia'
import listDetailDetailSchemasActor from './views/list-detail/detail-schemas-actor.maia'
import listDetailDetailSchemasView from './views/list-detail/detail-schemas-view.maia'
import listDetailForActorsContext from './views/list-detail/for-actors.context.maia'
import listDetailForActorsInterface from './views/list-detail/for-actors.interface.maia'
import listDetailForActorsProcess from './views/list-detail/for-actors.process.maia'
import listDetailForSchemasContextBase from './views/list-detail/for-schemas.context.maia'
import listDetailForSchemasInterface from './views/list-detail/for-schemas.interface.maia'
import listDetailForSchemasProcess from './views/list-detail/for-schemas.process.maia'
import listDetailStyle from './views/list-detail/style.maia'
import listDetailView from './views/list-detail/view.maia'
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
import layoutChatActor from './views/modal-chat/actor.maia'
import layoutChatContext from './views/modal-chat/context.maia'
import layoutChatProcess from './views/modal-chat/process.maia'
import modalChatView from './views/modal-chat/view.maia'
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
import layoutSparksActor from './views/sparks/actor.maia'
import layoutSparksContext from './views/sparks/context.maia'
import layoutSparksInterface from './views/sparks/interface.maia'
import layoutSparksProcess from './views/sparks/process.maia'
import sparksStyle from './views/sparks/style.maia'
import sparksView from './views/sparks/view.maia'
import layoutCreatorActor from './views/tabs/creator.actor.maia'
import layoutCreatorContext from './views/tabs/creator.context.maia'
import layoutCreatorInterface from './views/tabs/creator.interface.maia'
import tabsProcess from './views/tabs/process.maia'
import tabsStyle from './views/tabs/style.maia'
import layoutTodosActor from './views/tabs/todos.actor.maia'
import layoutTodosContext from './views/tabs/todos.context.maia'
import layoutTodosInterface from './views/tabs/todos.interface.maia'
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
}

/** Build actor config for seeding - uses actor schema */
function toActorConfig(raw, inboxId) {
	const label = raw['@label']
	const { interface: iface, process: processRef } = raw
	if (!label || !iface || !processRef) return null
	const folder = ROLE_TO_FOLDER[label] ?? label.replace('@', '').replace(/\//g, '-')
	return {
		$schema: '°Maia/schema/actor',
		$id: `°Maia/actor/${folder}`,
		'@label': label,
		interface: iface,
		process: processRef,
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
		osSchemaInterface,
		sparkActorInterface,
		todosActorInterface,
		detailInterface,
		layoutHumansInterface,
		inputForChatInterface,
		inputForDetailInterface,
		inputForListInterface,
		inputForSparksInterface,
		listInterface,
		listDetailForActorsInterface,
		listDetailForSchemasInterface,
		listDetailDetailActorsInterface,
		listDetailDetailSchemasInterface,
		logsInterface,
		messagesInterface,
		layoutChatInterface,
		paperInterface,
		placeholderInterface,
		layoutSparksInterface,
		layoutCreatorInterface,
		layoutTodosInterface,
	]
	for (const iface of interfaceDefs) {
		if (iface?.$id) interfaces[iface.$id] = iface
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
			actor: listActor,
			context: listContext,
			view: listView,
			process: listProcess,
			style: listStyle,
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
			view: layoutHumansView,
			process: layoutHumansProcess,
			style: layoutHumansStyle,
		},
		{
			actor: layoutChatActor,
			context: layoutChatContext,
			view: modalChatView,
			process: layoutChatProcess,
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

	// Service actors (messages, logs, list, detail, paper, todos)
	const serviceActors = [
		{
			actor: todosActor,
			context: todosContext,
			process: todosProcess,
		},
		{
			actor: schemaActor,
			context: schemaContext,
			process: schemaProcess,
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
			actor: osMessagesActor,
			context: osMessagesContext,
			process: osMessagesProcess,
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

	return {
		actors,
		processes: allProcesses,
		interfaces,
		inboxes,
		contexts: uiContexts,
		views: uiViews,
		styles: uiStyles,
	}
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
