/**
 * Unified seed config: vibe merge (buildSeedConfig) + service/UI tables (getSeedConfig).
 */

import { MAIA_SPARK_REGISTRY, SEED_DATA } from '../generated/registry.js'
import { maiaIdentity } from '../helpers/identity-from-maia-path.js'
import { getVibeKey } from '../helpers/vibe-keys.js'
import { isActorFilePathId } from '../sparks/maia/actors/index.js'
import { deriveInboxId } from './derive-inbox.js'

const VIBE_SCHEMA = '°maia/factory/vibe.factory.maia'
const INBOX_SCHEMA = '°maia/factory/inbox.factory.maia'
/** Instance shape for inbox.factory.maia (schema says cotype: costream). */
const INBOX_INSTANCE_COTYPE = 'costream'

/** Canonical `$label` → spark-relative path key for seed bucket maps (same segment list {@link maiaIdentity} hashes). */
function pathKeyFromMaiaLabel($label) {
	if (typeof $label !== 'string' || !$label.startsWith('°maia/')) {
		throw new Error(`[vibes] expected °maia/ $label, got ${String($label)}`)
	}
	return $label.slice('°maia/'.length)
}

function assignLabeledBucket(target, bucket) {
	if (!bucket || typeof bucket !== 'object') return
	for (const cfg of Object.values(bucket)) {
		if (!cfg || typeof cfg !== 'object' || typeof cfg.$label !== 'string') {
			throw new Error('[vibes] registry entry missing $label')
		}
		target[pathKeyFromMaiaLabel(cfg.$label)] = cfg
	}
}

/** deriveInboxId → logical ref so transformInstanceForSeeding resolves to co_z (bare paths are skipped). */
function inboxLogicalRef(inboxPathFromDerive) {
	return inboxPathFromDerive ? `°maia/${inboxPathFromDerive}` : null
}

/** Merge `registry.data` into `merged.data`: concatenate arrays for the same key (e.g. notes from chat + paper). */
function mergeSeedDataBucket(mergedData, registryData) {
	if (!registryData || typeof registryData !== 'object') return
	for (const [key, value] of Object.entries(registryData)) {
		if (Array.isArray(value) && Array.isArray(mergedData[key])) {
			mergedData[key] = mergedData[key].concat(value)
		} else {
			mergedData[key] = value
		}
	}
}

function normalizeVibeForSeeding(vibe) {
	if (!vibe || typeof vibe !== 'object') {
		throw new Error('[vibes] Vibe must be a non-null object')
	}
	const key = getVibeKey(vibe)
	if (!key) {
		throw new Error('[vibes] Could not derive vibe key from manifest (missing name)')
	}
	const normalized = { ...vibe }
	if (!normalized.$factory || typeof normalized.$factory !== 'string') {
		normalized.$factory = VIBE_SCHEMA
	}
	if (!normalized.$label?.startsWith('°maia/vibe/')) {
		normalized.$label = `°maia/vibe/${key}`
	}
	normalized.icon = maiaIdentity(`data/icons/${key}.maia`).$label
	if (!Array.isArray(normalized.runtime)) {
		normalized.runtime = ['browser']
	}
	return normalized
}

export function buildSeedConfig(vibeRegistries) {
	for (const k of SEED_DATA.icons.dashboardVibeKeys) {
		const entry = SEED_DATA.icons[k]
		if (!entry || typeof entry.svg !== 'string' || !entry.svg.trim()) {
			throw new Error(
				`[vibes] data/icons.data.maia lists unknown vibe key "${k}" (no SVG merged in SEED_DATA.icons)`,
			)
		}
	}
	const validRegistries = vibeRegistries.filter((r) => r?.vibe && typeof r.vibe === 'object')
	if (vibeRegistries.length > 0 && validRegistries.length === 0) {
		throw new Error(
			'[vibes] All vibe manifests invalid (null or not object). Ensure .maia files load as JSON (bunfig.toml: [loader] ".maia" = "json")',
		)
	}
	const merged = {
		styles: {},
		actors: {},
		views: {},
		contexts: {},
		processes: {},
		interfaces: {},
		inboxes: {},
		wasms: {},
		vibes: validRegistries.map((r) => normalizeVibeForSeeding(r.vibe)),
		data: {},
	}
	for (const registry of validRegistries) {
		assignLabeledBucket(merged.styles, registry.styles)
		assignLabeledBucket(merged.actors, registry.actors)
		assignLabeledBucket(merged.views, registry.views)
		assignLabeledBucket(merged.contexts, registry.contexts)
		assignLabeledBucket(merged.processes, registry.processes)
		assignLabeledBucket(merged.interfaces, registry.interfaces)
		assignLabeledBucket(merged.wasms, registry.wasms)
		mergeSeedDataBucket(merged.data, registry.data)
	}
	if (validRegistries.length > 0) {
		merged.data.icons = SEED_DATA.icons
	}
	for (const [, config] of Object.entries(merged.actors)) {
		const inboxId = deriveInboxId(pathKeyFromMaiaLabel(config.$label))
		if (inboxId) {
			config.inbox = inboxLogicalRef(inboxId)
			const id = maiaIdentity(inboxId)
			merged.inboxes[inboxId] = {
				$factory: INBOX_SCHEMA,
				$label: id.$label,
				$nanoid: id.$nanoid,
				cotype: INBOX_INSTANCE_COTYPE,
			}
		}
	}
	return { configs: merged, data: merged.data || {} }
}

function toActorConfig(raw, inboxId) {
	const { interface: iface, process: processRef, $label, $nanoid } = raw
	if (!$label || !$nanoid || !iface || !processRef) return null
	if (typeof $label !== 'string' || !$label.startsWith('°maia/')) return null
	if (!isActorFilePathId($label)) return null
	return {
		$factory: '°maia/factory/actor.factory.maia',
		$label,
		$nanoid,
		interface: iface,
		process: processRef,
		view: null,
		context: null,
		inbox: inboxId || null,
	}
}

function toInboxConfig(inboxPath) {
	const id = maiaIdentity(inboxPath)
	return {
		$factory: '°maia/factory/inbox.factory.maia',
		$label: id.$label,
		$nanoid: id.$nanoid,
		cotype: INBOX_INSTANCE_COTYPE,
	}
}

function a(p) {
	const id = maiaIdentity(p)
	const v = MAIA_SPARK_REGISTRY[id.$nanoid]
	if (!v) {
		throw new Error(
			`[build-seed-config] missing MAIA_SPARK_REGISTRY[${id.$nanoid}] for path '${p}' — run bun scripts/generate-maia-universe-registry.mjs`,
		)
	}
	return v
}

export function getSeedConfig() {
	const actorDefs = [
		['services/ai/actor.maia', 'services/ai/process.maia'],
		['services/names/actor.maia', 'services/names/process.maia'],
		['services/db/actor.maia', 'services/db/process.maia'],
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
		const inboxId = deriveInboxId(actorPath)
		if (!inboxId) continue
		actorConfig.inbox = inboxLogicalRef(inboxId)
		actors[actorPath] = actorConfig
		processes[processPath] = processDef
		inboxes[inboxId] = toInboxConfig(inboxId)
	}

	const interfacePaths = [
		'services/ai/interface.maia',
		'services/db/interface.maia',
		'services/names/interface.maia',
		'services/messages/interface.maia',
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
		if (iface?.$nanoid) interfaces[p] = iface
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
		if (actor?.$nanoid) {
			const config = { ...actor }
			const inboxId = deriveInboxId(ap)
			if (inboxId) {
				config.inbox = inboxLogicalRef(inboxId)
				inboxes[inboxId] = toInboxConfig(inboxId)
			}
			actors[ap] = config
		}
		if (context?.$nanoid) uiContexts[cp] = context
		if (view?.$nanoid) uiViews[vp] = view
		if (process?.$nanoid) uiProcesses[pp] = process
		if (style?.$nanoid && sp) uiStyles[sp] = style
	}

	const listDetailStyle = a('views/list-detail/style.maia')
	if (listDetailStyle?.$nanoid) uiStyles['views/list-detail/style.maia'] = listDetailStyle

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
		[
			'services/messages/actor.maia',
			'services/messages/context.maia',
			'services/messages/process.maia',
			null,
			null,
		],
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
		if (actor?.$nanoid) {
			const config = { ...actor }
			const inboxId = deriveInboxId(ap)
			if (inboxId) {
				config.inbox = inboxLogicalRef(inboxId)
				inboxes[inboxId] = toInboxConfig(inboxId)
			}
			actors[ap] = config
		}
		if (context?.$nanoid) uiContexts[cp] = context
		if (view?.$nanoid) uiViews[vp] = view
		if (proc?.$nanoid) uiProcesses[pp] = proc
		if (styleCfg?.$nanoid && sp) uiStyles[sp] = styleCfg
	}

	const allProcesses = { ...processes, ...uiProcesses }

	const sandboxedAddWasm = a('services/sandboxed-add/wasm.maia')
	const wasms = {
		'services/sandboxed-add/wasm.maia': sandboxedAddWasm,
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

export { SEED_DATA } from '../generated/registry.js'

if (import.meta.hot) {
	import.meta.hot.accept()
}
