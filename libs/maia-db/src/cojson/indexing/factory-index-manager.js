/**
 * Schema Index Manager
 *
 * Provides helper functions for automatic schema-based indexing of co-values.
 * Manages schema index colists keyed by schema co-id in spark.os.indexes (account.sparks[°maia].os.indexes).
 *
 * Structure:
 * - spark.os.metaFactoryCoId: co_z of metafactory (anchor)
 * - spark.os.indexes: schema-co-id → colist (definition catalog at key === metaFactoryCoId; per-schema instance indexes otherwise)
 * - spark.os.unknown: colist of co-values without schemas
 * - spark.os.indexes["@nanoids"]: nanoid string → co_z (header.meta.$nanoid index).
 */

import { createLogger } from '@MaiaOS/logs'
import { FACTORY_REF_PATTERN } from '@MaiaOS/validation'
import { EXCEPTION_FACTORIES } from '@MaiaOS/validation/peer-factory-registry'
import { removeIdFields } from '@MaiaOS/validation/remove-id-fields'
import { create as crudCreate } from '../crud/create.js'
import { ensureCoValueLoaded } from '../crud/ensure-covalue-core.js'
import * as groups from '../groups/groups.js'
import { SPARK_OS_META_FACTORY_CO_ID_KEY } from '../spark-os-keys.js'
import { extractHeaderFromStorageMessage, readHeaderAndContent } from './factory-index-headers.js'
import {
	bootstrapWarnState,
	ensureCoValueReadyForIndex,
	loadIndexColistContent,
	resolveFactoryAuthoring,
} from './factory-index-warm-load.js'

const log = createLogger('maia-db')

// Matches both °Spark/schema/... and @domain/schema/... (captures prefix + path)
const SCHEMA_REF_MATCH = /^([°@][a-zA-Z0-9_-]+)\/factory\/(.+)$/

/** Nanoid lookup CoMap lives under spark.os.indexes (not a schema index colist). */
export const NANOID_INDEX_KEY = '@nanoids'

/**
 * Ensure spark.os CoMap exists (account.sparks[spark].os)
 * @param {Object} peer - Backend instance
 * @param {string} [spark='°maia'] - Spark name
 * @returns {Promise<RawCoMap|null>} spark.os CoMap
 */
async function ensureOsCoMap(peer, spark) {
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

			// Get the content - should work now since read() ensured it's loaded
			const osContent = osCore.getCurrentContent?.()
			if (!osContent) return null

			// Check if content is a CoMap using content.cotype and header $schema
			const contentType = osContent.cotype || osContent.type
			const header = peer.getHeader(osCore)
			const headerMeta = header?.meta || null
			const _schema = headerMeta?.$factory || null

			// Verify it's a CoMap: check cotype and that it has get() method
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
	// First ensure spark.os exists
	const osCoMap = await ensureOsCoMap(peer)
	if (!osCoMap) {
		return null
	}

	// Check if spark.os.indexes already exists
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

	// Create new spark.os.indexes CoMap (per-CoValue group)
	// Use proper runtime validation with dbEngine when schema is available
	if (peer.dbEngine?.resolveSystemFactories) await peer.dbEngine.resolveSystemFactories()
	const indexesSchemaCoId = peer.infra?.indexesRegistry

	// Validate indexesSchemaCoId is a string
	let indexesCoMapId
	if (
		indexesSchemaCoId &&
		typeof indexesSchemaCoId === 'string' &&
		indexesSchemaCoId.startsWith('co_z') &&
		peer.dbEngine
	) {
		// Proper runtime validation: Use CRUD crudCreate() with dbEngine for schema validation
		const created = await crudCreate(peer, indexesSchemaCoId, {})
		indexesCoMapId = created.id
	} else {
		const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')
		const { coValue: indexesCoMap } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
			factory: EXCEPTION_FACTORIES.META_SCHEMA,
			cotype: 'comap',
			data: {},
		})
		indexesCoMapId = indexesCoMap.id
	}

	// Store in spark.os.indexes
	osCoMap.set('indexes', indexesCoMapId)

	// Use universal read() API to load and resolve the newly created indexes CoMap
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

	// Fallback: return null if not available yet (caller should handle this gracefully)
	return null
}

/**
 * Create empty nanoid lookup CoMap (META_SCHEMA) — used by {@link ensureNanoidIndexCoMap}.
 * @param {Object} peer
 * @returns {Promise<string|null>} co_z id or null
 */
async function createNanoidsCoMapId(peer) {
	if (peer.dbEngine?.resolveSystemFactories) await peer.dbEngine.resolveSystemFactories()
	const indexesSchemaCoId = peer.infra?.indexesRegistry

	if (
		indexesSchemaCoId &&
		typeof indexesSchemaCoId === 'string' &&
		indexesSchemaCoId.startsWith('co_z') &&
		peer.dbEngine
	) {
		const created = await crudCreate(peer, indexesSchemaCoId, {})
		return created.id
	}
	const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')
	const { coValue: nanoidsCoMap } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
		factory: EXCEPTION_FACTORIES.META_SCHEMA,
		cotype: 'comap',
		data: {},
	})
	return nanoidsCoMap.id
}

/**
 * Resolve loaded CoMap content for a co_z id, or null.
 * @param {Object} peer
 * @param {string} coId
 * @returns {Promise<import('@cojson/cojson').RawCoMap|null>}
 */
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
 * @param {Object} peer
 * @param {import('@cojson/cojson').CoValueCore} coValueCore
 * @returns {Promise<void>}
 */
export async function indexByNanoid(peer, coValueCore) {
	if (!coValueCore?.id || !peer.isAvailable(coValueCore)) return
	const header = peer.getHeader(coValueCore)
	if (!header) return
	return indexByNanoidFromHeader(peer, coValueCore.id, header)
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
 * Generate schema-specific index colist schema for a given schema
 * Creates a schema that enforces type safety using $co keyword
 * @param {Object} peer - Backend instance
 * @param {string} factoryCoId - Schema co-id (e.g., "co_z123...")
 * @param {string} [metaSchemaCoId] - Optional metaSchema co-id (if not provided, will be extracted from schema's headerMeta)
 * @returns {Promise<string|null>} Schema-specific index colist schema co-id or null if failed
 */
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

	// Get metaSchema co-id - prefer provided parameter, otherwise extract from schema's headerMeta
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
		const createdFactory = await crudCreate(peer, metaSchemaCoId, indexColistFactoryDef)
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
 * Creates the colist in spark.os.indexes[<factoryCoId>] (all schemas indexed in spark.os.indexes)
 * Uses schema-specific index colist schema for type safety
 * @param {Object} peer - Backend instance
 * @param {string} factoryCoId - Schema co-id (e.g., "co_z123...")
 * @param {string} [metaSchemaCoId] - Optional metaSchema co-id (if not provided, will be extracted from schema)
 * @returns {Promise<RawCoList>} Schema index colist
 */
export async function ensureFactoryIndexColist(peer, factoryCoId, metaSchemaCoId = null) {
	// Validate factoryCoId is a string
	if (!factoryCoId || typeof factoryCoId !== 'string' || !factoryCoId.startsWith('co_z')) {
		throw new Error(
			`[SchemaIndexManager] Invalid schema co-id: expected string starting with 'co_z', got ${typeof factoryCoId}: ${factoryCoId}`,
		)
	}

	// Check indexing property from schema definition
	// Skip creating index colists if indexing is not true (defaults to false)
	const factoryDef = await resolveFactoryAuthoring(peer, factoryCoId, { returnType: 'factory' })
	if (!factoryDef) return null

	// Check indexing property (defaults to false if not present)
	if (factoryDef.indexing !== true) {
		return null
	}

	// All schema indexes go in spark.os.indexes, keyed by schema co-id
	const indexesCoMap = await ensureIndexesCoMap(peer)

	if (!indexesCoMap) {
		// spark.os.indexes not ready (expected during bootstrap) - skip indexing for now
		return null
	}

	// Check if index colist already exists (using schema co-id as key)
	let indexColistId = indexesCoMap.get(factoryCoId)
	if (indexColistId) {
		const indexColistContent = await loadIndexColistContent(peer, indexColistId, 8000)
		if (indexColistContent && typeof indexColistContent.append === 'function') {
			return indexColistContent
		}
		// If indexColistId exists but couldn't be loaded, DON'T create a new one
		return null
	}

	// Create new index colist with schema-specific schema
	// Ensure schema-specific index colist schema exists
	// Pass metaSchema co-id if provided to avoid registry lookup issues
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

	// Store in spark.os.indexes using schema co-id as key
	indexesCoMap.set(factoryCoId, indexColistId)

	// CRITICAL: Don't wait for storage sync - it blocks the UI!
	// The set() operation is already queued in CoJSON's CRDT
	// Storage sync happens asynchronously in the background

	// Return the CoList content (for append operations)
	const indexColistCore = peer.node.getCoValue(indexColistId)
	if (indexColistCore && indexColistCore.type === 'colist') {
		const indexColistContent = indexColistCore.getCurrentContent?.()
		if (indexColistContent && typeof indexColistContent.append === 'function') {
			return indexColistContent
		}
	}

	// Fallback: return raw CoList (should have append method)
	return indexColistRaw
}

/**
 * Ensure spark.os.unknown colist exists for tracking co-values without schemas
 * @param {Object} peer - Backend instance
 * @returns {Promise<RawCoList>} spark.os.unknown colist
 */
export async function ensureUnknownColist(peer) {
	const osCoMap = await ensureOsCoMap(peer)
	if (!osCoMap) return null

	// Check if unknown colist already exists
	const unknownColistId = osCoMap.get('unknown')
	if (unknownColistId) {
		const unknownColistCore = peer.node.getCoValue(unknownColistId)
		if (unknownColistCore && unknownColistCore.type === 'colist') {
			const unknownColistContent = unknownColistCore.getCurrentContent?.()
			if (unknownColistContent && typeof unknownColistContent.append === 'function') {
				return unknownColistContent
			}
		}
	}

	const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')
	const { coValue: unknownColist } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
		factory: EXCEPTION_FACTORIES.META_SCHEMA,
		cotype: 'colist',
		data: [],
	})
	osCoMap.set('unknown', unknownColist.id)

	// CRITICAL: Don't wait for storage sync - it blocks the UI!
	// The set() operation is already queued in CoJSON's CRDT
	// Storage sync happens asynchronously in the background

	return unknownColist
}

/**
 * Check if a co-value is an internal co-value that should NOT be indexed
 * Internal co-values include: account.data, spark.os, schema index colists, unknown colist
 * @param {Object} peer - Backend instance
 * @param {string} coId - Co-value co-id
 * @returns {Promise<boolean>} True if internal co-value (should not be indexed)
 */
async function isInternalCoValue(peer, coId) {
	if (!peer.account || !coId) {
		return false
	}

	// Check if it's spark.os (account.registries.sparks[°maia].os)
	const osId = await groups.getSparkOsId(peer, peer?.systemSparkCoId)
	if (coId === osId) {
		return true
	}

	// Check if it's inside spark.os (unknown colist, or indexes container)
	if (osId) {
		const osCore = peer.node.getCoValue(osId)
		if (osCore && osCore.type === 'comap') {
			const osContent = osCore.getCurrentContent?.()
			if (osContent && typeof osContent.get === 'function') {
				// Check if it's unknown colist
				const unknownId = osContent.get('unknown')
				if (coId === unknownId) {
					return true
				}

				// Check if it's spark.os.indexes itself
				const indexesId = osContent.get('indexes')
				if (coId === indexesId) {
					return true
				}

				// Check if it's inside spark.os.indexes (any schema index colist)
				if (indexesId) {
					const indexesCore = peer.node.getCoValue(indexesId)
					if (indexesCore && indexesCore.type === 'comap') {
						const indexesContent = indexesCore.getCurrentContent?.()
						if (indexesContent && typeof indexesContent.get === 'function') {
							// Check if it's any schema index colist (all values in indexes are schema index colists)
							const keys =
								indexesContent.keys && typeof indexesContent.keys === 'function'
									? indexesContent.keys()
									: Object.keys(indexesContent)
							for (const key of keys) {
								if (indexesContent.get(key) === coId) {
									return true // This is a schema index colist
								}
							}
						}
					}
				}
			}
		}
	}

	return false
}

/**
 * @param {object} peer
 * @param {string} coId
 * @param {object} header
 */
async function indexByNanoidFromHeader(peer, coId, header) {
	if (!coId?.startsWith('co_z') || !header) return
	if (await isInternalCoValue(peer, coId)) return
	const nanoid = header?.meta?.$nanoid
	if (typeof nanoid !== 'string' || nanoid.length === 0) return
	const nanoidsContent = await ensureNanoidIndexCoMap(peer)
	if (!nanoidsContent || typeof nanoidsContent.set !== 'function') return
	try {
		nanoidsContent.set(nanoid, coId)
	} catch (_e) {}
}

/**
 * Post-store indexing: full path when `hasVerifiedContent`, else header from msg for nanoid only.
 * @param {object} peer
 * @param {object} msg
 * @returns {Promise<void>}
 */
export async function indexFromMessage(peer, msg) {
	const coId = msg?.id
	if (!coId?.startsWith('co_z')) return
	const core = peer.getCoValue(coId)
	if (!core || !peer.isAvailable(core)) return

	if (core.hasVerifiedContent?.()) {
		return applyPersistentCoValueIndexing(peer, core)
	}

	const fromMsg = extractHeaderFromStorageMessage(msg)
	const header = fromMsg || peer.getHeader(core)
	if (header) {
		await indexByNanoidFromHeader(peer, coId, header)
	}
}

/**
 * One pass over all local CoValues: (re)apply catalog + instance indexes. Used after seed with indexing disabled.
 * @param {object} peer
 * @returns {Promise<void>}
 */
export async function rebuildAllIndexes(peer) {
	const map = peer.getAllCoValues?.() ?? peer.node?.coValues
	if (!map || typeof map.entries !== 'function') return
	for (const [coId, core] of map.entries()) {
		if (!coId?.startsWith('co_z') || !core) continue
		if (!peer.isAvailable?.(core)) continue
		if (!core.hasVerifiedContent?.()) continue
		try {
			// eslint-disable-next-line no-await-in-loop
			await applyPersistentCoValueIndexing(peer, core)
		} catch (error) {
			const isFactoryCompilationError = error?.message?.includes('Failed to compile factory')
			if (!isFactoryCompilationError) {
				log.error('[rebuildAllIndexes] failed for', coId, error)
			}
		}
	}
}

/**
 * @param {object|null|undefined} factoryDef - result of resolve(..., { returnType: 'factory' })
 * @returns {boolean} true only when schema explicitly has indexing: true
 */
export function factoryDefAllowsInstanceIndexing(factoryDef) {
	return factoryDef != null && factoryDef.indexing === true
}

/**
 * Check if a co-value should be indexed (excludes exception schemas and internal co-values)
 * @param {Object} peer - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @returns {Promise<{shouldIndex: boolean, factoryCoId: string | null}>} Result with shouldIndex flag and schema co-id
 */
export async function shouldIndexCoValue(peer, coValueCore) {
	if (!coValueCore) {
		return { shouldIndex: false, factoryCoId: null }
	}

	// Check if it's an internal co-value (account.data, spark.os, index colists, etc.)
	const isInternal = await isInternalCoValue(peer, coValueCore.id)
	if (isInternal) {
		return { shouldIndex: false, factoryCoId: null }
	}

	// Get header metadata
	const header = peer.getHeader(coValueCore)
	if (!header?.meta) {
		return { shouldIndex: false, factoryCoId: null }
	}

	const headerMeta = header.meta
	const schema = headerMeta.$factory

	// Skip exception schemas
	if (
		EXCEPTION_FACTORIES.ACCOUNT === schema ||
		EXCEPTION_FACTORIES.GROUP === schema ||
		EXCEPTION_FACTORIES.META_SCHEMA === schema
	) {
		return { shouldIndex: false, factoryCoId: null }
	}

	// Check if it's an account (has type but no $schema or has @account)
	if (headerMeta.type === 'account' || schema === EXCEPTION_FACTORIES.ACCOUNT) {
		return { shouldIndex: false, factoryCoId: null }
	}

	// Check if it's a group (check ruleset.type)
	const ruleset = coValueCore.ruleset || header?.ruleset
	if (ruleset && ruleset.type === 'group') {
		return { shouldIndex: false, factoryCoId: null }
	}

	// If schema is a co-id, check if indexing is enabled for this schema
	if (schema && typeof schema === 'string' && schema.startsWith('co_z')) {
		try {
			const factoryDef = await resolveFactoryAuthoring(peer, schema, { returnType: 'factory' })
			if (!factoryDefAllowsInstanceIndexing(factoryDef)) {
				return { shouldIndex: false, factoryCoId: schema }
			}
			return { shouldIndex: true, factoryCoId: schema }
		} catch (_error) {
			return { shouldIndex: false, factoryCoId: schema }
		}
	}

	// If no schema, should not be indexed (will go to unknown colist)
	if (!schema) {
		return { shouldIndex: false, factoryCoId: null }
	}

	// Schema is not a co-id (might be exception schema or invalid) - don't index
	return { shouldIndex: false, factoryCoId: null }
}

/**
 * Metafactory co-id from spark.os.metaFactoryCoId (bootstrap anchor).
 * @param {Object} peer - Backend instance
 * @returns {Promise<string|null>}
 */
async function getMetafactoryCoId(peer) {
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

/**
 * Ensure indexes[metaCoId] holds the definition catalog colist; create at runtime if missing.
 * @returns {Promise<string|null>} catalog colist co-id
 */
async function ensureDefinitionCatalogColistId(peer, metaCoId) {
	const indexesCoMap = await ensureIndexesCoMap(peer)
	if (!indexesCoMap) return null
	const catalogColistId = indexesCoMap.get(metaCoId)
	if (catalogColistId && typeof catalogColistId === 'string' && catalogColistId.startsWith('co_z')) {
		return catalogColistId
	}
	const metaForItems = (await getMetafactoryCoId(peer)) || peer?.infra?.meta
	if (!metaForItems?.startsWith?.('co_z')) return null
	const catalogSchemaDef = {
		title: '°maia/factory/index/definitions-catalog',
		description: 'Colist of factory definition co_zs',
		cotype: 'colist',
		indexing: false,
		items: { $co: metaForItems },
	}
	try {
		const created = await crudCreate(peer, metaCoId, removeIdFields(catalogSchemaDef))
		const catalogSchemaCoId = created?.id
		if (!catalogSchemaCoId?.startsWith('co_z')) return null
		const colist = await crudCreate(peer, catalogSchemaCoId, [])
		const colistId = colist?.id
		if (!colistId?.startsWith('co_z')) return null
		indexesCoMap.set(metaCoId, colistId)
		return colistId
	} catch (_e) {
		return null
	}
}

/**
 * Append a factory-definition co-id to spark.os.indexes[metaCoId] catalog (idempotent).
 * @param {Object} peer
 * @param {string} defCoId
 */
export async function appendFactoryDefinitionToCatalog(peer, defCoId) {
	if (!defCoId?.startsWith('co_z')) return
	const metaCoId = await getMetafactoryCoId(peer)
	if (!metaCoId) return
	const catalogColistId = await ensureDefinitionCatalogColistId(peer, metaCoId)
	if (!catalogColistId) return
	const catCore = peer.getCoValue(catalogColistId)
	const loaded = readHeaderAndContent(peer, catCore)
	const colistContent = loaded?.content
	if (!colistContent || typeof colistContent.append !== 'function') return
	try {
		const items = colistContent.toJSON?.() ?? []
		if (Array.isArray(items) && items.includes(defCoId)) return
		colistContent.append(defCoId)
	} catch (_e) {}
}

/**
 * Register a factory-definition CoValue: append to definition catalog; optional per-schema instance index colist.
 * @param {Object} peer - Backend instance
 * @param {CoValueCore} schemaCoValueCore - Schema co-value core
 * @returns {Promise<void>}
 */
export async function registerFactoryCoValue(peer, schemaCoValueCore) {
	if (!schemaCoValueCore?.id) {
		return
	}

	const loaded = readHeaderAndContent(peer, schemaCoValueCore)
	if (!loaded?.content || typeof loaded.content.get !== 'function') {
		return
	}
	const { core: defCore, content } = loaded

	const title = content.get('title')
	if (!title || typeof title !== 'string' || !FACTORY_REF_PATTERN.test(title)) {
		return
	}

	await appendFactoryDefinitionToCatalog(peer, defCore.id)

	const indexing = content.get('indexing')
	if (indexing !== true) {
		return
	}

	const header = peer.getHeader(defCore)
	const headerMeta = header?.meta
	let metaSchemaCoId = headerMeta?.$factory

	if (metaSchemaCoId && !metaSchemaCoId.startsWith('co_z')) {
		metaSchemaCoId = peer.infra?.meta ?? null
	}

	await ensureFactoryIndexColist(peer, defCore.id, metaSchemaCoId)
}

/**
 * Single post-persist path: register factory-definition CoValues in the definition catalog (and index colists when applicable), otherwise run instance indexing when {@link shouldIndexCoValue} allows it (same gate as the storage hook had for non-schemas).
 * @param {Object} peer
 * @param {CoValueCore} coValueCore
 * @returns {Promise<void>}
 */
export async function applyPersistentCoValueIndexing(peer, coValueCore) {
	if (!coValueCore?.id || !peer.isAvailable(coValueCore)) return
	await indexByNanoid(peer, coValueCore)
	if (await isFactoryCoValue(peer, coValueCore)) {
		await registerFactoryCoValue(peer, coValueCore)
		return
	}
	const { shouldIndex } = await shouldIndexCoValue(peer, coValueCore)
	if (!shouldIndex) return
	await indexCoValue(peer, coValueCore)
}

/**
 * Check if a co-value is a schema co-value (has metaschema co-id as $schema or has schema-like content)
 * Uses multiple heuristics to detect schemas, including content-based detection
 * @param {Object} peer - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @returns {Promise<boolean>} True if schema co-value
 */
export async function isFactoryCoValue(peer, coValueCore) {
	if (!coValueCore) {
		return false
	}

	// PRIMARY: Check headerMeta.$factory FIRST (always available immediately, most reliable)
	const header = peer.getHeader(coValueCore)
	if (!header?.meta) {
		return false
	}

	const headerMeta = header.meta
	const schema = headerMeta.$factory

	// Skip if no schema in headerMeta
	if (!schema) {
		return false
	}

	// Metaschema itself uses @metaSchema exception (can't self-reference)
	// Special case: Check content.title to confirm it's metaschema
	// Uses "°maia/factory/meta.factory.maia" (schema namekey from JSON definition - single source of truth)
	if (schema === EXCEPTION_FACTORIES.META_SCHEMA) {
		const { content } = readHeaderAndContent(peer, coValueCore)
		if (content && typeof content.get === 'function') {
			const title = content.get('title')
			if (title === '°maia/factory/meta.factory.maia') {
				return true // This is the metaschema itself
			}
		}
		return false // @metaSchema but not metaschema - might be other exception
	}

	// PRIMARY CHECK: Schema co-values have metaschema co-id as their $schema
	// Check if headerMeta.$factory points to metaschema directly (via content check)
	// This works during seeding when registry doesn't exist yet
	if (schema && typeof schema === 'string' && schema.startsWith('co_z')) {
		try {
			let referencedCoValueCore = peer.getCoValue(schema)
			if (!referencedCoValueCore) {
				referencedCoValueCore = await ensureCoValueLoaded(peer, schema, {
					waitForAvailable: true,
					timeoutMs: 5000,
				})
			}
			if (referencedCoValueCore?.isAvailable()) {
				const { content: referencedContent } = readHeaderAndContent(peer, referencedCoValueCore)
				if (referencedContent && typeof referencedContent.get === 'function') {
					const referencedTitle = referencedContent.get('title')
					if (referencedTitle === '°maia/factory/meta.factory.maia') {
						return true
					}
				}
			}
		} catch (_e) {
			// Metaschema not available yet - fall through to registry lookup
		}

		// FALLBACK: Try registry lookup (for runtime cases when registry exists)
		const metaSchemaCoId = await getMetafactoryCoId(peer)
		if (metaSchemaCoId && schema === metaSchemaCoId) {
			return true
		}
	}

	return false
}

/**
 * Index a co-value in its schema's index colist or add to unknown colist
 * @param {Object} peer - Backend instance
 * @param {CoValueCore|string} coValueCoreOrId - CoValueCore instance or co-id string
 * @returns {Promise<void>}
 */
// Track co-values currently being indexed to prevent duplicate work
const indexingInProgress = new Set()

export async function indexCoValue(peer, coValueCoreOrId) {
	// Handle both CoValueCore and co-id string
	let coValueCore = coValueCoreOrId
	let coId = null

	if (typeof coValueCoreOrId === 'string') {
		coId = coValueCoreOrId
		coValueCore = peer.getCoValue(coId)
		if (!coValueCore || !peer.isAvailable(coValueCore)) {
			// Try loading co-value before giving up (caller may have created it but it's not loaded yet)
			if (peer.node?.loadCoValueCore) {
				await peer.node.loadCoValueCore(coId).catch(() => {})
			}
			coValueCore = peer.getCoValue(coId)
		}
		if (!coValueCore || !peer.isAvailable(coValueCore)) {
			return
		}
	} else {
		coId = coValueCoreOrId?.id
	}

	if (!coValueCore || !coId) {
		return
	}

	// CRITICAL: Idempotency check - skip if already indexing this co-value
	// This prevents duplicate indexing when storage hook is called multiple times
	if (indexingInProgress.has(coId)) {
		return // Already indexing - skip
	}

	indexingInProgress.add(coId)

	try {
		// Check if should be indexed
		const { shouldIndex, factoryCoId } = await shouldIndexCoValue(peer, coValueCore)

		if (shouldIndex && factoryCoId) {
			// Has schema with indexing: true - index it in schema's index colist
			// Ensure schema index colist exists (in spark.os, keyed by schema co-id)
			const indexColist = await ensureFactoryIndexColist(peer, factoryCoId)

			if (!indexColist) {
				// spark.os not available OR schema has indexing: false - skip indexing
				// Don't warn - this is expected for schemas with indexing: false (e.g., index schemas)
				return
			}

			// CRITICAL: Check if co-value co-id already in index (idempotent)
			// This is the final check - prevents duplicate entries even if function is called multiple times
			try {
				const items = indexColist.toJSON ? indexColist.toJSON() : []
				if (Array.isArray(items) && items.includes(coId)) {
					// Already indexed - skip silently (this is expected for idempotency)
					return
				}
			} catch (_e) {
				// Continue anyway - might be empty
			}

			// Add co-value co-id to index colist
			// Schema-specific index colist schema will validate the co-id format via $co keyword
			try {
				indexColist.append(coId)
			} catch (_e) {
				return
			}

			// CRITICAL: Don't wait for storage sync - it blocks the UI
			// The append() operation is already queued in CoJSON's CRDT, so it will persist eventually
			// Storage sync happens asynchronously in the background - no need to block here
			// This allows instant local-first UI updates without waiting for persistence
		} else if (!factoryCoId) {
			// ROOT CAUSE FIX: Only add to UNKNOWN when CoValue has NO schema at all.
			// CoValues with a schema that has indexing: false (e.g. CoTexts) must NOT go to UNKNOWN -
			// they have a valid schema, they're just not in a schema index. Skip indexing entirely.
			const unknownColist = await ensureUnknownColist(peer)

			if (!unknownColist) {
				// spark.os not available - skip indexing for now
				return
			}

			// Check if already in unknown colist (idempotent)
			try {
				const items = unknownColist.toJSON ? unknownColist.toJSON() : []
				if (Array.isArray(items) && items.includes(coId)) {
					// Already indexed - skip
					return
				}
			} catch (_e) {
				// Continue anyway
			}

			// Add to unknown colist
			unknownColist.append(coId)

			// CRITICAL: Don't wait for storage sync - it blocks the UI
			// The append() operation is already queued in CoJSON's CRDT, so it will persist eventually
			// Storage sync happens asynchronously in the background - no need to block here
		}
	} finally {
		// Always remove from indexingInProgress, even on error
		indexingInProgress.delete(coId)
	}
}

/**
 * Reconcile indexes - ensure all co-values with schemas are indexed
 * This is a background job that can be run periodically to ensure index completeness
 * @param {Object} peer - Backend instance
 * @param {Object} [options] - Options
 * @param {number} [options.batchSize=100] - Number of co-values to process per batch
 * @param {number} [options.delayMs=10] - Delay between batches (ms) to avoid blocking UI
 * @returns {Promise<{indexed: number, skipped: number, errors: number}>} Reconciliation results
 */
export async function reconcileIndexes(peer, options = {}) {
	const { batchSize: _batchSize = 100, delayMs: _delayMs = 10 } = options

	if (!peer.account) {
		return { indexed: 0, skipped: 0, errors: 0 }
	}

	const indexesCoMap = await ensureIndexesCoMap(peer)
	if (!indexesCoMap) {
		return { indexed: 0, skipped: 0, errors: 0 }
	}

	// Get all schema index colists from spark.os.indexes
	const schemaIndexColists = new Map() // factoryCoId → indexColist
	const keys =
		indexesCoMap.keys && typeof indexesCoMap.keys === 'function' ? indexesCoMap.keys() : []

	for (const key of keys) {
		// All keys in indexes are schema co-ids (starts with co_z)
		if (key.startsWith('co_z')) {
			const indexColistId = indexesCoMap.get(key)
			if (indexColistId) {
				const indexColistContent = await loadIndexColistContent(peer, indexColistId, 2000)
				if (indexColistContent && typeof indexColistContent.toJSON === 'function') {
					schemaIndexColists.set(key, indexColistContent)
				}
			}
		}
	}

	// Get all co-values from peer node and check if they're indexed
	// Note: This is a simplified approach - in practice, you might want to iterate through
	// all known co-values more efficiently
	const indexed = 0
	const skipped = 0
	const errors = 0

	// For now, reconciliation is best-effort - indexes are maintained by storage hook
	// This function can be extended to scan all co-values if needed

	return { indexed, skipped, errors }
}

/**
 * Get schema index colist for removal (doesn't check indexing property)
 * Used when removing co-values from indexes - we need to remove even if indexing is currently disabled
 * This is different from ensureFactoryIndexColist which only returns colists for schemas with indexing: true
 * @param {Object} peer - Backend instance
 * @param {string} factoryCoId - Schema co-id (e.g., "co_z123...")
 * @returns {Promise<RawCoList|null>} Schema index colist or null if not found
 */
async function getSchemaIndexColistForRemoval(peer, factoryCoId) {
	if (!factoryCoId?.startsWith('co_z')) {
		return null
	}

	if (!peer.account) {
		return null
	}

	// Get spark.os.indexes CoMap using ensureIndexesCoMap helper
	const indexesCoMap = await ensureIndexesCoMap(peer)
	if (!indexesCoMap) {
		return null
	}

	// Get index colist ID from spark.os.indexes (keyed by schema co-id)
	const indexColistId = indexesCoMap.get(factoryCoId)
	if (!indexColistId || typeof indexColistId !== 'string' || !indexColistId.startsWith('co_')) {
		return null
	}

	const indexColistContent = await loadIndexColistContent(peer, indexColistId, 2000)
	if (
		indexColistContent &&
		typeof indexColistContent.toJSON === 'function' &&
		typeof indexColistContent.delete === 'function'
	) {
		return indexColistContent
	}

	return null
}

/**
 * Remove a co-value from its schema's index colist or from unknown colist
 * @param {Object} peer - Backend instance
 * @param {string} coId - Co-value co-id to remove
 * @param {string} [factoryCoId] - Optional schema co-id (if known, avoids lookup)
 * @returns {Promise<void>}
 */
export async function removeFromIndex(peer, coId, factoryCoId = null) {
	if (!coId?.startsWith('co_z')) return

	function removeAllFromColist(colist, id) {
		if (!colist?.toJSON || !colist?.delete) return
		const items = colist.toJSON()
		for (let i = items.length - 1; i >= 0; i--) {
			if (items[i] === id) colist.delete(i)
		}
	}

	if (!factoryCoId) {
		const coValueCore = peer.getCoValue(coId)
		if (coValueCore && peer.isAvailable(coValueCore)) {
			const header = peer.getHeader(coValueCore)
			if (header?.meta) {
				factoryCoId = header.meta.$factory
			}
		}
	}

	if (factoryCoId && typeof factoryCoId === 'string' && factoryCoId.startsWith('co_z')) {
		const indexColist = await getSchemaIndexColistForRemoval(peer, factoryCoId)
		removeAllFromColist(indexColist, coId)
	} else {
		const unknownColist = await ensureUnknownColist(peer)
		removeAllFromColist(unknownColist, coId)
	}
}

export { extractHeaderFromStorageMessage, readHeaderAndContent } from './factory-index-headers.js'
