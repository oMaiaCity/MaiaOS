/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { getVibeKey } from '../helpers/vibe-keys.js'

import { ChatVibeRegistry } from './vibes/chat/registry.js'
import { RegistriesVibeRegistry } from './vibes/humans/registry.js'
import { LogsVibeRegistry } from './vibes/logs/registry.js'
import { PaperVibeRegistry } from './vibes/paper/registry.js'
import { ProfileVibeRegistry } from './vibes/profile/registry.js'
import { QuickjsVibeRegistry } from './vibes/quickjs/registry.js'
import { SparksVibeRegistry } from './vibes/sparks/registry.js'
import { TodosVibeRegistry } from './vibes/todos/registry.js'

export * from './registry-core.js'
export * from './registry-icons.js'

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
