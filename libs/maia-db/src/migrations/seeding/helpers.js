/**
 * Seeding helpers - pure utilities and ensureSparkOs
 */

import mergedMetaSchema from '@MaiaOS/schemata/os/meta.schema.json'
import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'
import { waitForStoreReady } from '../../cojson/crud/read-operations.js'
import * as groups from '../../cojson/groups/groups.js'
import { ensureIndexesCoMap } from '../../cojson/indexing/schema-index-manager.js'

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
export function buildMetaSchemaForSeeding(metaSchemaCoId) {
	const metaSchemaId = metaSchemaCoId
		? `https://maia.city/${metaSchemaCoId}`
		: 'https://json-schema.org/draft/2020-12/schema'
	const fullMetaSchema = {
		...mergedMetaSchema,
		$id: metaSchemaId,
		$schema: metaSchemaId,
	}
	return { definition: fullMetaSchema }
}

/**
 * Ensure spark.os CoMap exists (creates if needed)
 * Also ensures spark.os.schematas, spark.os.indexes, spark.agents
 */
export async function ensureSparkOs(account, node, maiaGroup, peer, schemaCoIdMap) {
	const { EXCEPTION_SCHEMAS } = await import('../../schemas/registry.js')
	const { resolve } = await import('../../cojson/schema/resolver.js')

	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (!osId) {
		throw new Error('[Seed] °Maia spark.os not found. Ensure bootstrap has run.')
	}

	const schematasSchemaCoId =
		schemaCoIdMap?.get('°Maia/schema/os/schematas-registry') ??
		(await resolve(peer, '°Maia/schema/os/schematas-registry', { returnType: 'coId' }))
	const agentsSchemaCoId =
		schemaCoIdMap?.get('°Maia/schema/os/agents-registry') ??
		(await resolve(peer, '°Maia/schema/os/agents-registry', { returnType: 'coId' }))

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
			const schematasId = osContent.get('schematas')
			if (!schematasId) {
				const ctx = { node, account, guardian: maiaGroup }
				const { coValue: schematas } = await createCoValueForSpark(ctx, null, {
					schema: schematasSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA,
					cotype: 'comap',
					data: {},
					dataEngine: peer?.dbEngine,
				})
				osContent.set('schematas', schematas.id)
				if (node.storage?.syncManager) {
					try {
						await node.syncManager.waitForStorageSync(schematas.id)
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

	const agentsId = await groups.getSparkAgentsId(peer, MAIA_SPARK)
	if (!agentsId && schemaCoIdMap) {
		const sparksId = await groups.getSparksRegistryId(peer)
		if (sparksId?.startsWith('co_z')) {
			const sparksStore = await peer.read(null, sparksId)
			await waitForStoreReady(sparksStore, sparksId, 10000)
			const sparksData = sparksStore?.value ?? {}
			const maiaSparkCoId = sparksData?.[MAIA_SPARK] ?? sparksData?.['°Maia']
			if (maiaSparkCoId?.startsWith('co_z')) {
				const sparkCore = peer.getCoValue(maiaSparkCoId)
				if (sparkCore && peer.isAvailable(sparkCore)) {
					const sparkContent = peer.getCurrentContent(sparkCore)
					if (sparkContent && typeof sparkContent.set === 'function') {
						const ctx = { node, account, guardian: maiaGroup }
						const { coValue: agents } = await createCoValueForSpark(ctx, null, {
							schema: agentsSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA,
							cotype: 'comap',
							data: {},
							dataEngine: peer?.dbEngine,
						})
						sparkContent.set('agents', agents.id)
					}
				}
			}
		}
	}
}
