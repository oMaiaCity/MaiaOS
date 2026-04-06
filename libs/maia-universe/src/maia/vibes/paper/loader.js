/**
 * Paper Aven Loader
 */

import { createAvenLoader } from '../../loader.js'
import { PaperAvenRegistry } from './registry.js'

export const loadPaperAven = createAvenLoader('paper', PaperAvenRegistry, ['db', 'core'])
export { MaiaOS } from '../../loader.js'
export { PaperAvenRegistry } from './registry.js'
