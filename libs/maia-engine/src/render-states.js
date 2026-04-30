/** Render state machine — shared by ViewEngine and ActorEngine (no view→actor import). */

export const RENDER_STATES = {
	INITIALIZING: 'initializing',
	RENDERING: 'rendering',
	READY: 'ready',
	UPDATING: 'updating',
}
