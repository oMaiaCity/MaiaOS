/**
 * Unified seed config: vibe merge (buildSeedConfig) + service/UI tables (getSeedConfig).
 */

import { isActorFilePathId } from '../../migrations/004-actors/actor-service-refs.js'
import { parseDataMaiaBracketRef } from '../bracket-ref.js'
import { maiaIdentity } from '../identity-from-maia-path.js'
import { getVibeKey } from '../vibe-keys.js'
import { deriveInboxId } from './derive-inbox.js'
import { MAIA_SPARK_REGISTRY, SEED_DATA } from './registry-merge.js'

const VIBE_SCHEMA = '°maia/factory/vibe.factory.json'
const INBOX_SCHEMA = '°maia/factory/inbox.factory.json'
/** Instance shape for inbox.factory.json (schema says cotype: costream). */
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

/**
 * Merge `registry.data` into `merged.data`.
 * Buckets are `{ $factory, instances }`; concatenate `instances` when both sides use that shape.
 */
function mergeSeedDataBucket(mergedData, registryData) {
	if (!registryData || typeof registryData !== 'object') return
	for (const [key, value] of Object.entries(registryData)) {
		const prev = mergedData[key]
		if (
			prev &&
			typeof prev === 'object' &&
			typeof value === 'object' &&
			Array.isArray(prev.instances) &&
			Array.isArray(value.instances)
		) {
			mergedData[key] = {
				...prev,
				instances: prev.instances.concat(value.instances),
			}
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
	if (typeof normalized.icon !== 'string' || !normalized.icon.startsWith('°maia/data/')) {
		throw new Error(
			`[vibes] manifest must set icon: bracket ref °maia/data/icons.data.json[<nanoid>] (vibe "${key}")`,
		)
	}
	if (!Array.isArray(normalized.runtime)) {
		normalized.runtime = ['browser']
	}
	return normalized
}

function validateIconsSeedData() {
	const icons = SEED_DATA.icons
	if (!icons || typeof icons !== 'object' || !Array.isArray(icons.instances)) {
		throw new Error('[vibes] SEED_DATA.icons must be { $factory, instances } from icons.data.json')
	}
	for (const row of icons.instances) {
		if (!row || typeof row.svg !== 'string' || !row.svg.trim()) {
			throw new Error('[vibes] each icons.data.json row needs non-empty svg')
		}
		if (typeof row.$nanoid !== 'string' || !row.$nanoid.trim()) {
			throw new Error('[vibes] each icons.data.json row needs $nanoid')
		}
	}
}

function validateVibeIconsAgainstSeed(vibes) {
	const nanos = new Set((SEED_DATA.icons.instances || []).map((r) => r.$nanoid))
	for (const vibe of vibes) {
		const icon = vibe?.icon
		const bracket = typeof icon === 'string' ? parseDataMaiaBracketRef(icon) : null
		if (!bracket || !nanos.has(bracket.itemNanoid)) {
			const k = getVibeKey(vibe) || '?'
			throw new Error(
				`[vibes] vibe "${k}" icon must be °maia/data/icons.data.json[<nanoid>] with nanoid from SEED_DATA.icons.instances`,
			)
		}
	}
}

export function buildSeedConfig(vibeRegistries) {
	validateIconsSeedData()
	const validRegistries = vibeRegistries.filter((r) => r?.vibe && typeof r.vibe === 'object')
	if (vibeRegistries.length > 0 && validRegistries.length === 0) {
		throw new Error(
			'[vibes] All vibe manifests invalid (null or not object). Ensure seed JSON under libs/universe/src/avens/maia/seed is valid.',
		)
	}
	const vibesNorm = validRegistries.map((r) => normalizeVibeForSeeding(r.vibe))
	validateVibeIconsAgainstSeed(vibesNorm)

	const merged = {
		styles: {},
		actors: {},
		views: {},
		contexts: {},
		processes: {},
		interfaces: {},
		inboxes: {},
		wasms: {},
		vibes: vibesNorm,
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
	const brandNk = maiaIdentity('brand/maiacity.style.json').$nanoid
	const brandEntry = MAIA_SPARK_REGISTRY[brandNk]
	if (!brandEntry || typeof brandEntry !== 'object') {
		throw new Error(
			'[vibes] brand/maiacity.style.json missing from MAIA_SPARK_REGISTRY — run bun migrate:registry',
		)
	}
	merged.styles['brand/maiacity.style.json'] = brandEntry
	if (validRegistries.length > 0) {
		merged.data.icons = structuredClone(SEED_DATA.icons)
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
		$factory: '°maia/factory/actor.factory.json',
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
		$factory: '°maia/factory/inbox.factory.json',
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
			`[build-seed-config] missing MAIA_SPARK_REGISTRY[${id.$nanoid}] for path '${p}' — run bun migrate:registry`,
		)
	}
	return v
}

export function getSeedConfig() {
	const actorDefs = [
		['services/ai/actor.json', 'services/ai/process.json'],
		['services/names/actor.json', 'services/names/process.json'],
		['services/db/actor.json', 'services/db/process.json'],
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
		'services/ai/interface.json',
		'services/db/interface.json',
		'services/names/interface.json',
		'services/messages/interface.json',
		'services/paper/interface.json',
		'services/profile-image/interface.json',
		'services/sandboxed-add/interface.json',
		'services/update-wasm-code/interface.json',
		'services/spark/interface.json',
		'services/todos/interface.json',
		'views/detail/interface.json',
		'views/humans/interface.json',
		'views/input/for-chat.interface.json',
		'views/input/for-detail.interface.json',
		'views/input/for-list.interface.json',
		'views/input/for-sparks.interface.json',
		'views/list/interface.json',
		'views/logs/interface.json',
		'views/messages/interface.json',
		'views/info-card/interface.json',
		'views/layout-chat/interface.json',
		'views/layout-paper/interface.json',
		'views/paper/interface.json',
		'views/placeholder/interface.json',
		'views/sparks/interface.json',
		'views/tabs/todos.interface.json',
		'views/addressbook-humans-grid/interface.json',
		'views/addressbook-avens-grid/interface.json',
	]
	for (const p of interfacePaths) {
		const iface = a(p)
		if (iface?.$nanoid) interfaces[p] = iface
	}

	const viewActorGroups = [
		[
			'views/placeholder/actor.json',
			'views/placeholder/context.json',
			'views/placeholder/view.json',
			'views/placeholder/process.json',
			'views/placeholder/style.json',
		],
		[
			'views/tabs/todos.actor.json',
			'views/tabs/todos.context.json',
			'views/tabs/view.json',
			'views/tabs/process.json',
			'views/tabs/style.json',
		],
		[
			'views/list/actor.json',
			'views/list/context.json',
			'views/list/view.json',
			'views/list/process.json',
			'views/list/style.json',
		],
		[
			'views/sparks/actor.json',
			'views/sparks/context.json',
			'views/sparks/view.json',
			'views/sparks/process.json',
			'views/sparks/style.json',
		],
		[
			'views/input/for-list.actor.json',
			'views/input/for-list.context.json',
			'views/input/view.json',
			'views/input/for-list.process.json',
			'views/input/style.json',
		],
		[
			'views/input/for-sparks.actor.json',
			'views/input/for-sparks.context.json',
			'views/input/view.json',
			'views/input/process.json',
			'views/input/style.json',
		],
		[
			'views/input/for-chat.actor.json',
			'views/input/for-chat.context.json',
			'views/input/view.json',
			'views/input/for-chat.process.json',
			'views/input/style.json',
		],
		[
			'views/input/for-detail.actor.json',
			'views/input/for-detail.context.json',
			'views/input/view.json',
			'views/input/process.json',
			'views/input/style.json',
		],
		[
			'views/humans/actor.json',
			'views/humans/context.json',
			'views/tabs/view.json',
			'views/tabs/process.json',
			'views/tabs/style.json',
		],
		[
			'views/addressbook-humans-grid/actor.json',
			'views/addressbook-humans-grid/context.json',
			'views/addressbook-grid/view.json',
			'views/addressbook-grid/process.json',
			'views/addressbook-grid/style.json',
		],
		[
			'views/addressbook-avens-grid/actor.json',
			'views/addressbook-avens-grid/context.json',
			'views/addressbook-grid/view.json',
			'views/addressbook-grid/process.json',
			'views/addressbook-grid/style.json',
		],
		[
			'views/layout-chat/actor.json',
			'views/layout-chat/context.json',
			'views/layout-chat/view.json',
			'views/layout-chat/process.json',
			null,
		],
		[
			'views/info-card/actor.json',
			'views/info-card/context.json',
			'views/info-card/view.json',
			'views/info-card/process.json',
			'views/info-card/style.json',
		],
		[
			'views/layout-paper/actor.json',
			'views/layout-paper/context.json',
			'views/layout-paper/view.json',
			'views/layout-paper/process.json',
			'views/layout-paper/style.json',
		],
		[
			'views/messages/actor.json',
			'views/messages/context.json',
			'views/messages/view.json',
			'views/messages/process.json',
			'views/messages/style.json',
		],
		[
			'views/paper/actor.json',
			'views/paper/context.json',
			'views/paper/view.json',
			'views/paper/process.json',
			'views/paper/style.json',
		],
		[
			'views/logs/actor.json',
			'views/logs/context.json',
			'views/logs/view.json',
			'views/logs/process.json',
			'views/logs/style.json',
		],
		[
			'views/detail/actor.json',
			'views/detail/context.json',
			'views/detail/view.json',
			'views/detail/process.json',
			'views/detail/style.json',
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

	const listDetailStyle = a('views/list-detail/style.json')
	if (listDetailStyle?.$nanoid) uiStyles['views/list-detail/style.json'] = listDetailStyle

	const brandStyle = a('brand/maiacity.style.json')
	if (brandStyle?.$nanoid) uiStyles['brand/maiacity.style.json'] = brandStyle

	const serviceGroups = [
		[
			'services/todos/actor.json',
			'services/todos/context.json',
			'services/todos/process.json',
			null,
			null,
		],
		[
			'services/spark/actor.json',
			'services/spark/context.json',
			'services/spark/process.json',
			null,
			null,
		],
		[
			'services/paper/actor.json',
			'services/paper/context.json',
			'services/paper/process.json',
			null,
			null,
		],
		[
			'services/profile-image/actor.json',
			'views/profile-image/context.json',
			'services/profile-image/process.json',
			'views/profile-image/view.json',
			'views/profile-image/style.json',
		],
		[
			'services/messages/actor.json',
			'services/messages/context.json',
			'services/messages/process.json',
			null,
			null,
		],
		['services/sandboxed-add/actor.json', null, 'services/sandboxed-add/process.json', null, null],
		[
			'services/update-wasm-code/actor.json',
			null,
			'services/update-wasm-code/process.json',
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

	const sandboxedAddWasm = a('services/sandboxed-add/wasm.json')
	const wasms = {
		'services/sandboxed-add/wasm.json': sandboxedAddWasm,
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

export { SEED_DATA } from './registry-merge.js'
