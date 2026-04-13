/**
 * Seeding helpers - pure utilities and ensureSparkOs
 */

import {
	identityFromMaiaPath,
	withCanonicalFactorySchema,
} from '@MaiaOS/factories/identity-from-maia-path.js'
import { metaFactorySchemaRaw } from '@MaiaOS/factories/meta-factory-schema'

/** @type {object | null} */
let mergedMetaSchemaCache = null
function mergedMetaSchemaForSeeding() {
	if (!mergedMetaSchemaCache) {
		mergedMetaSchemaCache = withCanonicalFactorySchema(metaFactorySchemaRaw, 'meta.factory.maia')
	}
	return mergedMetaSchemaCache
}

/**
 * Find all °maia/factory/ references in an object (recursive).
 * @param {Object} obj - Schema or instance object
 * @param {Set} [visited] - Visited objects (cycle detection)
 * @returns {Set<string>} Set of factory ref strings
 */
function findCoReferences(obj, visited = new Set()) {
	if (!obj || typeof obj !== 'object' || visited.has(obj)) return new Set()
	visited.add(obj)
	const refs = new Set()
	if (obj.$co && typeof obj.$co === 'string' && obj.$co.startsWith('°maia/factory/'))
		refs.add(obj.$co)
	for (const v of Object.values(obj)) {
		if (v && typeof v === 'object') {
			for (const item of Array.isArray(v) ? v : [v]) {
				if (item && typeof item === 'object') {
					for (const r of findCoReferences(item, visited)) refs.add(r)
				}
			}
		}
	}
	return refs
}

/**
 * Topologically sort schema keys by dependency ($co references).
 * @param {Map<string, { name, schema }>} uniqueSchemasBy$id - Map of factory key -> { name, schema }
 * @param {string[]} [excludeKeys] - Keys to exclude from sort (e.g. ['°maia/factory/meta.factory.maia'])
 * @returns {string[]} Sorted array of factory keys
 */
export function sortSchemasByDependency(
	uniqueSchemasByLabel,
	excludeKeys = ['°maia/factory/meta.factory.maia'],
) {
	const deps = new Map()
	for (const [key, { schema }] of uniqueSchemasByLabel) {
		deps.set(key, findCoReferences(schema))
	}
	const sorted = []
	const done = new Set()
	const doing = new Set()
	const visit = (key) => {
		if (done.has(key) || excludeKeys.includes(key)) return
		if (doing.has(key)) return
		doing.add(key)
		for (const d of deps.get(key) || []) {
			if (d.startsWith('°maia/factory/') && uniqueSchemasByLabel.has(d)) visit(d)
		}
		doing.delete(key)
		done.add(key)
		sorted.push(key)
	}
	for (const key of uniqueSchemasByLabel.keys()) {
		visit(key)
	}
	return sorted
}

import * as groups from '@MaiaOS/db'
import { createCoValueForSpark } from '@MaiaOS/db'
import { ensureIndexesCoMap } from '@MaiaOS/db/cojson/indexing/factory-index-manager'

const MAIA_SPARK = '°maia'

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
	const { lookupRegistryKey } = await import('@MaiaOS/db')

	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (!osId) {
		throw new Error('[Seed] °maia spark.os not found. Ensure bootstrap has run.')
	}

	const vibesRegistrySchemaCoId =
		factoryCoIdMap?.get(identityFromMaiaPath('vibes-registry.factory.maia').$nanoid) ??
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
