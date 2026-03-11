/**
 * Paper Agent Loader
 */

import { createAgentLoader } from '../loader.js'
import { PaperAgentRegistry } from './registry.js'

export const loadPaperAgent = createAgentLoader('paper', PaperAgentRegistry, ['db', 'core'])
export { MaiaOS } from '../loader.js'
export { PaperAgentRegistry } from './registry.js'
