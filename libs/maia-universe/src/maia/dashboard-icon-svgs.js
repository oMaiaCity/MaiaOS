/**
 * Dashboard card icon SVG strings — single source: instance files under data/icons/.
 * Schema: °maia/factory/os/cotext (see src/maia/factories/vibe.factory.maia icon.$co).
 */
import chat from './vibes/data/icons/chat.maia'
import humans from './vibes/data/icons/humans.maia'
import logs from './vibes/data/icons/logs.maia'
import paper from './vibes/data/icons/paper.maia'
import profile from './vibes/data/icons/profile.maia'
import quickjs from './vibes/data/icons/quickjs.maia'
import registries from './vibes/data/icons/registries.maia'
import sparks from './vibes/data/icons/sparks.maia'
import todos from './vibes/data/icons/todos.maia'

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
	chat: chat.svg,
	quickjs: quickjs.svg,
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
