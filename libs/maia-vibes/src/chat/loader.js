/**
 * Chat Vibe Loader
 */

import { createVibeLoader } from '../loader.js'
import { ChatVibeRegistry } from './registry.js'

export const loadChatVibe = createVibeLoader('chat', ChatVibeRegistry, [
	'db',
	'core',
	'ai',
	'sparks',
])
export { MaiaOS } from '../loader.js'
export { ChatVibeRegistry } from './registry.js'
