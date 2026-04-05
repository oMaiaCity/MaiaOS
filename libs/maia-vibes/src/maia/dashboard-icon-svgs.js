/**
 * Dashboard card icon SVG strings — single source: instance files under data/icons/.
 * Schema: °maia/factory/os/cotext (see @MaiaOS/factories/os/vibe.factory.json icon.$co).
 */
import chat from './data/icons/chat.maia'
import creator from './data/icons/creator.maia'
import humans from './data/icons/humans.maia'
import logs from './data/icons/logs.maia'
import paper from './data/icons/paper.maia'
import profile from './data/icons/profile.maia'
import quickjsAdd from './data/icons/quickjs-add.maia'
import registries from './data/icons/registries.maia'
import sparks from './data/icons/sparks.maia'
import todos from './data/icons/todos.maia'

export const DEFAULT_CARD_ICON_SVG = chat.svg

/** @type {Record<string, string>} */
export const ICON_SVG_BY_KEY = {
	todos: todos.svg,
	paper: paper.svg,
	sparks: sparks.svg,
	profile: profile.svg,
	registries: registries.svg,
	humans: humans.svg,
	logs: logs.svg,
	creator: creator.svg,
	chat: chat.svg,
	'quickjs-add': quickjsAdd.svg,
}

/**
 * Rows for Genesis `data.dashboardIconCotexts` (seeded before vibe configs).
 * @param {string[]} vibeKeys — keys from the selected vibe registries (same order as `configs.vibes`)
 */
export function dashboardIconCotextSeedRows(vibeKeys) {
	const rows = []
	for (const key of vibeKeys) {
		const svg = ICON_SVG_BY_KEY[key]
		if (typeof svg !== 'string' || !svg.trim()) {
			throw new Error(`[vibes] dashboard icon SVG missing for vibe key "${key}"`)
		}
		rows.push({ vibeKey: key, svg })
	}
	return rows
}
