/**
 * Todos Vibe Loader
 */

import { TodosVibeRegistry } from '../../../../generated/registry.js'
import { createVibeLoader } from '../../loader.js'

export const loadTodosVibe = createVibeLoader('todos', TodosVibeRegistry, ['db', 'core'])
export { MaiaOS } from '../../loader.js'
export { TodosVibeRegistry }
