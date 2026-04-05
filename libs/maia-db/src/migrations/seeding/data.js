/**
 * Data seeding - todos, entities, etc.
 */

import { splitGraphemes } from 'unicode-segmenter/grapheme'
import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'

const DEFAULT_PAPER_TEXT = "Dear future us, what we're creating together..."

/**
 * Seed data entities to CoJSON
 */
export async function seedData(account, node, maiaGroup, peer, data, coIdRegistry) {
	const { transformForSeeding } = await import('@MaiaOS/factories/factory-transformer')

	if (!data || Object.keys(data).length === 0) {
		return { collections: [], totalItems: 0, coIds: [] }
	}

	const seededCollections = []
	let totalItems = 0
	const registry = coIdRegistry.registry ?? coIdRegistry
	const getAll = typeof coIdRegistry.getAll === 'function' ? coIdRegistry.getAll() : registry

	for (const [collectionName, collectionItems] of Object.entries(data)) {
		if (collectionName === 'dashboardIconCotexts') continue
		if (!Array.isArray(collectionItems)) continue

		const factoryKey1 = `data/${collectionName}`
		const factoryKey2 = `°maia/factory/data/${collectionName}`
		const factoryKey3 = `°maia/factory/${collectionName}`

		const factoryCoId =
			registry.get(factoryKey1) || registry.get(factoryKey2) || registry.get(factoryKey3)

		if (!factoryCoId) continue

		// Special handling for Notes: create CoText (colist) first, then Note (comap) with content ref
		if (collectionName === 'notes') {
			const cotextSchemaCoId = registry.get('°maia/factory/os/cotext') || registry.get('os/cotext')
			if (!cotextSchemaCoId) continue

			let itemCount = 0
			const coIds = []
			for (const item of collectionItems) {
				const initialText = typeof item.content === 'string' ? item.content : DEFAULT_PAPER_TEXT
				const graphemes = [...splitGraphemes(initialText)]

				const ctx = { node, account, guardian: maiaGroup }
				const { coValue: cotextCoList } = await createCoValueForSpark(ctx, null, {
					factory: cotextSchemaCoId,
					cotype: 'colist',
					data: graphemes,
					dataEngine: peer?.dbEngine,
				})

				const noteData = { content: cotextCoList.id }
				if (typeof item.title === 'string') noteData.title = item.title

				const { coValue: noteCoMap } = await createCoValueForSpark(ctx, null, {
					factory: factoryCoId,
					cotype: 'comap',
					data: noteData,
					dataEngine: peer?.dbEngine,
				})

				coIds.push(noteCoMap.id)
				coIds.push(cotextCoList.id)
				itemCount++
			}

			seededCollections.push({
				name: collectionName,
				factoryCoId,
				itemCount,
				coIds,
			})
			totalItems += itemCount
			continue
		}

		let itemCount = 0
		const coIds = []
		for (const item of collectionItems) {
			const transformedItem = transformForSeeding(item, getAll)
			const { $id, ...itemWithoutId } = transformedItem

			const ctx = { node, account, guardian: maiaGroup }
			const { coValue: itemCoMap } = await createCoValueForSpark(ctx, null, {
				factory: factoryCoId,
				cotype: 'comap',
				data: itemWithoutId,
				dataEngine: peer?.dbEngine,
			})
			coIds.push(itemCoMap.id)
			itemCount++
		}

		seededCollections.push({
			name: collectionName,
			factoryCoId,
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
