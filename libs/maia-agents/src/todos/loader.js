/**
 * Todos Vibe Loader
 */

import { createAgentLoader } from '../loader.js'
import { TodosAgentRegistry } from './registry.js'

export const loadTodosAgent = createAgentLoader('todos', TodosAgentRegistry, ['db', 'core'])
export { MaiaOS } from '../loader.js'
export { TodosAgentRegistry } from './registry.js'
