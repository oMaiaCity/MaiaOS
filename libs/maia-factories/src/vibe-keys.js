/**
 * Stable vibe key from annotated manifest or explicit °maia/vibe/<k> id.
 * Shared by @MaiaOS/vibes (seeding) and @MaiaOS/db (genesis icon CoText).
 */

/** @param {{ $id?: string, name?: string } | null | undefined} vibe */
export function getVibeKey(vibe) {
	if (!vibe) return null
	const originalVibeId = vibe.$id || ''
	if (originalVibeId.startsWith('°maia/vibe/')) {
		return originalVibeId.replace('°maia/vibe/', '')
	}
	const manifestMatch = /^°maia\/([^/]+)\/manifest\.vibe\.maia$/i.exec(originalVibeId)
	if (manifestMatch) return manifestMatch[1].toLowerCase()
	return (vibe.name || 'default').toLowerCase().replace(/\s+/g, '-')
}
