/**
 * Stable dashboard / icon key — same behavior as @MaiaOS/factories/vibe-keys.js (universe leaf).
 */

/** @param {{ key?: string, name?: string, $label?: string } | null | undefined} vibe */
export function getVibeKey(vibe) {
	if (!vibe) return null
	if (typeof vibe.key === 'string' && vibe.key.trim()) {
		return vibe.key.trim().toLowerCase()
	}
	if (typeof vibe.name === 'string' && vibe.name.trim()) {
		return vibe.name.trim().toLowerCase().replace(/\s+/g, '-')
	}
	const label = typeof vibe.$label === 'string' ? vibe.$label : ''
	if (label.startsWith('°maia/vibe/')) {
		return label.replace('°maia/vibe/', '')
	}
	return 'default'
}
