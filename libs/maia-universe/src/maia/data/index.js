/**
 * DRY seed payloads — single source for vibe default data (M3).
 * Import from `@MaiaOS/universe/data`; do not duplicate inline in vibe registries.
 */
import iconsSeed from './icons.data.maia'
import notesSeed from './notes.data.maia'
import todosSeed from './todos.data.maia'

export const SEED_DATA = {
	todos: todosSeed,
	notes: notesSeed,
	icons: iconsSeed,
}
