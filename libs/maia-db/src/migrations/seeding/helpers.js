/**
 * Seeding helpers - pure utilities and ensureSparkOs
 */

import mergedMetaSchema from '@MaiaOS/factories/os/meta.factory.json'

/**
 * Find all °Maia/factory/ references in an object (recursive).
 * @param {Object} obj - Schema or instance object
 * @param {Set} [visited] - Visited objects (cycle detection)
 * @returns {Set<string>} Set of factory ref strings
 */
function findCoReferences(obj, visited = new Set()) {
	if (!obj || typeof obj !== 'object' || visited.has(obj)) return new Set()
	visited.add(obj)
	const refs = new Set()
	if (obj.$co && typeof obj.$co === 'string' && obj.$co.startsWith('°Maia/factory/'))
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
 * @param {string[]} [excludeKeys] - Keys to exclude from sort (e.g. ['°Maia/factory/meta'])
 * @returns {string[]} Sorted array of factory keys
 */
export function sortSchemasByDependency(uniqueSchemasBy$id, excludeKeys = ['°Maia/factory/meta']) {
	const deps = new Map()
	for (const [key, { schema }] of uniqueSchemasBy$id) {
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
			if (d.startsWith('°Maia/factory/') && uniqueSchemasBy$id.has(d)) visit(d)
		}
		doing.delete(key)
		done.add(key)
		sorted.push(key)
	}
	for (const key of uniqueSchemasBy$id.keys()) {
		visit(key)
	}
	return sorted
}

import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'
import * as groups from '../../cojson/groups/groups.js'
import { ensureIndexesCoMap } from '../../cojson/indexing/factory-index-manager.js'

const MAIA_SPARK = '°Maia'

/**
 * Recursively remove 'id' fields from schema objects (AJV only accepts $id, not id)
 * Preserve 'id' in properties/items (valid property names).
 */
export function removeIdFields(obj, inPropertiesOrItems = false) {
	if (obj === null || obj === undefined) return obj
	if (typeof obj !== 'object') return obj
	if (Array.isArray(obj)) return obj.map((item) => removeIdFields(item, inPropertiesOrItems))
	const cleaned = {}
	for (const [key, value] of Object.entries(obj)) {
		if (key === 'id' && !inPropertiesOrItems) continue
		const isPropertiesOrItems = key === 'properties' || key === 'items'
		cleaned[key] =
			value !== null && value !== undefined && typeof value === 'object'
				? removeIdFields(value, isPropertiesOrItems || inPropertiesOrItems)
				: value
	}
	return cleaned
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
		...mergedMetaSchema,
		$id: metaSchemaId,
		$factory: metaSchemaId,
	}
	return { definition: fullMetaSchema }
}

/**
 * Ensure spark.os CoMap exists (creates if needed)
 * Also ensures spark.os.factories, spark.os.indexes, spark.os.vibes
 */
export async function ensureSparkOs(account, node, maiaGroup, peer, factoryCoIdMap) {
	const { EXCEPTION_FACTORIES } = await import('../../factories/registry.js')
	const { resolve } = await import('../../cojson/factory/resolver.js')

	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (!osId) {
		throw new Error('[Seed] °Maia spark.os not found. Ensure bootstrap has run.')
	}

	const factoriesRegistrySchemaCoId =
		factoryCoIdMap?.get('°Maia/factory/os/factories-registry') ??
		(await resolve(peer, '°Maia/factory/os/factories-registry', { returnType: 'coId' }))
	const vibesRegistrySchemaCoId =
		factoryCoIdMap?.get('°Maia/factory/os/vibes-registry') ??
		(await resolve(peer, '°Maia/factory/os/vibes-registry', { returnType: 'coId' }))

	let osCore = node.getCoValue(osId)
	if (!osCore && node.loadCoValueCore) {
		await node.loadCoValueCore(osId)
		osCore = node.getCoValue(osId)
	}

	if (!osCore || !osCore.isAvailable()) {
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
			const factoriesId = osContent.get('factories')
			if (!factoriesId) {
				const ctx = { node, account, guardian: maiaGroup }
				const { coValue: factories } = await createCoValueForSpark(ctx, null, {
					factory: factoriesRegistrySchemaCoId || EXCEPTION_FACTORIES.META_SCHEMA,
					cotype: 'comap',
					data: {},
					dataEngine: peer?.dbEngine,
				})
				osContent.set('factories', factories.id)
				if (node.storage?.syncManager) {
					try {
						await node.syncManager.waitForStorageSync(factories.id)
						await node.syncManager.waitForStorageSync(osId)
					} catch (_e) {}
				}
			}
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
