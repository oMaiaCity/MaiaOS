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
		// `maia/factory/...` without the leading ° (some artifacts / hand edits) must still be canonicalized
		if (
			value === '@metaSchema' ||
			value.startsWith('°') ||
			(value.startsWith('maia/factory/') && value.includes('.factory.json'))
		) {
			const s =
				value.startsWith('maia/factory/') && value.includes('.factory.json') ? `\u00B0${value}` : value
			return await resolveRef(s)
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

/**
 * Synchronous `canonicalizePayloadRefs` with a sync `resolveRef` (e.g. seed with in-memory `factoryCoIdMap`).
 * @param {unknown} value
 * @param {{ resolveRef: (s: string) => string }} param1
 * @returns {unknown}
 */
export function canonicalizePayloadRefsSync(value, { resolveRef }) {
	if (value === null || value === undefined) return value
	if (typeof value === 'string') {
		if (value.startsWith('co_z') && /^co_z[a-zA-Z0-9]+$/.test(value)) return value
		if (
			value === '@metaSchema' ||
			value.startsWith('°') ||
			(value.startsWith('maia/factory/') && value.includes('.factory.json'))
		) {
			const s =
				value.startsWith('maia/factory/') && value.includes('.factory.json') ? `\u00B0${value}` : value
			return resolveRef(s)
		}
		return value
	}
	if (Array.isArray(value)) {
		return value.map((v) => canonicalizePayloadRefsSync(v, { resolveRef }))
	}
	if (typeof value === 'object' && value.constructor === Object) {
		const out = {}
		for (const [k, v] of Object.entries(value)) {
			out[k] = canonicalizePayloadRefsSync(v, { resolveRef })
		}
		return out
	}
	return value
}
