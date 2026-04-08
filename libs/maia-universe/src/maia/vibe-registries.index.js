/**
 * Single index of all vibe registries (explicit imports — Bun has no import.meta.glob at runtime).
 */

import { getVibeKey } from '@MaiaOS/factories/vibe-keys'
import { ChatVibeRegistry } from './vibes/chat/registry.js'
import { RegistriesVibeRegistry } from './vibes/humans/registry.js'
import { LogsVibeRegistry } from './vibes/logs/registry.js'
import { PaperVibeRegistry } from './vibes/paper/registry.js'
import { ProfileVibeRegistry } from './vibes/profile/registry.js'
import { QuickjsVibeRegistry } from './vibes/quickjs/registry.js'
import { SparksVibeRegistry } from './vibes/sparks/registry.js'
import { TodosVibeRegistry } from './vibes/todos/registry.js'

const collected = [
	ChatVibeRegistry,
	RegistriesVibeRegistry,
	LogsVibeRegistry,
	PaperVibeRegistry,
	ProfileVibeRegistry,
	QuickjsVibeRegistry,
	SparksVibeRegistry,
	TodosVibeRegistry,
]

collected.sort((a, b) => (getVibeKey(a.vibe) || '').localeCompare(getVibeKey(b.vibe) || ''))

/** @type {readonly object[]} */
export const ALL_VIBE_REGISTRIES = collected

/**
 * @returns {Promise<object[]>}
 */
export async function getAllVibeRegistries() {
	return ALL_VIBE_REGISTRIES.filter((R) => R?.vibe)
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
