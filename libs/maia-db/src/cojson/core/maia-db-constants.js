/** Key used in `account.sparks` CoMap for the primary OS spark (written at seed). */
export const SYSTEM_SPARK_REGISTRY_KEY = '°maia'

/**
 * Spark CoMap `name` is a stable logical ref (°…) and is usually the key in `account.sparks`.
 * Plain-text input is normalized to a single segment: `°<slug>` (e.g. "xyz" → "°xyz").
 * Full logical refs may be passed unchanged if they already start with `°`.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeSparkLogicalName(raw) {
	const trimmed = typeof raw === 'string' ? raw.trim() : ''
	if (!trimmed) {
		throw new Error('[MaiaDB] createSpark: name is required (short label or full °… logical ref)')
	}
	if (trimmed.startsWith('°')) return trimmed
	let slug = trimmed
		.replace(/[^\p{L}\p{N}_-]/gu, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
	slug = slug.slice(0, 80)
	if (!slug) {
		const suffix =
			typeof crypto !== 'undefined' && crypto.randomUUID
				? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
				: String(Math.random()).slice(2, 10)
		slug = `spark-${suffix}`
	}
	return `°${slug.toLowerCase()}`
}
