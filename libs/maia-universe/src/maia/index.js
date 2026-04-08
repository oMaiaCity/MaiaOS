/**
 * MaiaOS Vibes Package
 *
 * This package contains vibe configurations (.maia files) for MaiaOS applications.
 *
 * Exports:
 * - @MaiaOS/universe/todos/loader — Loader for the Todos vibe (`src/maia/vibes/todos/`)
 * - @MaiaOS/universe/todos/registry — Registry for Todos vibe configs
 */

export { getVibeKey } from '@MaiaOS/factories/vibe-keys'
export { MaiaOS } from '@MaiaOS/loader'
export { ALL_VIBE_REGISTRIES, getAllVibeRegistries } from './vibe-registries.index.js'
export { loadSparksVibe, SparksVibeRegistry } from './vibes/sparks/loader.js'
export { SparksVibeRegistry as SparksRegistry } from './vibes/sparks/registry.js'
export { loadTodosVibe, TodosVibeRegistry } from './vibes/todos/loader.js'
export { TodosVibeRegistry as TodosRegistry } from './vibes/todos/registry.js'
