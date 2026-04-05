/**
 * File-path ref for seeded dashboard icon CoText (SVG graphemes).
 * Instance JSON lives in @MaiaOS/vibes src/maia/data/icons/<key>.maia (not in factories).
 */
export function iconInstanceRefFromKey(key) {
	if (typeof key !== 'string' || !key.trim()) {
		throw new Error('[icon] key must be a non-empty string')
	}
	return `°maia/data/icons/${key}.maia`
}
