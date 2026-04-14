/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

export * from './sparks/maia/registry.js'

import { getVibeKey } from './helpers/vibe-keys.js'

import { ChatVibeRegistry } from './sparks/maia/vibes/chat/registry.js'
import { RegistriesVibeRegistry } from './sparks/maia/vibes/humans/registry.js'
import { LogsVibeRegistry } from './sparks/maia/vibes/logs/registry.js'
import { PaperVibeRegistry } from './sparks/maia/vibes/paper/registry.js'
import { ProfileVibeRegistry } from './sparks/maia/vibes/profile/registry.js'
import { QuickjsVibeRegistry } from './sparks/maia/vibes/quickjs/registry.js'
import { SparksVibeRegistry } from './sparks/maia/vibes/sparks/registry.js'
import { TodosVibeRegistry } from './sparks/maia/vibes/todos/registry.js'

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

export const ALL_VIBE_REGISTRIES = collected

export async function getAllVibeRegistries() {
	return ALL_VIBE_REGISTRIES.filter((R) => R?.vibe)
}
