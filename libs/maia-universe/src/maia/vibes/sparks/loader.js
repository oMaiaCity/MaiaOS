/**
 * Sparks Vibe Loader
 */

import { createVibeLoader } from '../../loader.js'
import { SparksVibeRegistry } from './registry.js'

export const loadSparksVibe = createVibeLoader('sparks', SparksVibeRegistry, ['db', 'sparks'])
export { MaiaOS } from '../../loader.js'
export { SparksVibeRegistry } from './registry.js'
