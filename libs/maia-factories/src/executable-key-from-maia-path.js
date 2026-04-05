/**
 * Derives native JS dispatch key from stable °Maia/... $id path.
 * Same semantics as former config @label with the leading @ stripped.
 *
 * Examples:
 * - °Maia/chat/actor/intent → chat/intent
 * - °Maia/actor/views/sparks → maia/actor/views/sparks
 */

/**
 * @param {string} maiaPath - Opaque label from $label (typically same as pre-seed $id)
 * @returns {string|null}
 */
export function executableKeyFromMaiaPath(maiaPath) {
	if (typeof maiaPath !== 'string' || !maiaPath.startsWith('°')) return null
	const s = maiaPath.slice(1)
	// Maia/<segment>/actor/intent → <segment>/intent (vibe intent root actors)
	const intent = /^Maia\/([^/]+)\/actor\/intent$/.exec(s)
	if (intent) return `${intent[1]}/intent`
	if (s.startsWith('Maia/')) return `maia/${s.slice(5)}`
	return s
}
