/**
 * Logs Vibe Loader
 */

import { createAvenLoader } from '../../loader.js'
import { LogsAvenRegistry } from './registry.js'

export const loadLogsAven = createAvenLoader('logs', LogsAvenRegistry, ['db', 'core'])
export { MaiaOS } from '../../loader.js'
export { LogsAvenRegistry } from './registry.js'
