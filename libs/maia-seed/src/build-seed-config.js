import { iconInstanceRefFromKey } from '@MaiaOS/factories/icon-instance-ref'
import { getVibeKey } from '@MaiaOS/factories/vibe-keys'
import { dashboardIconCotextSeedRows, ICON_SVG_BY_KEY } from '@MaiaOS/universe/dashboard-icon-svgs'
import { SEED_DATA } from '@MaiaOS/universe/data'
import { deriveInboxId } from './derive-inbox.js'

const VIBE_SCHEMA = '°maia/factory/vibe'
const INBOX_SCHEMA = '°maia/factory/inbox'

function normalizeVibeForSeeding(vibe) {
	if (!vibe || typeof vibe !== 'object') {
		throw new Error('[vibes] Vibe must be a non-null object')
	}
	const key = getVibeKey(vibe)
	if (!key) {
		throw new Error('[vibes] Could not derive vibe key from manifest (missing $id / name)')
	}
	const normalized = { ...vibe }
	if (!normalized.$factory || typeof normalized.$factory !== 'string') {
		normalized.$factory = VIBE_SCHEMA
	}
	if (!normalized.$id?.startsWith('°maia/vibe/')) {
		normalized.$id = `°maia/vibe/${key}`
	}
	normalized.icon = iconInstanceRefFromKey(key)
	if (!Array.isArray(normalized.runtime)) {
		normalized.runtime = ['browser']
	}
	return normalized
}

export function buildSeedConfig(vibeRegistries) {
	for (const k of SEED_DATA.icons.dashboardVibeKeys) {
		if (!(k in ICON_SVG_BY_KEY)) {
			throw new Error(
				`[vibes] data/icons.data.maia lists unknown vibe key "${k}" (no SVG in dashboard-icon-svgs)`,
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
		Object.assign(merged.styles, registry.styles || {})
		Object.assign(merged.actors, registry.actors || {})
		Object.assign(merged.views, registry.views || {})
		Object.assign(merged.contexts, registry.contexts || {})
		Object.assign(merged.processes, registry.processes || {})
		Object.assign(merged.interfaces, registry.interfaces || {})
		Object.assign(merged.wasms, registry.wasms || {})
		Object.assign(merged.data, registry.data || {})
	}
	const vibeKeysForIcons = validRegistries.map((r) => getVibeKey(r.vibe)).filter(Boolean)
	merged.data.dashboardIconCotexts = dashboardIconCotextSeedRows(vibeKeysForIcons)
	for (const [actorId, config] of Object.entries(merged.actors)) {
		const inboxId = deriveInboxId(actorId)
		if (inboxId) {
			config.inbox = inboxId
			merged.inboxes[inboxId] = { $factory: INBOX_SCHEMA, $id: inboxId }
		}
	}
	return { configs: merged, data: merged.data || {} }
}
