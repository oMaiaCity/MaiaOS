/**
 * Sparks Agent Loader
 */

import { createAgentLoader } from '../loader.js'
import { SparksAgentRegistry } from './registry.js'

export const loadSparksAgent = createAgentLoader('sparks', SparksAgentRegistry, ['db', 'sparks'])
export { MaiaOS } from '../loader.js'
export { SparksAgentRegistry } from './registry.js'
