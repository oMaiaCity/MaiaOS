/**
 * Data seeding — each merged bucket is `{ $factory, instances }` from `.data.json` files.
 * `icons` is cotext-only (SVG graphemes); vibe `icon` bracket refs resolve to those co-ids.
 */

import { createCoValueForSpark } from '@MaiaOS/db'
import { splitGraphemes } from 'unicode-segmenter/grapheme'
import { maiaFactoryRefToNanoid, maiaIdentity } from '../identity-from-maia-path.js'

const DEFAULT_PAPER_TEXT = "Dear future us, what we're creating together..."

function propertySchemaUsesCotext(propSchema) {
	if (!propSchema || typeof propSchema !== 'object') return false
	const co = propSchema.$co
	return typeof co === 'string' && co.includes('cotext.factory.json')
}

/**
 * Replace string fields that are schema-bound to cotext with seeded colist co-ids.
 * @param {object} factorySchema — canonical factory definition from getFactory
 * @returns {{ row: object, cotextCoIds: string[] }}
 */
async function materializeCotextStringFields(ctx, peer, row, factorySchema, cotextSchemaCoId) {
	const props = factorySchema?.properties
	if (!props || typeof props !== 'object') return { row: { ...row }, cotextCoIds: [] }
	const out = { ...row }
	const cotextCoIds = []
	for (const key of Object.keys(out)) {
		if (key === '$nanoid') continue
		if (!propertySchemaUsesCotext(props[key])) continue
		const raw = out[key]
		if (typeof raw !== 'string') continue
		const initialText = key === 'content' && raw.trim() === '' ? DEFAULT_PAPER_TEXT : raw
		const graphemes = [...splitGraphemes(initialText)]
		const { coValue: cotextCoList } = await createCoValueForSpark(ctx, null, {
			factory: cotextSchemaCoId,
			cotype: 'colist',
			data: graphemes,
			dataEngine: peer?.dbEngine,
		})
		out[key] = cotextCoList.id
		cotextCoIds.push(cotextCoList.id)
	}
	return { row: out, cotextCoIds }
}

function registerSeedCoIdIf(registry, humanId, coId) {
	if (typeof registry?.set !== 'function') return
	if (registry.has(humanId)) {
		const existing = registry.get(humanId)
		if (existing !== coId) {
			throw new Error(`[seedData] duplicate registry key ${humanId}: ${existing} vs ${coId}`)
		}
		return
	}
	registry.set(humanId, coId)
}

/**
 * @param {Parameters<typeof import('./ref-transform.js').transformInstanceForSeeding>[1]} seedRegistry
 * @param {{
 *   instanceCoIdMap?: Map<string, string>
 *   registerSeedCoId?: (registry: Map<string, string>, humanId: string, coId: string) => void
 * }} [options]
 */
export async function seedData(account, node, maiaGroup, peer, data, seedRegistry, options = {}) {
	const { transformInstanceForSeeding } = await import('./ref-transform.js')
	const { ensureFactoriesLoaded, getFactory } = await import(
		'@MaiaOS/validation/factory-registry.js'
	)
	const { instanceCoIdMap, registerSeedCoId } = options

	if (!data || Object.keys(data).length === 0) {
		return { collections: [], totalItems: 0, coIds: [] }
	}

	await ensureFactoriesLoaded()

	const registry =
		seedRegistry instanceof Map
			? seedRegistry
			: typeof seedRegistry.getAll === 'function'
				? seedRegistry.getAll()
				: (seedRegistry.registry ?? seedRegistry)
	const getAll = registry

	const cotextSchemaCoId =
		registry.get(maiaIdentity('cotext.factory.json').$nanoid) || registry.get('os/cotext')
	if (!cotextSchemaCoId?.startsWith?.('co_z')) {
		throw new Error('[seedData] °maia/factory/cotext.factory.json not registered')
	}

	const seededCollections = []
	let totalItems = 0
	const ctx = { node, account, guardian: maiaGroup }
	const regFn = typeof registerSeedCoId === 'function' ? registerSeedCoId : registerSeedCoIdIf

	for (const [collectionName, payload] of Object.entries(data)) {
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue

		if (collectionName === 'icons') {
			const instances = payload.instances
			if (!Array.isArray(instances)) {
				throw new Error('[seedData] icons: expected instances[] from icons.data.json')
			}
			let itemCount = 0
			const coIds = []
			for (const item of instances) {
				if (!item || typeof item !== 'object' || typeof item.svg !== 'string') {
					throw new Error('[seedData] icons: each row needs svg string')
				}
				const n = item.$nanoid
				if (typeof n !== 'string') throw new Error('[seedData] icons row missing $nanoid')
				const graphemes = [...splitGraphemes(item.svg)]
				const { coValue: cotextCoList } = await createCoValueForSpark(ctx, null, {
					factory: cotextSchemaCoId,
					cotype: 'colist',
					data: graphemes,
					dataEngine: peer?.dbEngine,
				})
				const bracketRef = `°maia/data/icons.data.json[${n}]`
				if (instanceCoIdMap) {
					instanceCoIdMap.set(n, cotextCoList.id)
					instanceCoIdMap.set(bracketRef, cotextCoList.id)
				}
				regFn(seedRegistry, n, cotextCoList.id)
				regFn(seedRegistry, bracketRef, cotextCoList.id)
				coIds.push(cotextCoList.id)
				itemCount++
			}
			seededCollections.push({
				name: collectionName,
				factoryCoId: cotextSchemaCoId,
				itemCount,
				coIds,
			})
			totalItems += itemCount
			continue
		}

		const factoryRef = payload.$factory
		const instances = payload.instances
		const isDataFileBucket = typeof factoryRef === 'string' && factoryRef.startsWith('°')
		if (!isDataFileBucket) continue
		if (!Array.isArray(instances)) {
			throw new Error(
				`[seedData] bucket "${collectionName}": expected instances array on data file header`,
			)
		}

		const factorySchema = getFactory(factoryRef)
		if (!factorySchema) {
			throw new Error(`[seedData] bucket "${collectionName}": no schema for ${factoryRef}`)
		}

		const factoryRefN = maiaFactoryRefToNanoid(factoryRef)
		const factoryCoId = registry.get(factoryRefN)
		if (!factoryCoId?.startsWith?.('co_z')) {
			throw new Error(
				`[seedData] bucket "${collectionName}": factory not in pre-seed registry: ${factoryRef}`,
			)
		}

		let itemCount = 0
		const coIds = []

		for (const item of instances) {
			if (!item || typeof item !== 'object') continue

			const { row: rowMat, cotextCoIds } = await materializeCotextStringFields(
				ctx,
				peer,
				item,
				factorySchema,
				cotextSchemaCoId,
			)
			const row = transformInstanceForSeeding(rowMat, getAll)
			const { $id: _id, ...itemWithoutId } = row

			const { coValue: itemCoMap } = await createCoValueForSpark(ctx, null, {
				factory: factoryCoId,
				cotype: 'comap',
				data: itemWithoutId,
				dataEngine: peer?.dbEngine,
				nanoid: typeof item.$nanoid === 'string' && item.$nanoid.length > 0 ? item.$nanoid : undefined,
			})
			coIds.push(itemCoMap.id, ...cotextCoIds)
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
