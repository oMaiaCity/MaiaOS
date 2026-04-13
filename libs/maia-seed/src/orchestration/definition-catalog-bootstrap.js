/**
 * Bootstrap-only: create spark.os.indexes[metaSchemaCoId] definition catalog colist and seed with factory defs.
 */

import { createCoValueForSpark } from '@MaiaOS/db'
import { removeIdFields } from '@MaiaOS/factories/remove-id-fields'

/**
 * @param {{ node: import('@cojson/cojson').LocalNode, account: unknown, guardian: unknown }} ctx
 * @param {import('@cojson/cojson').CoValueCore} indexesCoValue
 * @param {string} metaSchemaCoId
 * @param {Map<string, string>} factoryCoIdMap
 * @param {import('@MaiaOS/engines').DataEngine | null} dbEngine
 */
export async function seedDefinitionCatalogBootstrap(
	ctx,
	indexesCoValue,
	metaSchemaCoId,
	factoryCoIdMap,
	dbEngine,
) {
	const catalogSchemaDef = {
		title: '°maia/factory/index/definitions-catalog',
		description: 'Colist of factory definition co_zs',
		cotype: 'colist',
		indexing: false,
		items: { $co: '°maia/factory/meta.factory.maia' },
	}
	const { coValue: catalogSchemaFactory } = await createCoValueForSpark(ctx, null, {
		factory: metaSchemaCoId,
		cotype: 'comap',
		data: removeIdFields(catalogSchemaDef),
		isFactoryDefinition: true,
		dataEngine: dbEngine,
	})
	const { coValue: catalogColist } = await createCoValueForSpark(ctx, null, {
		factory: catalogSchemaFactory.id,
		cotype: 'colist',
		data: [],
		dataEngine: dbEngine,
	})
	const indexesContent = indexesCoValue.getCurrentContent?.() ?? indexesCoValue
	if (indexesContent && typeof indexesContent.set === 'function') {
		indexesContent.set(metaSchemaCoId, catalogColist.id)
	}
	const { node } = ctx
	const colistCore = node.getCoValue(catalogColist.id)
	const colistContent = colistCore?.getCurrentContent?.()
	if (!colistContent || typeof colistContent.append !== 'function') return
	const seen = new Set()
	for (const coId of factoryCoIdMap.values()) {
		if (typeof coId !== 'string' || !coId.startsWith('co_z')) continue
		if (seen.has(coId)) continue
		seen.add(coId)
		try {
			const items = colistContent.toJSON?.() ?? []
			if (Array.isArray(items) && !items.includes(coId)) colistContent.append(coId)
		} catch (_e) {}
	}
}
