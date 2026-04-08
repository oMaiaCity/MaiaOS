/**
 * Seed config for service actors — merged by sync into buildSeedConfig output.
 * Actor assets are keyed only by path under actors/ (see @MaiaOS/universe/registry).
 */

import { isActorFilePathId } from '@MaiaOS/universe/actors/actor-service-refs.js'
import { annotateMaiaByActorsPath } from '@MaiaOS/universe/registry'
import { deriveInboxId } from './derive-inbox.js'

const ann = annotateMaiaByActorsPath

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

function toInboxConfig(inboxId) {
	return {
		$factory: '°maia/factory/inbox',
		$id: inboxId,
	}
}

/**
 * @param {string} p path under actors/
 */
function a(p) {
	const v = ann[p]
	if (!v)
		throw new Error(
			`[seed-config] missing annotateMaiaByActorsPath['${p}'] — run bun scripts/generate-maia-universe-registry.mjs`,
		)
	return v
}

export function getSeedConfig() {
	const actorDefs = [
		['os/ai/actor.maia', 'os/ai/process.maia'],
		['services/names/actor.maia', 'services/names/process.maia'],
		['os/db/actor.maia', 'os/db/process.maia'],
	]

	const actors = {}
	const processes = {}
	const interfaces = {}
	const inboxes = {}

	for (const [actorPath, processPath] of actorDefs) {
		const actorDef = a(actorPath)
		const processDef = a(processPath)
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

	const interfacePaths = [
		'os/ai/interface.maia',
		'os/db/interface.maia',
		'services/names/interface.maia',
		'os/messages/interface.maia',
		'services/paper/interface.maia',
		'services/profile-image/interface.maia',
		'services/sandboxed-add/interface.maia',
		'services/update-wasm-code/interface.maia',
		'services/spark/interface.maia',
		'services/todos/interface.maia',
		'views/detail/interface.maia',
		'views/humans/interface.maia',
		'views/input/for-chat.interface.maia',
		'views/input/for-detail.interface.maia',
		'views/input/for-list.interface.maia',
		'views/input/for-sparks.interface.maia',
		'views/list/interface.maia',
		'views/logs/interface.maia',
		'views/messages/interface.maia',
		'views/info-card/interface.maia',
		'views/layout-chat/interface.maia',
		'views/layout-paper/interface.maia',
		'views/paper/interface.maia',
		'views/placeholder/interface.maia',
		'views/sparks/interface.maia',
		'views/tabs/todos.interface.maia',
		'views/addressbook-humans-grid/interface.maia',
		'views/addressbook-avens-grid/interface.maia',
	]
	for (const p of interfacePaths) {
		const iface = a(p)
		if (iface?.$id) interfaces[iface.$id] = iface
	}

	const viewActorGroups = [
		[
			'views/placeholder/actor.maia',
			'views/placeholder/context.maia',
			'views/placeholder/view.maia',
			'views/placeholder/process.maia',
			'views/placeholder/style.maia',
		],
		[
			'views/tabs/todos.actor.maia',
			'views/tabs/todos.context.maia',
			'views/tabs/view.maia',
			'views/tabs/process.maia',
			'views/tabs/style.maia',
		],
		[
			'views/list/actor.maia',
			'views/list/context.maia',
			'views/list/view.maia',
			'views/list/process.maia',
			'views/list/style.maia',
		],
		[
			'views/sparks/actor.maia',
			'views/sparks/context.maia',
			'views/sparks/view.maia',
			'views/sparks/process.maia',
			'views/sparks/style.maia',
		],
		[
			'views/input/for-list.actor.maia',
			'views/input/for-list.context.maia',
			'views/input/view.maia',
			'views/input/for-list.process.maia',
			'views/input/style.maia',
		],
		[
			'views/input/for-sparks.actor.maia',
			'views/input/for-sparks.context.maia',
			'views/input/view.maia',
			'views/input/process.maia',
			'views/input/style.maia',
		],
		[
			'views/input/for-chat.actor.maia',
			'views/input/for-chat.context.maia',
			'views/input/view.maia',
			'views/input/for-chat.process.maia',
			'views/input/style.maia',
		],
		[
			'views/input/for-detail.actor.maia',
			'views/input/for-detail.context.maia',
			'views/input/view.maia',
			'views/input/process.maia',
			'views/input/style.maia',
		],
		[
			'views/humans/actor.maia',
			'views/humans/context.maia',
			'views/tabs/view.maia',
			'views/tabs/process.maia',
			'views/tabs/style.maia',
		],
		[
			'views/addressbook-humans-grid/actor.maia',
			'views/addressbook-humans-grid/context.maia',
			'views/addressbook-grid/view.maia',
			'views/addressbook-grid/process.maia',
			'views/addressbook-grid/style.maia',
		],
		[
			'views/addressbook-avens-grid/actor.maia',
			'views/addressbook-avens-grid/context.maia',
			'views/addressbook-grid/view.maia',
			'views/addressbook-grid/process.maia',
			'views/addressbook-grid/style.maia',
		],
		[
			'views/layout-chat/actor.maia',
			'views/layout-chat/context.maia',
			'views/layout-chat/view.maia',
			'views/layout-chat/process.maia',
			null,
		],
		[
			'views/info-card/actor.maia',
			'views/info-card/context.maia',
			'views/info-card/view.maia',
			'views/info-card/process.maia',
			'views/info-card/style.maia',
		],
		[
			'views/layout-paper/actor.maia',
			'views/layout-paper/context.maia',
			'views/layout-paper/view.maia',
			'views/layout-paper/process.maia',
			'views/layout-paper/style.maia',
		],
		[
			'views/messages/actor.maia',
			'views/messages/context.maia',
			'views/messages/view.maia',
			'views/messages/process.maia',
			'views/messages/style.maia',
		],
		[
			'views/paper/actor.maia',
			'views/paper/context.maia',
			'views/paper/view.maia',
			'views/paper/process.maia',
			'views/paper/style.maia',
		],
		[
			'views/logs/actor.maia',
			'views/logs/context.maia',
			'views/logs/view.maia',
			'views/logs/process.maia',
			'views/logs/style.maia',
		],
		[
			'views/detail/actor.maia',
			'views/detail/context.maia',
			'views/detail/view.maia',
			'views/detail/process.maia',
			'views/detail/style.maia',
		],
	]

	const uiContexts = {}
	const uiViews = {}
	const uiProcesses = {}
	const uiStyles = {}

	for (const row of viewActorGroups) {
		const [ap, cp, vp, pp, sp] = row
		const actor = a(ap)
		const context = a(cp)
		const view = a(vp)
		const process = a(pp)
		const style = sp ? a(sp) : null
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

	const listDetailStyle = a('views/list-detail/style.maia')
	if (listDetailStyle?.$id) uiStyles[listDetailStyle.$id] = listDetailStyle

	const serviceGroups = [
		[
			'services/todos/actor.maia',
			'services/todos/context.maia',
			'services/todos/process.maia',
			null,
			null,
		],
		[
			'services/spark/actor.maia',
			'services/spark/context.maia',
			'services/spark/process.maia',
			null,
			null,
		],
		[
			'services/paper/actor.maia',
			'services/paper/context.maia',
			'services/paper/process.maia',
			null,
			null,
		],
		[
			'services/profile-image/actor.maia',
			'views/profile-image/context.maia',
			'services/profile-image/process.maia',
			'views/profile-image/view.maia',
			'views/profile-image/style.maia',
		],
		['os/messages/actor.maia', 'os/messages/context.maia', 'os/messages/process.maia', null, null],
		['services/sandboxed-add/actor.maia', null, 'services/sandboxed-add/process.maia', null, null],
		[
			'services/update-wasm-code/actor.maia',
			null,
			'services/update-wasm-code/process.maia',
			null,
			null,
		],
	]

	for (const row of serviceGroups) {
		const [ap, cp, pp, vp, sp] = row
		const actor = a(ap)
		const context = cp ? a(cp) : null
		const proc = a(pp)
		const view = vp ? a(vp) : null
		const styleCfg = sp ? a(sp) : null
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

	const allProcesses = { ...processes, ...uiProcesses }

	const sandboxedAddWasm = a('services/sandboxed-add/wasm.maia')
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

export { SEED_DATA } from '@MaiaOS/universe/registry'
