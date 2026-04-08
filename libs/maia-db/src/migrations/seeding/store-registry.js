/**
 * Store instance config refs on spark.os.instances (instance path → co_z).
 */

import { INSTANCE_REF_PATTERN } from '@MaiaOS/factories'
import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'
import * as groups from '../../cojson/groups/groups.js'
import { SPARK_OS_INSTANCES_KEY } from '../../cojson/spark-os-keys.js'

const MAIA_SPARK = '°maia'

/**
 * @param {import('../../factories/registry.js').EXCEPTION_FACTORIES} EXCEPTION_FACTORIES
 */
export async function storeRegistry(
	account,
	node,
	maiaGroup,
	peer,
	_coIdRegistry,
	_factoryCoIdMap,
	instanceCoIdMap,
	_configs,
	_seededSchemas,
) {
	const { EXCEPTION_FACTORIES } = await import('../../factories/registry.js')

	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (!osId) return

	let osCore = node.getCoValue(osId)
	if (!osCore && node.loadCoValueCore) {
		await node.loadCoValueCore(osId)
		osCore = node.getCoValue(osId)
	}

	if (!osCore?.isAvailable()) return

	const osContent = osCore.getCurrentContent?.()
	if (!osContent || typeof osContent.get !== 'function') return

	const instancesId = osContent.get(SPARK_OS_INSTANCES_KEY)
	let instances

	if (instancesId) {
		const instancesCore = node.getCoValue(instancesId)
		if (instancesCore?.isAvailable()) {
			const instancesContent = instancesCore.getCurrentContent?.()
			if (instancesContent && typeof instancesContent.set === 'function') {
				instances = instancesContent
			}
		}
	}

	if (!instances) {
		const ctx = { node, account, guardian: maiaGroup }
		const { coValue: instancesCore } = await createCoValueForSpark(ctx, null, {
			factory: EXCEPTION_FACTORIES.META_SCHEMA,
			cotype: 'comap',
			data: {},
			dataEngine: peer?.dbEngine,
		})
		const instContent = instancesCore?.getCurrentContent?.()
		if (!instContent || typeof instContent.set !== 'function') return
		instances = instContent
		osContent.set(SPARK_OS_INSTANCES_KEY, instancesCore.id)

		if (node.storage && node.syncManager) {
			try {
				await node.syncManager.waitForStorageSync(instancesCore.id)
				await node.syncManager.waitForStorageSync(osId)
			} catch (_e) {}
		}
	}

	const entries =
		instanceCoIdMap instanceof Map ? instanceCoIdMap.entries() : Object.entries(instanceCoIdMap ?? {})
	for (const [key, coId] of entries) {
		if (typeof key !== 'string' || typeof coId !== 'string' || !coId.startsWith('co_z')) continue
		if (INSTANCE_REF_PATTERN.test(key)) {
			const existing = instances.get(key)
			if (!existing) instances.set(key, coId)
		}
	}
}
