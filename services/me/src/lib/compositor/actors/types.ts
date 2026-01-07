/**
 * Actor Types
 * Type definitions for Actor configuration
 */

export interface ActorStates {
	[stateName: string]: {
		on?: Record<string, { target: string; actions?: string[] } | string>
		entry?: string[]
		exit?: string[]
	}
}

export interface ActorConfig {
	currentState: string
	states: ActorStates
	context: Record<string, unknown>
	view: unknown // CompositeConfig or LeafNode - actor owns its view
	dependencies: Record<string, string> // name -> CoValue ID
}
