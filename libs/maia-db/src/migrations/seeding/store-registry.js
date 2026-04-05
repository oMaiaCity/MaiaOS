/**
 * Store registry - populate spark.os.factories with factory + instance config co-ids
 */

import { INSTANCE_REF_PATTERN } from '@MaiaOS/factories'
import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'
import * as groups from '../../cojson/groups/groups.js'
import { NANOID_KEY_PATTERN } from './nanoid-registry.js'

const MAIA_SPARK = '°maia'

/**
 * Store registry in spark.os.factories CoMap.
 * Factories registry holds: factory defs (°maia/factory/...) + instance config co-ids (°maia/.../*.maia, vibe ids, etc.)
 */
export async function storeRegistry(
	account,
	node,
	maiaGroup,
	peer,
	coIdRegistry,
	factoryCoIdMap,
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

	const factoriesId = osContent.get('factories')
	let factories

	if (factoriesId) {
		const factoriesCore = node.getCoValue(factoriesId)
		if (factoriesCore?.isAvailable()) {
			const factoriesContent = factoriesCore.getCurrentContent?.()
			if (factoriesContent && typeof factoriesContent.set === 'function') {
				factories = factoriesContent
			}
		}
	}

	if (!factories) {
		let factoriesRegistrySchemaCoId = null
		if (factoryCoIdMap?.has('°maia/factory/os/factories-registry')) {
			factoriesRegistrySchemaCoId = factoryCoIdMap.get('°maia/factory/os/factories-registry')
		}
		const schemaForFactories = factoriesRegistrySchemaCoId || EXCEPTION_FACTORIES.META_SCHEMA
		const ctx = { node, account, guardian: maiaGroup }
		const { coValue: factoriesCreated } = await createCoValueForSpark(ctx, null, {
			factory: schemaForFactories,
			cotype: 'comap',
			data: {},
			dataEngine: peer?.dbEngine,
		})
		factories = factoriesCreated
		osContent.set('factories', factories.id)

		if (node.storage && node.syncManager) {
			try {
				await node.syncManager.waitForStorageSync(factories.id)
				await node.syncManager.waitForStorageSync(osId)
			} catch (_e) {}
		}
	}

	const metafactoryCoId = coIdRegistry.get('°maia/factory/meta')
	if (metafactoryCoId) {
		const existingCoId = factories.get('°maia/factory/meta')
		if (!existingCoId) {
			factories.set('°maia/factory/meta', metafactoryCoId)
		}
	}

	// Instance config co-ids (actors, inboxes, views, contexts, states, styles) for resolve() to find
	const entries =
		instanceCoIdMap instanceof Map ? instanceCoIdMap.entries() : Object.entries(instanceCoIdMap ?? {})
	for (const [key, coId] of entries) {
		if (typeof key !== 'string' || typeof coId !== 'string' || !coId.startsWith('co_z')) continue
		if (NANOID_KEY_PATTERN.test(key)) {
			factories.set(key, coId)
			continue
		}
		if (INSTANCE_REF_PATTERN.test(key)) {
			const existing = factories.get(key)
			if (!existing) factories.set(key, coId)
		}
	}
}
