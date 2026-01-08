/**
 * Actor Types
 * Type definitions for Actor configuration
 */

export interface ActorConfig {
	context: Record<string, unknown>
	view: unknown // CompositeConfig or LeafNode - actor owns its view
	dependencies: Record<string, string> // name -> CoValue ID
}
