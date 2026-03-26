/**
 * In-memory manual simulation tick (Phase 1): wood dome + ore dome add to city totals.
 */

/**
 * @returns {{
 *   tick: number,
 *   wood: number,
 *   ore: number,
 *   woodPerTick: number,
 *   orePerTick: number,
 * }}
 */
export function createTickState() {
	return {
		tick: 0,
		wood: 0,
		ore: 0,
		woodPerTick: 2,
		orePerTick: 1,
	}
}

/**
 * @param {ReturnType<typeof createTickState>} state
 */
export function advanceTick(state) {
	state.tick += 1
	state.wood += state.woodPerTick
	state.ore += state.orePerTick
	return state
}
