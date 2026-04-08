/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import raw0 from '@MaiaOS/universe/data/icons/chat.maia'
import raw1 from '@MaiaOS/universe/data/icons/humans.maia'
import raw2 from '@MaiaOS/universe/data/icons/logs.maia'
import raw3 from '@MaiaOS/universe/data/icons/paper.maia'
import raw4 from '@MaiaOS/universe/data/icons/profile.maia'
import raw5 from '@MaiaOS/universe/data/icons/quickjs.maia'
import raw6 from '@MaiaOS/universe/data/icons/registries.maia'
import raw7 from '@MaiaOS/universe/data/icons/sparks.maia'
import raw8 from '@MaiaOS/universe/data/icons/todos.maia'

const _iconPairs = [
	['chat', raw0],
	['humans', raw1],
	['logs', raw2],
	['paper', raw3],
	['profile', raw4],
	['quickjs', raw5],
	['registries', raw6],
	['sparks', raw7],
	['todos', raw8],
]
export const ICON_SVG_BY_KEY = Object.fromEntries(_iconPairs.map(([key, raw]) => [key, raw.svg]))

export const DEFAULT_CARD_ICON_SVG = ICON_SVG_BY_KEY.chat ?? Object.values(ICON_SVG_BY_KEY)[0]

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
