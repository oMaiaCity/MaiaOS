/**
 * Contract between createUnifiedStore (maia-db) and ViewEngine:
 * each resolved query key `foo` exposes `fooLoading: boolean` on merged context.
 */

export const QUERY_LOADING_SUFFIX = 'Loading'

/**
 * @param {string} k
 * @returns {boolean}
 */
export function isQueryLoadingFieldKey(k) {
	return (
		typeof k === 'string' &&
		k.length > QUERY_LOADING_SUFFIX.length &&
		k.endsWith(QUERY_LOADING_SUFFIX) &&
		k !== 'isLoading' &&
		!k.startsWith('_')
	)
}

/**
 * @param {Record<string, unknown>|null|undefined} ctx
 * @returns {boolean}
 */
export function shouldShowQueryLoadingSkeleton(ctx) {
	if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) return false
	for (const [k, v] of Object.entries(ctx)) {
		if (v !== true) continue
		if (isQueryLoadingFieldKey(k)) return true
	}
	return false
}
