/**
 * Write-side boundary: resolve string refs in JSON payloads to `co_z` before create/update.
 * Used by seed, bootstrap helpers, and migration; import from `@MaiaOS/db/seed/ref-canonicalize`.
 *
 * @param {unknown} value
 * @param {{ resolveRef: (s: string) => Promise<string> }} param1
 * @returns {Promise<unknown>}
 */
export async function canonicalizePayloadRefs(value, { resolveRef }) {
	if (value === null || value === undefined) return value
	if (typeof value === 'string') {
		if (value.startsWith('co_z') && /^co_z[a-zA-Z0-9]+$/.test(value)) return value
		// @account, @group, other sentinels stay literal; @metaSchema and namekeys are resolved.
		if (value === '@metaSchema' || value.startsWith('°')) {
			return await resolveRef(value)
		}
		return value
	}
	if (Array.isArray(value)) {
		return Promise.all(value.map((v) => canonicalizePayloadRefs(v, { resolveRef })))
	}
	if (typeof value === 'object' && value.constructor === Object) {
		const out = {}
		for (const [k, v] of Object.entries(value)) {
			out[k] = await canonicalizePayloadRefs(v, { resolveRef })
		}
		return out
	}
	return value
}
