/**
 * Logs Vibe Loader
 */

import { createVibeLoader } from '../loader.js'
import { LogsVibeRegistry } from './registry.js'

export const loadLogsVibe = createVibeLoader('logs', LogsVibeRegistry, ['db', 'core'])
export { MaiaOS } from '../loader.js'
export { LogsVibeRegistry } from './registry.js'
