/**
 * Chat Vibe Loader
 */

import { createAgentLoader } from '../loader.js'
import { ChatAgentRegistry } from './registry.js'

export const loadChatAgent = createAgentLoader('chat', ChatAgentRegistry, [
	'db',
	'core',
	'ai',
	'sparks',
])
export { MaiaOS } from '../loader.js'
export { ChatAgentRegistry } from './registry.js'
