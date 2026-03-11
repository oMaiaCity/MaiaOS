/**
 * Todos Vibe Loader
 */

import { createAvenLoader } from '../loader.js'
import { TodosAvenRegistry } from './registry.js'

export const loadTodosAven = createAvenLoader('todos', TodosAvenRegistry, ['db', 'core'])
export { MaiaOS } from '../loader.js'
export { TodosAvenRegistry } from './registry.js'
