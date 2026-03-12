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
	const { transformForSeeding } = await import('@MaiaOS/schemata/schema-transformer')

	if (!data || Object.keys(data).length === 0) {
		return { collections: [], totalItems: 0, coIds: [] }
	}

	const seededCollections = []
	let totalItems = 0
	const registry = coIdRegistry.registry ?? coIdRegistry
	const getAll = typeof coIdRegistry.getAll === 'function' ? coIdRegistry.getAll() : registry

	for (const [collectionName, collectionItems] of Object.entries(data)) {
		if (!Array.isArray(collectionItems)) continue

		const schemaKey1 = `data/${collectionName}`
		const schemaKey2 = `°Maia/schema/data/${collectionName}`
		const schemaKey3 = `°Maia/schema/${collectionName}`

		const schemaCoId =
			registry.get(schemaKey1) || registry.get(schemaKey2) || registry.get(schemaKey3)

		if (!schemaCoId) continue

		// Special handling for Notes: create CoText (colist) first, then Note (comap) with content ref
		if (collectionName === 'notes') {
			const cotextSchemaCoId = registry.get('°Maia/schema/data/cotext') || registry.get('data/cotext')
			if (!cotextSchemaCoId) continue

			let itemCount = 0
			const coIds = []
			for (const item of collectionItems) {
				const initialText = typeof item.content === 'string' ? item.content : DEFAULT_PAPER_TEXT
				const graphemes = [...splitGraphemes(initialText)]

				const ctx = { node, account, guardian: maiaGroup }
				const { coValue: cotextCoList } = await createCoValueForSpark(ctx, null, {
					schema: cotextSchemaCoId,
					cotype: 'colist',
					data: graphemes,
					dataEngine: peer?.dbEngine,
				})

				const { coValue: noteCoMap } = await createCoValueForSpark(ctx, null, {
					schema: schemaCoId,
					cotype: 'comap',
					data: { content: cotextCoList.id },
					dataEngine: peer?.dbEngine,
				})

				coIds.push(noteCoMap.id)
				coIds.push(cotextCoList.id)
				itemCount++
			}

			seededCollections.push({
				name: collectionName,
				schemaCoId,
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
