/**
 * Sparks Vibe Loader
 */

import { SparksVibeRegistry } from '../../../../generated/registry.js'
import { createVibeLoader } from '../../loader.js'

export const loadSparksVibe = createVibeLoader('sparks', SparksVibeRegistry, ['db', 'sparks'])
export { MaiaOS } from '../../loader.js'
export { SparksVibeRegistry }
