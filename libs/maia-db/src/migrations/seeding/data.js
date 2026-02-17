/**
 * Data seeding - todos, entities, etc.
 */

import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'

/**
 * Seed data entities to CoJSON
 */
export async function seedData(account, node, maiaGroup, peer, data, coIdRegistry) {
	const { transformForSeeding } = await import('@MaiaOS/schemata/schema-transformer')

	if (!data || Object.keys(data).length === 0) {
		return { collections: [], totalItems: 0, coIds: [] }
	}

	const seededCollections = []
	let totalItems = 0

	for (const [collectionName, collectionItems] of Object.entries(data)) {
		if (!Array.isArray(collectionItems)) continue

		const schemaKey1 = `data/${collectionName}`
		const schemaKey2 = `°Maia/schema/data/${collectionName}`
		const schemaKey3 = `°Maia/schema/${collectionName}`

		const schemaCoId =
			coIdRegistry.registry?.get(schemaKey1) ||
			coIdRegistry.registry?.get(schemaKey2) ||
			coIdRegistry.registry?.get(schemaKey3)

		if (!schemaCoId) continue

		let itemCount = 0
		const coIds = []
		for (const item of collectionItems) {
			const transformedItem = transformForSeeding(item, coIdRegistry.getAll())
			const { $id, ...itemWithoutId } = transformedItem

			const ctx = { node, account, guardian: maiaGroup }
			const { coValue: itemCoMap } = await createCoValueForSpark(ctx, null, {
				schema: schemaCoId,
				cotype: 'comap',
				data: itemWithoutId,
				dataEngine: peer?.dbEngine,
			})
			coIds.push(itemCoMap.id)
			itemCount++
		}

		seededCollections.push({
			name: collectionName,
			schemaCoId,
			itemCount,
			coIds,
		})
		totalItems += itemCount
	}

	const allDataCoIds = seededCollections.flatMap((c) => c.coIds || [])
	return {
		collections: seededCollections,
		totalItems,
		coIds: allDataCoIds,
	}
}
