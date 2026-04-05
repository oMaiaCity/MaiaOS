/**
 * Chat Vibe Loader
 */

import { createAvenLoader } from '../loader.js'
import { ChatAvenRegistry } from './registry.js'

export const loadChatAven = createAvenLoader('chat', ChatAvenRegistry, [
	'db',
	'core',
	'ai',
	'sparks',
])
export { MaiaOS } from '../loader.js'
export { ChatAvenRegistry } from './registry.js'
