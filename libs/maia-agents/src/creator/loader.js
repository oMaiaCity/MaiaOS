/**
 * Logs Vibe Loader
 */

import { createAgentLoader } from '../loader.js'
import { LogsAgentRegistry } from './registry.js'

export const loadLogsAgent = createAgentLoader('logs', LogsAgentRegistry, ['db', 'core'])
export { MaiaOS } from '../loader.js'
export { LogsAgentRegistry } from './registry.js'
