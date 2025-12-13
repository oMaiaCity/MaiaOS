/**
 * Layout Vibe State Machine
 * Simple state for testing layout techniques with tab switching
 */

import type { StateMachineConfig } from '../../compositor/dataStore'

export const stateMachine: StateMachineConfig = {
	initial: 'idle',
	data: {
		title: 'Layout Debug',
		subtitle: 'Debugging compositor layout techniques',
		selectedLayout: 'list' as 'list' | 'row' | 'grid',
	},
	states: {
		idle: {
			on: {
				SWITCH_LAYOUT: {
					target: 'idle',
					actions: ['@layout/switchLayout'],
				},
			},
		},
	},
	actions: {
		'@layout/switchLayout': (data: Record<string, unknown>, payload?: unknown) => {
			if (payload && typeof payload === 'object' && 'layout' in payload) {
				data.selectedLayout = payload.layout as 'list' | 'row' | 'grid'
			}
		},
	},
}

