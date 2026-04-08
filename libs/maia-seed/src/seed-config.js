/**
 * Seed config for service actors - contributes actors to genesis seed.
 * Merged by the sync server into buildSeedConfig output; replaces separate tool config.
 * Also includes standalone UI actors (e.g. placeholder).
 */

import { annotateMaiaConfig } from '@MaiaOS/factories/annotate-maia'
import { isActorFilePathId } from '@MaiaOS/universe/actors/actor-service-refs.js'
import aiChatActorRaw from '@MaiaOS/universe/actors/os/ai/actor.maia'
import aiChatInterfaceRaw from '@MaiaOS/universe/actors/os/ai/interface.maia'
import aiChatProcessRaw from '@MaiaOS/universe/actors/os/ai/process.maia'
import dbActorRaw from '@MaiaOS/universe/actors/os/db/actor.maia'
import dbInterfaceRaw from '@MaiaOS/universe/actors/os/db/interface.maia'
import dbProcessRaw from '@MaiaOS/universe/actors/os/db/process.maia'
import osMessagesActorRaw from '@MaiaOS/universe/actors/os/messages/actor.maia'
import osMessagesContextRaw from '@MaiaOS/universe/actors/os/messages/context.maia'
import osMessagesInterfaceRaw from '@MaiaOS/universe/actors/os/messages/interface.maia'
import osMessagesProcessRaw from '@MaiaOS/universe/actors/os/messages/process.maia'
import computeMessageNamesActorRaw from '@MaiaOS/universe/actors/services/names/actor.maia'
import computeMessageNamesInterfaceRaw from '@MaiaOS/universe/actors/services/names/interface.maia'
import computeMessageNamesProcessRaw from '@MaiaOS/universe/actors/services/names/process.maia'
import paperServiceActorRaw from '@MaiaOS/universe/actors/services/paper/actor.maia'
import paperServiceContextRaw from '@MaiaOS/universe/actors/services/paper/context.maia'
import paperActorInterfaceRaw from '@MaiaOS/universe/actors/services/paper/interface.maia'
import paperServiceProcessRaw from '@MaiaOS/universe/actors/services/paper/process.maia'
import profileImageServiceActorRaw from '@MaiaOS/universe/actors/services/profile-image/actor.maia'
import profileImageServiceInterfaceRaw from '@MaiaOS/universe/actors/services/profile-image/interface.maia'
import profileImageServiceProcessRaw from '@MaiaOS/universe/actors/services/profile-image/process.maia'
import sandboxedAddActorRaw from '@MaiaOS/universe/actors/services/sandboxed-add/actor.maia'
import sandboxedAddInterfaceRaw from '@MaiaOS/universe/actors/services/sandboxed-add/interface.maia'
import sandboxedAddProcessRaw from '@MaiaOS/universe/actors/services/sandboxed-add/process.maia'
import sandboxedAddWasmRaw from '@MaiaOS/universe/actors/services/sandboxed-add/wasm.maia'
import sparkActorRaw from '@MaiaOS/universe/actors/services/spark/actor.maia'
import sparkContextRaw from '@MaiaOS/universe/actors/services/spark/context.maia'
import sparkActorInterfaceRaw from '@MaiaOS/universe/actors/services/spark/interface.maia'
import sparkProcessRaw from '@MaiaOS/universe/actors/services/spark/process.maia'
import todosActorRaw from '@MaiaOS/universe/actors/services/todos/actor.maia'
import todosContextRaw from '@MaiaOS/universe/actors/services/todos/context.maia'
import todosActorInterfaceRaw from '@MaiaOS/universe/actors/services/todos/interface.maia'
import todosProcessRaw from '@MaiaOS/universe/actors/services/todos/process.maia'
import updateWasmCodeActorRaw from '@MaiaOS/universe/actors/services/update-wasm-code/actor.maia'
import updateWasmCodeInterfaceRaw from '@MaiaOS/universe/actors/services/update-wasm-code/interface.maia'
import updateWasmCodeProcessRaw from '@MaiaOS/universe/actors/services/update-wasm-code/process.maia'
import addressbookAvensGridActorRaw from '@MaiaOS/universe/actors/views/addressbook-avens-grid/actor.maia'
import addressbookAvensGridContextRaw from '@MaiaOS/universe/actors/views/addressbook-avens-grid/context.maia'
import addressbookAvensGridInterfaceRaw from '@MaiaOS/universe/actors/views/addressbook-avens-grid/interface.maia'
import addressbookGridProcessRaw from '@MaiaOS/universe/actors/views/addressbook-grid/process.maia'
import addressbookGridStyleRaw from '@MaiaOS/universe/actors/views/addressbook-grid/style.maia'
import addressbookGridViewRaw from '@MaiaOS/universe/actors/views/addressbook-grid/view.maia'
import addressbookHumansGridActorRaw from '@MaiaOS/universe/actors/views/addressbook-humans-grid/actor.maia'
import addressbookHumansGridContextRaw from '@MaiaOS/universe/actors/views/addressbook-humans-grid/context.maia'
import addressbookHumansGridInterfaceRaw from '@MaiaOS/universe/actors/views/addressbook-humans-grid/interface.maia'
import detailActorRaw from '@MaiaOS/universe/actors/views/detail/actor.maia'
import detailContextRaw from '@MaiaOS/universe/actors/views/detail/context.maia'
import detailInterfaceRaw from '@MaiaOS/universe/actors/views/detail/interface.maia'
import detailProcessRaw from '@MaiaOS/universe/actors/views/detail/process.maia'
import detailStyleRaw from '@MaiaOS/universe/actors/views/detail/style.maia'
import detailViewRaw from '@MaiaOS/universe/actors/views/detail/view.maia'
import layoutHumansActorRaw from '@MaiaOS/universe/actors/views/humans/actor.maia'
import layoutHumansContextRaw from '@MaiaOS/universe/actors/views/humans/context.maia'
import layoutHumansInterfaceRaw from '@MaiaOS/universe/actors/views/humans/interface.maia'
import infoCardActorRaw from '@MaiaOS/universe/actors/views/info-card/actor.maia'
import infoCardContextRaw from '@MaiaOS/universe/actors/views/info-card/context.maia'
import infoCardInterfaceRaw from '@MaiaOS/universe/actors/views/info-card/interface.maia'
import infoCardProcessRaw from '@MaiaOS/universe/actors/views/info-card/process.maia'
import infoCardStyleRaw from '@MaiaOS/universe/actors/views/info-card/style.maia'
import infoCardViewRaw from '@MaiaOS/universe/actors/views/info-card/view.maia'
import inputForChatActorRaw from '@MaiaOS/universe/actors/views/input/for-chat.actor.maia'
import inputForChatContextRaw from '@MaiaOS/universe/actors/views/input/for-chat.context.maia'
import inputForChatInterfaceRaw from '@MaiaOS/universe/actors/views/input/for-chat.interface.maia'
import inputForChatProcessRaw from '@MaiaOS/universe/actors/views/input/for-chat.process.maia'
import inputForDetailActorRaw from '@MaiaOS/universe/actors/views/input/for-detail.actor.maia'
import inputForDetailContextRaw from '@MaiaOS/universe/actors/views/input/for-detail.context.maia'
import inputForDetailInterfaceRaw from '@MaiaOS/universe/actors/views/input/for-detail.interface.maia'
import inputForListActorRaw from '@MaiaOS/universe/actors/views/input/for-list.actor.maia'
import inputForListContextRaw from '@MaiaOS/universe/actors/views/input/for-list.context.maia'
import inputForListInterfaceRaw from '@MaiaOS/universe/actors/views/input/for-list.interface.maia'
import inputForListProcessRaw from '@MaiaOS/universe/actors/views/input/for-list.process.maia'
import inputForSparksActorRaw from '@MaiaOS/universe/actors/views/input/for-sparks.actor.maia'
import inputForSparksContextRaw from '@MaiaOS/universe/actors/views/input/for-sparks.context.maia'
import inputForSparksInterfaceRaw from '@MaiaOS/universe/actors/views/input/for-sparks.interface.maia'
import inputProcessRaw from '@MaiaOS/universe/actors/views/input/process.maia'
import inputStyleRaw from '@MaiaOS/universe/actors/views/input/style.maia'
import inputViewRaw from '@MaiaOS/universe/actors/views/input/view.maia'
import layoutChatActorRaw from '@MaiaOS/universe/actors/views/layout-chat/actor.maia'
import layoutChatContextRaw from '@MaiaOS/universe/actors/views/layout-chat/context.maia'
import layoutChatInterfaceRaw from '@MaiaOS/universe/actors/views/layout-chat/interface.maia'
import layoutChatProcessRaw from '@MaiaOS/universe/actors/views/layout-chat/process.maia'
import layoutChatViewRaw from '@MaiaOS/universe/actors/views/layout-chat/view.maia'
import layoutPaperActorRaw from '@MaiaOS/universe/actors/views/layout-paper/actor.maia'
import layoutPaperContextRaw from '@MaiaOS/universe/actors/views/layout-paper/context.maia'
import layoutPaperInterfaceRaw from '@MaiaOS/universe/actors/views/layout-paper/interface.maia'
import layoutPaperProcessRaw from '@MaiaOS/universe/actors/views/layout-paper/process.maia'
import layoutPaperStyleRaw from '@MaiaOS/universe/actors/views/layout-paper/style.maia'
import layoutPaperViewRaw from '@MaiaOS/universe/actors/views/layout-paper/view.maia'
import listActorRaw from '@MaiaOS/universe/actors/views/list/actor.maia'
import listContextRaw from '@MaiaOS/universe/actors/views/list/context.maia'
import listInterfaceRaw from '@MaiaOS/universe/actors/views/list/interface.maia'
import listProcessRaw from '@MaiaOS/universe/actors/views/list/process.maia'
import listStyleRaw from '@MaiaOS/universe/actors/views/list/style.maia'
import listViewRaw from '@MaiaOS/universe/actors/views/list/view.maia'
import listDetailStyleRaw from '@MaiaOS/universe/actors/views/list-detail/style.maia'
import logsActorRaw from '@MaiaOS/universe/actors/views/logs/actor.maia'
import logsContextRaw from '@MaiaOS/universe/actors/views/logs/context.maia'
import logsInterfaceRaw from '@MaiaOS/universe/actors/views/logs/interface.maia'
import logsProcessRaw from '@MaiaOS/universe/actors/views/logs/process.maia'
import logsStyleRaw from '@MaiaOS/universe/actors/views/logs/style.maia'
import logsViewRaw from '@MaiaOS/universe/actors/views/logs/view.maia'
import messagesActorRaw from '@MaiaOS/universe/actors/views/messages/actor.maia'
import messagesContextRaw from '@MaiaOS/universe/actors/views/messages/context.maia'
import messagesInterfaceRaw from '@MaiaOS/universe/actors/views/messages/interface.maia'
import messagesProcessRaw from '@MaiaOS/universe/actors/views/messages/process.maia'
import messagesStyleRaw from '@MaiaOS/universe/actors/views/messages/style.maia'
import messagesViewRaw from '@MaiaOS/universe/actors/views/messages/view.maia'
import paperActorRaw from '@MaiaOS/universe/actors/views/paper/actor.maia'
import paperContextRaw from '@MaiaOS/universe/actors/views/paper/context.maia'
import paperInterfaceRaw from '@MaiaOS/universe/actors/views/paper/interface.maia'
import paperProcessRaw from '@MaiaOS/universe/actors/views/paper/process.maia'
import paperStyleRaw from '@MaiaOS/universe/actors/views/paper/style.maia'
import paperViewRaw from '@MaiaOS/universe/actors/views/paper/view.maia'
import placeholderActorRaw from '@MaiaOS/universe/actors/views/placeholder/actor.maia'
import placeholderContextRaw from '@MaiaOS/universe/actors/views/placeholder/context.maia'
import placeholderInterfaceRaw from '@MaiaOS/universe/actors/views/placeholder/interface.maia'
import placeholderProcessRaw from '@MaiaOS/universe/actors/views/placeholder/process.maia'
import placeholderStyleRaw from '@MaiaOS/universe/actors/views/placeholder/style.maia'
import placeholderViewRaw from '@MaiaOS/universe/actors/views/placeholder/view.maia'
import profileImageContextRaw from '@MaiaOS/universe/actors/views/profile-image/context.maia'
import profileImageStyleRaw from '@MaiaOS/universe/actors/views/profile-image/style.maia'
import profileImageViewRaw from '@MaiaOS/universe/actors/views/profile-image/view.maia'
import layoutSparksActorRaw from '@MaiaOS/universe/actors/views/sparks/actor.maia'
import layoutSparksContextRaw from '@MaiaOS/universe/actors/views/sparks/context.maia'
import layoutSparksInterfaceRaw from '@MaiaOS/universe/actors/views/sparks/interface.maia'
import layoutSparksProcessRaw from '@MaiaOS/universe/actors/views/sparks/process.maia'
import sparksStyleRaw from '@MaiaOS/universe/actors/views/sparks/style.maia'
import sparksViewRaw from '@MaiaOS/universe/actors/views/sparks/view.maia'
import tabsProcessRaw from '@MaiaOS/universe/actors/views/tabs/process.maia'
import tabsStyleRaw from '@MaiaOS/universe/actors/views/tabs/style.maia'
import layoutTodosActorRaw from '@MaiaOS/universe/actors/views/tabs/todos.actor.maia'
import layoutTodosContextRaw from '@MaiaOS/universe/actors/views/tabs/todos.context.maia'
import layoutTodosInterfaceRaw from '@MaiaOS/universe/actors/views/tabs/todos.interface.maia'
import tabsViewRaw from '@MaiaOS/universe/actors/views/tabs/view.maia'
import { deriveInboxId } from './derive-inbox.js'

const aiChatActor = annotateMaiaConfig(aiChatActorRaw, 'os/ai/actor.maia')
const aiChatInterface = annotateMaiaConfig(aiChatInterfaceRaw, 'os/ai/interface.maia')
const aiChatProcess = annotateMaiaConfig(aiChatProcessRaw, 'os/ai/process.maia')
const dbActor = annotateMaiaConfig(dbActorRaw, 'os/db/actor.maia')
const dbInterface = annotateMaiaConfig(dbInterfaceRaw, 'os/db/interface.maia')
const dbProcess = annotateMaiaConfig(dbProcessRaw, 'os/db/process.maia')
const osMessagesActor = annotateMaiaConfig(osMessagesActorRaw, 'os/messages/actor.maia')
const osMessagesContext = annotateMaiaConfig(osMessagesContextRaw, 'os/messages/context.maia')
const osMessagesInterface = annotateMaiaConfig(osMessagesInterfaceRaw, 'os/messages/interface.maia')
const osMessagesProcess = annotateMaiaConfig(osMessagesProcessRaw, 'os/messages/process.maia')
const computeMessageNamesActor = annotateMaiaConfig(
	computeMessageNamesActorRaw,
	'services/names/actor.maia',
)
const computeMessageNamesInterface = annotateMaiaConfig(
	computeMessageNamesInterfaceRaw,
	'services/names/interface.maia',
)
const computeMessageNamesProcess = annotateMaiaConfig(
	computeMessageNamesProcessRaw,
	'services/names/process.maia',
)
const paperServiceActor = annotateMaiaConfig(paperServiceActorRaw, 'services/paper/actor.maia')
const paperServiceContext = annotateMaiaConfig(
	paperServiceContextRaw,
	'services/paper/context.maia',
)
const paperActorInterface = annotateMaiaConfig(
	paperActorInterfaceRaw,
	'services/paper/interface.maia',
)
const paperServiceProcess = annotateMaiaConfig(
	paperServiceProcessRaw,
	'services/paper/process.maia',
)
const profileImageServiceActor = annotateMaiaConfig(
	profileImageServiceActorRaw,
	'services/profile-image/actor.maia',
)
const profileImageServiceInterface = annotateMaiaConfig(
	profileImageServiceInterfaceRaw,
	'services/profile-image/interface.maia',
)
const profileImageServiceProcess = annotateMaiaConfig(
	profileImageServiceProcessRaw,
	'services/profile-image/process.maia',
)
const sandboxedAddActor = annotateMaiaConfig(
	sandboxedAddActorRaw,
	'services/sandboxed-add/actor.maia',
)
const sandboxedAddInterface = annotateMaiaConfig(
	sandboxedAddInterfaceRaw,
	'services/sandboxed-add/interface.maia',
)
const sandboxedAddProcess = annotateMaiaConfig(
	sandboxedAddProcessRaw,
	'services/sandboxed-add/process.maia',
)
const sandboxedAddWasm = annotateMaiaConfig(sandboxedAddWasmRaw, 'services/sandboxed-add/wasm.maia')
const sparkActor = annotateMaiaConfig(sparkActorRaw, 'services/spark/actor.maia')
const sparkContext = annotateMaiaConfig(sparkContextRaw, 'services/spark/context.maia')
const sparkActorInterface = annotateMaiaConfig(
	sparkActorInterfaceRaw,
	'services/spark/interface.maia',
)
const sparkProcess = annotateMaiaConfig(sparkProcessRaw, 'services/spark/process.maia')
const todosActor = annotateMaiaConfig(todosActorRaw, 'services/todos/actor.maia')
const todosContext = annotateMaiaConfig(todosContextRaw, 'services/todos/context.maia')
const todosActorInterface = annotateMaiaConfig(
	todosActorInterfaceRaw,
	'services/todos/interface.maia',
)
const todosProcess = annotateMaiaConfig(todosProcessRaw, 'services/todos/process.maia')
const updateWasmCodeActor = annotateMaiaConfig(
	updateWasmCodeActorRaw,
	'services/update-wasm-code/actor.maia',
)
const updateWasmCodeInterface = annotateMaiaConfig(
	updateWasmCodeInterfaceRaw,
	'services/update-wasm-code/interface.maia',
)
const updateWasmCodeProcess = annotateMaiaConfig(
	updateWasmCodeProcessRaw,
	'services/update-wasm-code/process.maia',
)
const addressbookAvensGridActor = annotateMaiaConfig(
	addressbookAvensGridActorRaw,
	'views/addressbook-avens-grid/actor.maia',
)
const addressbookAvensGridContext = annotateMaiaConfig(
	addressbookAvensGridContextRaw,
	'views/addressbook-avens-grid/context.maia',
)
const addressbookAvensGridInterface = annotateMaiaConfig(
	addressbookAvensGridInterfaceRaw,
	'views/addressbook-avens-grid/interface.maia',
)
const addressbookGridProcess = annotateMaiaConfig(
	addressbookGridProcessRaw,
	'views/addressbook-grid/process.maia',
)
const addressbookGridStyle = annotateMaiaConfig(
	addressbookGridStyleRaw,
	'views/addressbook-grid/style.maia',
)
const addressbookGridView = annotateMaiaConfig(
	addressbookGridViewRaw,
	'views/addressbook-grid/view.maia',
)
const addressbookHumansGridActor = annotateMaiaConfig(
	addressbookHumansGridActorRaw,
	'views/addressbook-humans-grid/actor.maia',
)
const addressbookHumansGridContext = annotateMaiaConfig(
	addressbookHumansGridContextRaw,
	'views/addressbook-humans-grid/context.maia',
)
const addressbookHumansGridInterface = annotateMaiaConfig(
	addressbookHumansGridInterfaceRaw,
	'views/addressbook-humans-grid/interface.maia',
)
const detailActor = annotateMaiaConfig(detailActorRaw, 'views/detail/actor.maia')
const detailContext = annotateMaiaConfig(detailContextRaw, 'views/detail/context.maia')
const detailInterface = annotateMaiaConfig(detailInterfaceRaw, 'views/detail/interface.maia')
const detailProcess = annotateMaiaConfig(detailProcessRaw, 'views/detail/process.maia')
const detailStyle = annotateMaiaConfig(detailStyleRaw, 'views/detail/style.maia')
const detailView = annotateMaiaConfig(detailViewRaw, 'views/detail/view.maia')
const layoutHumansActor = annotateMaiaConfig(layoutHumansActorRaw, 'views/humans/actor.maia')
const layoutHumansContext = annotateMaiaConfig(layoutHumansContextRaw, 'views/humans/context.maia')
const layoutHumansInterface = annotateMaiaConfig(
	layoutHumansInterfaceRaw,
	'views/humans/interface.maia',
)
const infoCardActor = annotateMaiaConfig(infoCardActorRaw, 'views/info-card/actor.maia')
const infoCardContext = annotateMaiaConfig(infoCardContextRaw, 'views/info-card/context.maia')
const infoCardInterface = annotateMaiaConfig(infoCardInterfaceRaw, 'views/info-card/interface.maia')
const infoCardProcess = annotateMaiaConfig(infoCardProcessRaw, 'views/info-card/process.maia')
const infoCardStyle = annotateMaiaConfig(infoCardStyleRaw, 'views/info-card/style.maia')
const infoCardView = annotateMaiaConfig(infoCardViewRaw, 'views/info-card/view.maia')
const inputForChatActor = annotateMaiaConfig(
	inputForChatActorRaw,
	'views/input/for-chat.actor.maia',
)
const inputForChatContext = annotateMaiaConfig(
	inputForChatContextRaw,
	'views/input/for-chat.context.maia',
)
const inputForChatInterface = annotateMaiaConfig(
	inputForChatInterfaceRaw,
	'views/input/for-chat.interface.maia',
)
const inputForChatProcess = annotateMaiaConfig(
	inputForChatProcessRaw,
	'views/input/for-chat.process.maia',
)
const inputForDetailActor = annotateMaiaConfig(
	inputForDetailActorRaw,
	'views/input/for-detail.actor.maia',
)
const inputForDetailContext = annotateMaiaConfig(
	inputForDetailContextRaw,
	'views/input/for-detail.context.maia',
)
const inputForDetailInterface = annotateMaiaConfig(
	inputForDetailInterfaceRaw,
	'views/input/for-detail.interface.maia',
)
const inputForListActor = annotateMaiaConfig(
	inputForListActorRaw,
	'views/input/for-list.actor.maia',
)
const inputForListContext = annotateMaiaConfig(
	inputForListContextRaw,
	'views/input/for-list.context.maia',
)
const inputForListInterface = annotateMaiaConfig(
	inputForListInterfaceRaw,
	'views/input/for-list.interface.maia',
)
const inputForListProcess = annotateMaiaConfig(
	inputForListProcessRaw,
	'views/input/for-list.process.maia',
)
const inputForSparksActor = annotateMaiaConfig(
	inputForSparksActorRaw,
	'views/input/for-sparks.actor.maia',
)
const inputForSparksContext = annotateMaiaConfig(
	inputForSparksContextRaw,
	'views/input/for-sparks.context.maia',
)
const inputForSparksInterface = annotateMaiaConfig(
	inputForSparksInterfaceRaw,
	'views/input/for-sparks.interface.maia',
)
const inputProcess = annotateMaiaConfig(inputProcessRaw, 'views/input/process.maia')
const inputStyle = annotateMaiaConfig(inputStyleRaw, 'views/input/style.maia')
const inputView = annotateMaiaConfig(inputViewRaw, 'views/input/view.maia')
const layoutChatActor = annotateMaiaConfig(layoutChatActorRaw, 'views/layout-chat/actor.maia')
const layoutChatContext = annotateMaiaConfig(layoutChatContextRaw, 'views/layout-chat/context.maia')
const layoutChatInterface = annotateMaiaConfig(
	layoutChatInterfaceRaw,
	'views/layout-chat/interface.maia',
)
const layoutChatProcess = annotateMaiaConfig(layoutChatProcessRaw, 'views/layout-chat/process.maia')
const layoutChatView = annotateMaiaConfig(layoutChatViewRaw, 'views/layout-chat/view.maia')
const layoutPaperActor = annotateMaiaConfig(layoutPaperActorRaw, 'views/layout-paper/actor.maia')
const layoutPaperContext = annotateMaiaConfig(
	layoutPaperContextRaw,
	'views/layout-paper/context.maia',
)
const layoutPaperInterface = annotateMaiaConfig(
	layoutPaperInterfaceRaw,
	'views/layout-paper/interface.maia',
)
const layoutPaperProcess = annotateMaiaConfig(
	layoutPaperProcessRaw,
	'views/layout-paper/process.maia',
)
const layoutPaperStyle = annotateMaiaConfig(layoutPaperStyleRaw, 'views/layout-paper/style.maia')
const layoutPaperView = annotateMaiaConfig(layoutPaperViewRaw, 'views/layout-paper/view.maia')
const listActor = annotateMaiaConfig(listActorRaw, 'views/list/actor.maia')
const listContext = annotateMaiaConfig(listContextRaw, 'views/list/context.maia')
const listInterface = annotateMaiaConfig(listInterfaceRaw, 'views/list/interface.maia')
const listProcess = annotateMaiaConfig(listProcessRaw, 'views/list/process.maia')
const listStyle = annotateMaiaConfig(listStyleRaw, 'views/list/style.maia')
const listView = annotateMaiaConfig(listViewRaw, 'views/list/view.maia')
const listDetailStyle = annotateMaiaConfig(listDetailStyleRaw, 'views/list-detail/style.maia')
const logsActor = annotateMaiaConfig(logsActorRaw, 'views/logs/actor.maia')
const logsContext = annotateMaiaConfig(logsContextRaw, 'views/logs/context.maia')
const logsInterface = annotateMaiaConfig(logsInterfaceRaw, 'views/logs/interface.maia')
const logsProcess = annotateMaiaConfig(logsProcessRaw, 'views/logs/process.maia')
const logsStyle = annotateMaiaConfig(logsStyleRaw, 'views/logs/style.maia')
const logsView = annotateMaiaConfig(logsViewRaw, 'views/logs/view.maia')
const messagesActor = annotateMaiaConfig(messagesActorRaw, 'views/messages/actor.maia')
const messagesContext = annotateMaiaConfig(messagesContextRaw, 'views/messages/context.maia')
const messagesInterface = annotateMaiaConfig(messagesInterfaceRaw, 'views/messages/interface.maia')
const messagesProcess = annotateMaiaConfig(messagesProcessRaw, 'views/messages/process.maia')
const messagesStyle = annotateMaiaConfig(messagesStyleRaw, 'views/messages/style.maia')
const messagesView = annotateMaiaConfig(messagesViewRaw, 'views/messages/view.maia')
const paperActor = annotateMaiaConfig(paperActorRaw, 'views/paper/actor.maia')
const paperContext = annotateMaiaConfig(paperContextRaw, 'views/paper/context.maia')
const paperInterface = annotateMaiaConfig(paperInterfaceRaw, 'views/paper/interface.maia')
const paperProcess = annotateMaiaConfig(paperProcessRaw, 'views/paper/process.maia')
const paperStyle = annotateMaiaConfig(paperStyleRaw, 'views/paper/style.maia')
const paperView = annotateMaiaConfig(paperViewRaw, 'views/paper/view.maia')
const placeholderActor = annotateMaiaConfig(placeholderActorRaw, 'views/placeholder/actor.maia')
const placeholderContext = annotateMaiaConfig(
	placeholderContextRaw,
	'views/placeholder/context.maia',
)
const placeholderInterface = annotateMaiaConfig(
	placeholderInterfaceRaw,
	'views/placeholder/interface.maia',
)
const placeholderProcess = annotateMaiaConfig(
	placeholderProcessRaw,
	'views/placeholder/process.maia',
)
const placeholderStyle = annotateMaiaConfig(placeholderStyleRaw, 'views/placeholder/style.maia')
const placeholderView = annotateMaiaConfig(placeholderViewRaw, 'views/placeholder/view.maia')
const profileImageContext = annotateMaiaConfig(
	profileImageContextRaw,
	'views/profile-image/context.maia',
)
const profileImageStyle = annotateMaiaConfig(profileImageStyleRaw, 'views/profile-image/style.maia')
const profileImageView = annotateMaiaConfig(profileImageViewRaw, 'views/profile-image/view.maia')
const layoutSparksActor = annotateMaiaConfig(layoutSparksActorRaw, 'views/sparks/actor.maia')
const layoutSparksContext = annotateMaiaConfig(layoutSparksContextRaw, 'views/sparks/context.maia')
const layoutSparksInterface = annotateMaiaConfig(
	layoutSparksInterfaceRaw,
	'views/sparks/interface.maia',
)
const layoutSparksProcess = annotateMaiaConfig(layoutSparksProcessRaw, 'views/sparks/process.maia')
const sparksStyle = annotateMaiaConfig(sparksStyleRaw, 'views/sparks/style.maia')
const sparksView = annotateMaiaConfig(sparksViewRaw, 'views/sparks/view.maia')
const tabsProcess = annotateMaiaConfig(tabsProcessRaw, 'views/tabs/process.maia')
const tabsStyle = annotateMaiaConfig(tabsStyleRaw, 'views/tabs/style.maia')
const layoutTodosActor = annotateMaiaConfig(layoutTodosActorRaw, 'views/tabs/todos.actor.maia')
const layoutTodosContext = annotateMaiaConfig(
	layoutTodosContextRaw,
	'views/tabs/todos.context.maia',
)
const layoutTodosInterface = annotateMaiaConfig(
	layoutTodosInterfaceRaw,
	'views/tabs/todos.interface.maia',
)
const tabsView = annotateMaiaConfig(tabsViewRaw, 'views/tabs/view.maia')

/** Build actor config for seeding - uses actor schema; identity from $id only (no @label). */
function toActorConfig(raw, inboxId) {
	const { interface: iface, process: processRef, $id } = raw
	if (!$id || !iface || !processRef) return null
	if (typeof $id !== 'string' || !$id.startsWith('°maia/')) return null
	if (!isActorFilePathId($id)) return null
	return {
		$factory: '°maia/factory/actor',
		$id,
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
		$factory: '°maia/factory/inbox',
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
		[sandboxedAddWasm.$id]: sandboxedAddWasm,
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

export { SEED_DATA } from '@MaiaOS/universe/data'
