/**
 * Diff .maia registry configs against live CoValues and apply CRDT updates (nanoid → co_z via spark.os.indexes["@nanoids"]).
 */

import { ensureCoValueLoaded, normalizeCoValueData } from '@MaiaOS/db'
import { update } from '@MaiaOS/db/cojson/crud/update.js'
import {
	ensureNanoidIndexCoMap,
	loadNanoidIndex,
} from '@MaiaOS/db/cojson/indexing/factory-index-manager.js'
import { transformInstanceForSeeding } from '../ref-transform.js'

/**
 * @param {import('@MaiaOS/db').MaiaDB} peer
 * @param {Map<string, string>} registryMap
 */
function mergeSystemFactoriesIntoRegistryMap(peer, registryMap) {
	if (peer?.systemFactoryCoIds?.forEach) {
		peer.systemFactoryCoIds.forEach((coId, nanoid) => {
			if (typeof coId === 'string' && coId.startsWith('co_z')) {
				registryMap.set(nanoid, coId)
			}
		})
	}
}

/**
 * @param {import('@cojson/cojson').RawCoMap} nanoidContent
 * @param {import('@MaiaOS/db').MaiaDB} peer
 * @returns {Map<string, string>}
 */
export function buildRegistryMapFromNanoidIndex(nanoidContent, peer) {
	const map = new Map()
	if (nanoidContent?.keys && typeof nanoidContent.keys === 'function') {
		for (const k of nanoidContent.keys()) {
			const v = nanoidContent.get(k)
			if (typeof v === 'string' && v.startsWith('co_z')) {
				map.set(k, v)
			}
		}
	}
	mergeSystemFactoriesIntoRegistryMap(peer, map)
	return map
}

function stableJson(v) {
	try {
		return JSON.stringify(v, (_key, val) => {
			if (val && typeof val === 'object' && !Array.isArray(val)) {
				return Object.keys(val)
					.sort()
					.reduce((acc, k) => {
						acc[k] = val[k]
						return acc
					}, {})
			}
			return val
		})
	} catch {
		return String(v)
	}
}

/**
 * Check if a value (or anything nested inside it) contains an unresolved ° ref.
 * $label is excluded (it's a logical id, not a resolvable ref).
 */
function hasUnresolvedDegreeRef(val, key = '') {
	if (key === '$label') return false
	if (typeof val === 'string') return val.startsWith('°') && !val.startsWith('co_z')
	if (Array.isArray(val)) return val.some((item) => hasUnresolvedDegreeRef(item))
	if (val && typeof val === 'object') {
		return Object.entries(val).some(([k, v]) => hasUnresolvedDegreeRef(v, k))
	}
	return false
}

/**
 * Remove top-level keys from `desired` that contain unresolved ° refs anywhere
 * in their value tree. This prevents migrate from writing degraded data (e.g.
 * tabs array with actor refs stripped) over live data that has resolved co-ids.
 * Returns the set of removed keys for logging.
 */
export function stripKeysWithUnresolvedRefs(obj) {
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return new Set()
	const removed = new Set()
	for (const k of Object.keys(obj)) {
		if (k === '$label') continue
		if (hasUnresolvedDegreeRef(obj[k], k)) {
			delete obj[k]
			removed.add(k)
		}
	}
	return removed
}

/**
 * @param {import('@MaiaOS/db').MaiaDB} peer
 * @param {string} coId
 * @param {Record<string, unknown>} desired
 * @returns {Promise<number>} number of keys applied
 */
async function applyCoMapPatch(peer, coId, desired) {
	const core = await ensureCoValueLoaded(peer, coId, { waitForAvailable: true })
	if (!core || !peer.isAvailable(core)) return 0
	const content = peer.getCurrentContent(core)
	const rawType = content?.type || content?.cotype
	if (rawType !== 'comap' || !content?.get || !content?.set) return 0

	const patch = {}
	for (const [key, value] of Object.entries(desired)) {
		let cur
		try {
			cur = content.get(key)
		} catch {
			cur = undefined
		}
		if (
			typeof cur === 'string' &&
			cur.startsWith('co_z') &&
			typeof value === 'string' &&
			!value.startsWith('co_z')
		) {
			continue
		}
		const curN = normalizeCoValueData(cur)
		const valN = normalizeCoValueData(value)
		if (stableJson(curN) !== stableJson(valN)) {
			patch[key] = value
		}
	}
	if (Object.keys(patch).length === 0) return 0
	await update(peer, null, coId, patch)
	return Object.keys(patch).length
}

/**
 * @param {object} registryConfig
 * @param {Map<string, string>} registryMap
 * @returns {object}
 */
function desiredDataFromRegistry(registryConfig, registryMap) {
	const raw = JSON.parse(JSON.stringify(registryConfig))
	const transformed = transformInstanceForSeeding(raw, registryMap, { throwOnMissing: false })
	const {
		$id: _i,
		$schema: _s,
		$factory: _f,
		$nanoid: _n,
		$label: _l,
		'@actors': _a,
		...rest
	} = transformed
	stripKeysWithUnresolvedRefs(rest)
	return rest
}

/**
 * @param {import('@MaiaOS/db').MaiaDB} peer
 * @param {unknown} _dataEngine
 * @param {{ onlyNanoids?: string[] | null, registry?: Record<string, object> | null }} [options]
 * @returns {Promise<{ updated: number, skipped: number, errors: string[] }>}
 */
export async function migrate(peer, _dataEngine, options = {}) {
	const { onlyNanoids = null, registry: registryOverride = null } = options

	let nanoidContent = await loadNanoidIndex(peer)
	if (!nanoidContent) {
		await ensureNanoidIndexCoMap(peer)
		nanoidContent = await loadNanoidIndex(peer)
	}
	if (!nanoidContent) {
		return {
			updated: 0,
			skipped: 0,
			errors: ['[migrate] spark.os.indexes["@nanoids"] not available (bootstrap spark.os first)'],
		}
	}

	const registryMap = buildRegistryMapFromNanoidIndex(nanoidContent, peer)

	const universe = registryOverride
		? { MAIA_SPARK_REGISTRY: registryOverride }
		: await import('@MaiaOS/universe')
	const { MAIA_SPARK_REGISTRY } = universe

	let updated = 0
	let skipped = 0
	const errors = []

	const entries = Object.entries(MAIA_SPARK_REGISTRY)
	for (const [nanoid, registryConfig] of entries) {
		if (onlyNanoids && onlyNanoids.length > 0 && !onlyNanoids.includes(nanoid)) {
			skipped++
			continue
		}
		if (!registryConfig || typeof registryConfig !== 'object') {
			skipped++
			continue
		}

		const coId = registryMap.get(nanoid)
		if (!coId) {
			skipped++
			continue
		}

		try {
			const core = await ensureCoValueLoaded(peer, coId, { waitForAvailable: true })
			if (!core || !peer.isAvailable(core)) {
				skipped++
				continue
			}
			const content = peer.getCurrentContent(core)
			const rawType = content?.type || content?.cotype
			if (rawType === 'colist') {
				skipped++
				continue
			}
			if (rawType !== 'comap') {
				skipped++
				continue
			}

			const desired = desiredDataFromRegistry(registryConfig, registryMap)
			const n = await applyCoMapPatch(peer, coId, desired)
			if (n > 0) updated++
			else skipped++
		} catch (e) {
			errors.push(`[migrate] ${nanoid} (${coId}): ${e?.message ?? e}`)
			skipped++
		}
	}

	return { updated, skipped, errors }
}
