/**
 * Sparks Aven Loader
 */

import { createAvenLoader } from '../loader.js'
import { SparksAvenRegistry } from './registry.js'

export const loadSparksAven = createAvenLoader('sparks', SparksAvenRegistry, ['db', 'sparks'])
export { MaiaOS } from '../loader.js'
export { SparksAvenRegistry } from './registry.js'
