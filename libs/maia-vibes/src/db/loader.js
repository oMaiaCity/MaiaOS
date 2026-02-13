/**
 * DB Vibe Loader
 */

import { createVibeLoader } from '../loader.js'
import { DbVibeRegistry } from './registry.js'

export const loadDbVibe = createVibeLoader('db', DbVibeRegistry, ['db', 'core'])
export { MaiaOS } from '../loader.js'
export { DbVibeRegistry } from './registry.js'
