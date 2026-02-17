/**
 * Store registry - populate spark.os.schematas
 */

import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'
import * as groups from '../../cojson/groups/groups.js'

const MAIA_SPARK = '°Maia'

/**
 * Store registry in spark.os.schematas CoMap
 */
export async function storeRegistry(
	account,
	node,
	maiaGroup,
	peer,
	coIdRegistry,
	schemaCoIdMap,
	_instanceCoIdMap,
	_configs,
	_seededSchemas,
) {
	const { EXCEPTION_SCHEMAS } = await import('../../schemas/registry.js')

	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (!osId) return

	let osCore = node.getCoValue(osId)
	if (!osCore && node.loadCoValueCore) {
		await node.loadCoValueCore(osId)
		osCore = node.getCoValue(osId)
	}

	if (!osCore || !osCore.isAvailable()) return

	const osContent = osCore.getCurrentContent?.()
	if (!osContent || typeof osContent.get !== 'function') return

	const schematasId = osContent.get('schematas')
	let schematas

	if (schematasId) {
		const schematasCore = node.getCoValue(schematasId)
		if (schematasCore?.isAvailable()) {
			const schematasContent = schematasCore.getCurrentContent?.()
			if (schematasContent && typeof schematasContent.set === 'function') {
				schematas = schematasContent
			}
		}
	}

	if (!schematas) {
		let schematasSchemaCoId = null
		if (schemaCoIdMap?.has('°Maia/schema/os/schematas-registry')) {
			schematasSchemaCoId = schemaCoIdMap.get('°Maia/schema/os/schematas-registry')
		}
		const schemaForSchematas = schematasSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA
		const ctx = { node, account, guardian: maiaGroup }
		const { coValue: schematasCreated } = await createCoValueForSpark(ctx, null, {
			schema: schemaForSchematas,
			cotype: 'comap',
			data: {},
			dataEngine: peer?.dbEngine,
		})
		schematas = schematasCreated
		osContent.set('schematas', schematas.id)

		if (node.storage && node.syncManager) {
			try {
				await node.syncManager.waitForStorageSync(schematas.id)
				await node.syncManager.waitForStorageSync(osId)
			} catch (_e) {}
		}
	}

	const metaschemaCoId = coIdRegistry.get('°Maia/schema/meta')
	if (metaschemaCoId) {
		const existingCoId = schematas.get('°Maia/schema/meta')
		if (!existingCoId) {
			schematas.set('°Maia/schema/meta', metaschemaCoId)
		}
	}
}
