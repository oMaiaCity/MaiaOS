/**
 * Seeding helpers - pure utilities and ensureSparkOs
 */

import { metaFactorySchemaRaw } from '@MaiaOS/universe'
import {
	maiaFactoryRefToNanoid,
	maiaIdentity,
	withCanonicalFactorySchema,
} from '@MaiaOS/validation/identity-from-maia-path.js'

/** @type {object | null} */
let mergedMetaSchemaCache = null
function mergedMetaSchemaForSeeding() {
	if (!mergedMetaSchemaCache) {
		mergedMetaSchemaCache = withCanonicalFactorySchema(metaFactorySchemaRaw, 'meta.factory.maia')
	}
	return mergedMetaSchemaCache
}

/**
 * Find all `°maia/factory/*.factory.maia` string refs in a schema (any depth; strings + $co).
 * @param {unknown} obj - Schema or instance object
 * @param {Set} [visited] - Visited objects (cycle detection)
 * @returns {Set<string>} Set of factory ref strings
 */
function findCoReferences(obj, visited = new Set()) {
	if (typeof obj === 'string' && obj.startsWith('°maia/factory/') && obj.includes('.factory.maia')) {
		return new Set([obj])
	}
	if (!obj || typeof obj !== 'object') return new Set()
	if (visited.has(obj)) return new Set()
	if (Array.isArray(obj)) {
		const refs = new Set()
		for (const el of obj) {
			for (const r of findCoReferences(el, visited)) refs.add(r)
		}
		return refs
	}
	visited.add(obj)
	const refs = new Set()
	for (const v of Object.values(obj)) {
		for (const r of findCoReferences(v, visited)) refs.add(r)
	}
	return refs
}

/**
 * Resolve a factory ref string to a key present in `uniqueSchemasByLabel` (nanoid **or** ° label).
 * @param {string} d
 * @param {string} selfKey
 * @param {Map<string, unknown>} uniqueSchemasByLabel
 * @returns {string | null}
 */
function resolveFactoryRefToMapKey(d, selfKey, uniqueSchemasByLabel) {
	if (typeof d !== 'string' || !d.startsWith('°maia/factory/') || !d.includes('.factory.maia')) {
		return null
	}
	if (uniqueSchemasByLabel.has(d)) {
		return d === selfKey ? null : d
	}
	const depN = maiaFactoryRefToNanoid(d)
	if (!depN) {
		return null
	}
	if (depN === selfKey) {
		return null
	}
	return uniqueSchemasByLabel.has(depN) ? depN : null
}

/** @param {Set<string>} strSet */
function stringSetToPrereqMapKeys(strSet, selfKey, uniqueSchemasByLabel) {
	/** @type {Set<string>} */
	const out = new Set()
	for (const d of strSet) {
		const k = resolveFactoryRefToMapKey(d, selfKey, uniqueSchemasByLabel)
		if (k) {
			out.add(k)
		}
	}
	return out
}

/**
 * Topologically sort schema keys by `°maia/factory/*.factory.maia` cross-refs in each schema
 * (Kahn). Ensures a factory is created before any row that $co-refs it (e.g. event before
 * actor was a bug with the old DFS+push order when `Map` iteration + multiple roots mixed).
 * @param {Map<string, { name, schema }>} uniqueFactoriesByLabel
 * @param {string[]} [excludeKeys] - Keys to omit from the result (by nanoid, or by label if present in the map for bootstrap)
 * @returns {string[]} Factory keys in safe creation order
 */
export function sortFactoriesByDependency(
	uniqueFactoriesByLabel,
	excludeKeys = ['°maia/factory/meta.factory.maia'],
) {
	/** @type {Set<string>} */
	const exclude = new Set()
	for (const ex of excludeKeys) {
		exclude.add(ex)
		if (ex.startsWith('°maia/factory/')) {
			const n = maiaFactoryRefToNanoid(ex)
			if (n) {
				exclude.add(n)
			}
		}
	}
	const allKeys = [...uniqueFactoriesByLabel.keys()].filter((k) => !exclude.has(k))
	const keySet = new Set(allKeys)

	/** depNanoid is ready → these children can drop one in-degree */
	const unblocks = new Map()
	const inDegree = new Map()
	for (const k of allKeys) {
		inDegree.set(k, 0)
	}
	for (const child of allKeys) {
		const { schema } = uniqueFactoriesByLabel.get(child)
		const prereq = stringSetToPrereqMapKeys(findCoReferences(schema), child, uniqueFactoriesByLabel)
		for (const depKey of prereq) {
			if (!keySet.has(depKey)) {
				continue
			}
			inDegree.set(child, (inDegree.get(child) || 0) + 1)
			if (!unblocks.has(depKey)) {
				unblocks.set(depKey, [])
			}
			unblocks.get(depKey).push(child)
		}
	}
	/** @type {string[]} */
	const result = []
	const q = allKeys.filter((k) => inDegree.get(k) === 0)
	let qi = 0
	while (qi < q.length) {
		const k = q[qi]
		qi++
		result.push(k)
		for (const child of unblocks.get(k) || []) {
			const next = (inDegree.get(child) || 0) - 1
			inDegree.set(child, next)
			if (next === 0) {
				q.push(child)
			}
		}
	}
	if (result.length < allKeys.length) {
		const seen = new Set(result)
		for (const k of allKeys) {
			if (!seen.has(k)) {
				result.push(k)
			}
		}
	}
	return result
}

import * as groups from '@MaiaOS/db'
import { createCoValueForSpark, ensureCoValueLoaded, INFRA_SLOTS } from '@MaiaOS/db'
import { ensureIndexesCoMap } from '@MaiaOS/db/cojson/indexing/factory-index-manager'
import { lookupRegistryKey } from '@MaiaOS/db/seed/lookup-registry-key'

const MAIA_SPARK = '°maia'

/**
 * Write infra factory co-id slots on `spark.os` (single manifest).
 * @param {object} peer
 * @param {string} osId
 * @param {Map<string, string>} factoryCoIdMap
 * @param {string} metaSchemaCoId
 */
export async function writeInfraSlotsToSparkOs(peer, osId, factoryCoIdMap, metaSchemaCoId) {
	if (!osId?.startsWith('co_z') || !factoryCoIdMap) return
	const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
	if (!osCore || !peer.getCurrentContent) return
	const os = peer.getCurrentContent(osCore)
	if (!os || typeof os.set !== 'function') return
	for (const { slotKey, basename } of INFRA_SLOTS) {
		const n = maiaIdentity(basename).$nanoid
		let coId = factoryCoIdMap.get(n)
		if (slotKey === 'metaFactoryCoId' && metaSchemaCoId?.startsWith('co_z')) {
			coId = metaSchemaCoId
		}
		if (coId?.startsWith('co_z')) {
			os.set(slotKey, coId)
		}
	}
}

/**
 * Build metaschema definition for seeding
 * @param {string} metaSchemaCoId - The co-id of the meta schema CoMap (for self-reference)
 * @returns {Object} Schema CoMap structure with definition property
 */
export function buildMetaFactoryForSeeding(metaSchemaCoId) {
	const metaSchemaId = metaSchemaCoId
		? `https://maia.city/${metaSchemaCoId}`
		: 'https://json-schema.org/draft/2020-12/schema'
	const fullMetaSchema = {
		...mergedMetaSchemaForSeeding(),
		$id: metaSchemaId,
		$factory: metaSchemaId,
	}
	return { definition: fullMetaSchema }
}

/**
 * Ensure spark.os CoMap exists (creates if needed)
 * Also ensures spark.os.indexes, spark.os.vibes
 */
export async function ensureSparkOs(account, node, maiaGroup, peer, factoryCoIdMap) {
	const { EXCEPTION_FACTORIES } = await import('@MaiaOS/db/registry')

	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (!osId) {
		throw new Error('[Seed] °maia spark.os not found. Ensure bootstrap has run.')
	}

	const vibesRegistrySchemaCoId =
		factoryCoIdMap?.get(maiaIdentity('vibes-registry.factory.maia').$nanoid) ??
		(await lookupRegistryKey(peer, '°maia/factory/vibes-registry.factory.maia', {
			returnType: 'coId',
		}))

	let osCore = node.getCoValue(osId)
	if (!osCore && node.loadCoValueCore) {
		await node.loadCoValueCore(osId)
		osCore = node.getCoValue(osId)
	}

	if (!osCore?.isAvailable()) {
		await new Promise((r) => {
			let unsub
			const t = setTimeout(r, 5000)
			if (osCore) {
				unsub = osCore.subscribe((c) => {
					if (c?.isAvailable?.()) {
						clearTimeout(t)
						unsub?.()
						r()
					}
				})
			} else r()
		})
		osCore = node.getCoValue(osId)
	}

	if (osCore?.isAvailable()) {
		const osContent = osCore.getCurrentContent?.()
		if (osContent && typeof osContent.get === 'function') {
			const indexesId = osContent.get('indexes')
			if (!indexesId && peer) {
				await ensureIndexesCoMap(peer)
			}
		}
	}

	const vibesId = await groups.getSparkVibesId(peer, MAIA_SPARK)
	if (!vibesId && factoryCoIdMap && osCore?.isAvailable()) {
		const osContent = osCore.getCurrentContent?.()
		if (osContent && typeof osContent.set === 'function') {
			const ctx = { node, account, guardian: maiaGroup }
			const { coValue: vibes } = await createCoValueForSpark(ctx, null, {
				factory: vibesRegistrySchemaCoId || EXCEPTION_FACTORIES.META_SCHEMA,
				cotype: 'comap',
				data: {},
				dataEngine: peer?.dbEngine,
			})
			osContent.set('vibes', vibes.id)
			if (node.storage?.syncManager) {
				try {
					await node.syncManager.waitForStorageSync(vibes.id)
					await node.syncManager.waitForStorageSync(osId)
				} catch (_e) {}
			}
		}
	}
}
