/**
 * Factory index schema helpers — spark.os.indexes, per-schema index colists, nanoid map.
 * Used by collection-helpers and by factory-index-manager indexing pipeline.
 */

import { createLogger } from '@MaiaOS/logs'
import { FACTORY_REF_PATTERN } from '@MaiaOS/validation'
import { EXCEPTION_FACTORIES } from '@MaiaOS/validation/peer-factory-registry'
import { determineCotypeAndFlag } from '../../primitives/ensure-covalue-core.js'
import { createCoValueForSpark } from '../covalue/create-covalue-for-spark.js'
import * as groups from '../groups/groups.js'
import { SPARK_OS_META_FACTORY_CO_ID_KEY } from '../spark-os-keys.js'
import { readHeaderAndContent } from './factory-index-headers.js'
import {
	bootstrapWarnState,
	ensureCoValueReadyForIndex,
	loadIndexColistContent,
	resolveFactoryAuthoring,
} from './factory-index-warm-load.js'

const log = createLogger('maia-db')

const SCHEMA_REF_MATCH = /^([°@][a-zA-Z0-9_-]+)\/factory\/(.+)$/

/** Nanoid lookup CoMap lives under spark.os.indexes (not a schema index colist). */
export const NANOID_INDEX_KEY = '@nanoids'

/**
 * Ensure spark.os CoMap exists (account.sparks[spark].os)
 * @param {Object} peer - Backend instance
 * @param {string} [spark='°maia'] - Spark name
 * @returns {Promise<RawCoMap|null>} spark.os CoMap
 */
export async function ensureOsCoMap(peer, spark) {
	const effectiveSpark = spark ?? peer?.systemSparkCoId ?? '°maia'
	if (!peer.account) {
		throw new Error('[SchemaIndexManager] Account required')
	}

	const osId = await groups.getSparkOsId(peer, effectiveSpark)

	if (osId) {
		try {
			if (!(await ensureCoValueReadyForIndex(peer, osId, 10000))) return null

			const osCore = peer.getCoValue(osId)
			if (!osCore?.isAvailable()) return null

			const osContent = osCore.getCurrentContent?.()
			if (!osContent) return null

			const contentType = osContent.cotype || osContent.type
			const header = peer.getHeader(osCore)
			const headerMeta = header?.meta || null
			const _schema = headerMeta?.$factory || null

			const isCoMap = contentType === 'comap' && typeof osContent.get === 'function'

			if (!isCoMap) return null
			return osContent
		} catch (_e) {
			return null
		}
	}

	const sparksTop = peer.account?.get?.('sparks')
	if (!sparksTop?.startsWith('co_z')) {
		if (!bootstrapWarnState.registriesMissing) {
			bootstrapWarnState.registriesMissing = true
			log.warn(
				'[SchemaIndexManager] account.sparks not set yet (bootstrap). Indexing deferred until account.sparks is anchored.',
			)
		}
	}
	return null
}

/**
 * Ensure spark.os.indexes CoMap exists (dedicated container for schema indexes)
 * @param {Object} peer - Backend instance
 * @returns {Promise<RawCoMap>} spark.os.indexes CoMap
 */
export async function ensureIndexesCoMap(peer) {
	const osCoMap = await ensureOsCoMap(peer)
	if (!osCoMap) {
		return null
	}

	const indexesId = osCoMap.get('indexes')
	if (indexesId) {
		try {
			if (!(await ensureCoValueReadyForIndex(peer, indexesId, 10000))) return null

			const indexesCore = peer.getCoValue(indexesId)
			if (!indexesCore?.isAvailable()) return null

			const indexesContent = indexesCore.getCurrentContent?.()
			if (!indexesContent) return null

			const contentType = indexesContent.cotype || indexesContent.type
			const header = peer.getHeader(indexesCore)
			const headerMeta = header?.meta || null
			const _schema = headerMeta?.$factory || null

			const isCoMap = contentType === 'comap' && typeof indexesContent.get === 'function'
			if (!isCoMap) return null
			return indexesContent
		} catch (_e) {
			return null
		}
	}

	if (peer.dbEngine?.resolveSystemFactories) await peer.dbEngine.resolveSystemFactories()
	const indexesSchemaCoId = peer.infra?.indexesRegistry

	let indexesCoMapId
	if (
		indexesSchemaCoId &&
		typeof indexesSchemaCoId === 'string' &&
		indexesSchemaCoId.startsWith('co_z') &&
		peer.dbEngine
	) {
		const { cotype, isSchemaDefinition } = await determineCotypeAndFlag(peer, indexesSchemaCoId, {})
		const { coValue } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
			factory: indexesSchemaCoId,
			cotype,
			data: cotype === 'comap' ? {} : cotype === 'colist' ? [] : undefined,
			dataEngine: peer.dbEngine,
			isFactoryDefinition: isSchemaDefinition && cotype === 'comap',
		})
		indexesCoMapId = coValue.id
	} else {
		const { coValue: indexesCoMap } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
			factory: EXCEPTION_FACTORIES.META_SCHEMA,
			cotype: 'comap',
			data: {},
		})
		indexesCoMapId = indexesCoMap.id
	}

	osCoMap.set('indexes', indexesCoMapId)

	try {
		if (await ensureCoValueReadyForIndex(peer, indexesCoMapId, 5000)) {
			const indexesCore = peer.getCoValue(indexesCoMapId)
			if (indexesCore && peer.isAvailable(indexesCore)) {
				const indexesContent = indexesCore.getCurrentContent?.()
				if (indexesContent && typeof indexesContent.get === 'function') {
					return indexesContent
				}
			}
		}
	} catch (_e) {}

	return null
}

async function createNanoidsCoMapId(peer) {
	if (peer.dbEngine?.resolveSystemFactories) await peer.dbEngine.resolveSystemFactories()
	const indexesSchemaCoId = peer.infra?.indexesRegistry

	if (
		indexesSchemaCoId &&
		typeof indexesSchemaCoId === 'string' &&
		indexesSchemaCoId.startsWith('co_z') &&
		peer.dbEngine
	) {
		const { cotype, isSchemaDefinition } = await determineCotypeAndFlag(peer, indexesSchemaCoId, {})
		const { coValue } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
			factory: indexesSchemaCoId,
			cotype,
			data: cotype === 'comap' ? {} : cotype === 'colist' ? [] : undefined,
			dataEngine: peer.dbEngine,
			isFactoryDefinition: isSchemaDefinition && cotype === 'comap',
		})
		return coValue.id
	}
	const { coValue: nanoidsCoMap } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
		factory: EXCEPTION_FACTORIES.META_SCHEMA,
		cotype: 'comap',
		data: {},
	})
	return nanoidsCoMap.id
}

async function loadNanoidCoMapContentById(peer, coId) {
	if (typeof coId !== 'string' || !coId.startsWith('co_z')) return null
	try {
		if (!(await ensureCoValueReadyForIndex(peer, coId, 10000))) return null
		const core = peer.getCoValue(coId)
		if (!core?.isAvailable()) return null
		const nanoidsContent = core.getCurrentContent?.()
		if (!nanoidsContent) return null
		const contentType = nanoidsContent.cotype || nanoidsContent.type
		const isCoMap = contentType === 'comap' && typeof nanoidsContent.get === 'function'
		if (!isCoMap) return null
		return nanoidsContent
	} catch (_e) {
		return null
	}
}

/**
 * Ensure spark.os.indexes["@nanoids"] CoMap exists (nanoid string → instance/factory co_z).
 * @param {Object} peer
 * @returns {Promise<import('@cojson/cojson').RawCoMap|null>}
 */
export async function ensureNanoidIndexCoMap(peer) {
	const osCoMap = await ensureOsCoMap(peer)
	if (!osCoMap) return null

	const indexesContent = await ensureIndexesCoMap(peer)
	if (!indexesContent || typeof indexesContent.get !== 'function') return null

	const existingId = indexesContent.get(NANOID_INDEX_KEY)
	if (existingId) {
		const loaded = await loadNanoidCoMapContentById(peer, existingId)
		if (loaded) return loaded
	}

	const nanoidsCoMapId = await createNanoidsCoMapId(peer)
	if (!nanoidsCoMapId?.startsWith?.('co_z')) return null

	indexesContent.set(NANOID_INDEX_KEY, nanoidsCoMapId)

	try {
		if (await ensureCoValueReadyForIndex(peer, nanoidsCoMapId, 5000)) {
			const nanoidsCore = peer.getCoValue(nanoidsCoMapId)
			if (nanoidsCore && peer.isAvailable(nanoidsCore)) {
				const nanoidsContent = nanoidsCore.getCurrentContent?.()
				if (nanoidsContent && typeof nanoidsContent.get === 'function') {
					return nanoidsContent
				}
			}
		}
	} catch (_e) {}

	return null
}

/**
 * Load nanoid index CoMap content (nanoid → co_z) from spark.os.indexes["@nanoids"].
 * @param {Object} peer
 * @returns {Promise<import('@cojson/cojson').RawCoMap|null>}
 */
export async function loadNanoidIndex(peer) {
	return ensureNanoidIndexCoMap(peer)
}

/**
 * Metafactory co-id from spark.os.metaFactoryCoId (bootstrap anchor).
 * @param {Object} peer - Backend instance
 * @returns {Promise<string|null>}
 */
export async function getMetafactoryCoId(peer) {
	if (peer.infra?.meta?.startsWith('co_z')) {
		return peer.infra.meta
	}
	const spark = peer?.systemSparkCoId
	const osId = await groups.getSparkOsId(peer, spark)
	if (!osId) return null

	const osCore = peer.node.getCoValue(osId)
	if (!osCore || osCore.type !== 'comap') return null

	const osContent = osCore.getCurrentContent?.()
	if (!osContent || typeof osContent.get !== 'function') return null

	const metaSchemaCoId = osContent.get(SPARK_OS_META_FACTORY_CO_ID_KEY)
	if (metaSchemaCoId && typeof metaSchemaCoId === 'string' && metaSchemaCoId.startsWith('co_z')) {
		return metaSchemaCoId
	}
	return null
}

async function ensureSchemaSpecificIndexColistSchema(peer, factoryCoId, metaSchemaCoId = null) {
	if (!factoryCoId?.startsWith('co_z')) {
		throw new Error(`[SchemaIndexManager] Invalid schema co-id: ${factoryCoId}`)
	}

	const schemaCoValueCore = peer.getCoValue(factoryCoId)
	/** @type {import('@cojson/cojson').RawCoMap|null} */
	let schemaMapContent = null
	if (schemaCoValueCore) {
		const sLoaded = readHeaderAndContent(peer, schemaCoValueCore)
		schemaMapContent = sLoaded?.content ?? null
		if (schemaMapContent && typeof schemaMapContent.get === 'function') {
			const existingIdx = schemaMapContent.get('indexColistFactoryCoId')
			if (typeof existingIdx === 'string' && existingIdx.startsWith('co_z')) {
				return existingIdx
			}
		}
	}

	if (!metaSchemaCoId) {
		if (schemaCoValueCore) {
			const header = peer.getHeader(schemaCoValueCore)
			const headerMeta = header?.meta
			metaSchemaCoId = headerMeta?.$factory

			if (metaSchemaCoId && !metaSchemaCoId.startsWith('co_z')) {
				metaSchemaCoId = peer.infra?.meta ?? null
			}
		}

		if (!metaSchemaCoId?.startsWith('co_z')) {
			metaSchemaCoId = (await getMetafactoryCoId(peer)) || peer.infra?.meta
		}
	}

	if (!metaSchemaCoId?.startsWith('co_z')) return null

	const factoryDef = await resolveFactoryAuthoring(peer, factoryCoId, { returnType: 'factory' })
	if (!factoryDef) {
		if (typeof process !== 'undefined' && process.env?.DEBUG) log.error('factoryDef missing')
		return null
	}

	const factoryTitle = factoryDef.title || factoryDef.$id
	if (!factoryTitle || typeof factoryTitle !== 'string' || !FACTORY_REF_PATTERN.test(factoryTitle)) {
		return null
	}

	const match = factoryTitle.match(SCHEMA_REF_MATCH)
	if (!match) return null
	const [, prefix, path] = match
	const indexColistFactoryTitle = `${prefix}/factory/index/${path}`

	const indexColistFactoryDef = {
		title: indexColistFactoryTitle,
		description: `Factory-specific index colist for ${factoryTitle} - only allows instances of this factory`,
		cotype: 'colist',
		indexing: false,
		items: {
			$co: factoryCoId,
		},
	}

	try {
		const { cotype, isSchemaDefinition } = await determineCotypeAndFlag(
			peer,
			metaSchemaCoId,
			indexColistFactoryDef,
		)
		const { coValue: createdFactory } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
			factory: metaSchemaCoId,
			cotype,
			data: cotype === 'comap' ? indexColistFactoryDef : cotype === 'colist' ? [] : undefined,
			dataEngine: peer.dbEngine,
			isFactoryDefinition: isSchemaDefinition && cotype === 'comap',
		})
		const indexColistFactoryCoId = createdFactory.id
		if (schemaMapContent && typeof schemaMapContent.set === 'function') {
			try {
				schemaMapContent.set('indexColistFactoryCoId', indexColistFactoryCoId)
			} catch (_e) {}
		}
		return indexColistFactoryCoId
	} catch (_error) {
		return null
	}
}

/**
 * Ensure schema index colist exists for a given schema co-id
 * @param {Object} peer - Backend instance
 * @param {string} factoryCoId - Schema co-id (e.g., "co_z123...")
 * @param {string} [metaSchemaCoId] - Optional metaSchema co-id (if not provided, will be extracted from schema)
 * @returns {Promise<RawCoList>} Schema index colist
 */
export async function ensureFactoryIndexColist(peer, factoryCoId, metaSchemaCoId = null) {
	if (!factoryCoId || typeof factoryCoId !== 'string' || !factoryCoId.startsWith('co_z')) {
		throw new Error(
			`[SchemaIndexManager] Invalid schema co-id: expected string starting with 'co_z', got ${typeof factoryCoId}: ${factoryCoId}`,
		)
	}

	const factoryDef = await resolveFactoryAuthoring(peer, factoryCoId, { returnType: 'factory' })
	if (!factoryDef) return null

	if (factoryDef.indexing !== true) {
		return null
	}

	const indexesCoMap = await ensureIndexesCoMap(peer)

	if (!indexesCoMap) {
		return null
	}

	let indexColistId = indexesCoMap.get(factoryCoId)
	if (indexColistId) {
		const indexColistContent = await loadIndexColistContent(peer, indexColistId, 8000)
		if (indexColistContent && typeof indexColistContent.append === 'function') {
			return indexColistContent
		}
		return null
	}

	const indexSchemaCoId = await ensureSchemaSpecificIndexColistSchema(
		peer,
		factoryCoId,
		metaSchemaCoId,
	)
	if (!indexSchemaCoId) return null

	const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')
	const { coValue: indexColistRaw } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
		factory: indexSchemaCoId,
		cotype: 'colist',
		data: [],
		dataEngine: peer.dbEngine,
	})
	indexColistId = indexColistRaw.id

	indexesCoMap.set(factoryCoId, indexColistId)

	const indexColistCore = peer.node.getCoValue(indexColistId)
	if (indexColistCore && indexColistCore.type === 'colist') {
		const indexColistContent = indexColistCore.getCurrentContent?.()
		if (indexColistContent && typeof indexColistContent.append === 'function') {
			return indexColistContent
		}
	}

	return indexColistRaw
}
