/**
 * Layout Vibe Configuration
 * Testing ground for compositor layout techniques
 */

import type { VibeConfig } from '../../compositor/types'
import { stateMachine } from './stateMachine'
import { rootComposite } from './composites'

export const layoutVibeConfig: VibeConfig = {
	id: 'layout',
	name: 'Layout',
	stateMachine,
	view: {
		composite: rootComposite,
	},
}

