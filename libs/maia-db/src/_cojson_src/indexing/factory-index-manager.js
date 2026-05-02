/**
 * Schema Index Manager — instance indexing, storage hooks, catalog updates.
 * Schema colist / indexes CoMap creation lives in factory-index-schema.js.
 */

import { FACTORY_REF_PATTERN } from '@MaiaOS/validation'
import { EXCEPTION_FACTORIES } from '@MaiaOS/validation/peer-factory-registry'
import { removeIdFields } from '@MaiaOS/validation/remove-id-fields'
import { ensureCoValueLoaded } from '../../primitives/ensure-covalue-core.js'
import { create as crudCreate } from '../crud/create.js'
import * as groups from '../groups/groups.js'
import { extractHeaderFromStorageMessage, readHeaderAndContent } from './factory-index-headers.js'
import {
	ensureFactoryIndexColist,
	ensureIndexesCoMap,
	ensureNanoidIndexCoMap,
	ensureOsCoMap,
	getMetafactoryCoId,
} from './factory-index-schema.js'
import { loadIndexColistContent, resolveFactoryAuthoring } from './factory-index-warm-load.js'

export {
	ensureFactoryIndexColist,
	ensureIndexesCoMap,
	ensureNanoidIndexCoMap,
	getMetafactoryCoId,
	loadNanoidIndex,
	NANOID_INDEX_KEY,
} from './factory-index-schema.js'

/**
 * Ensure spark.os.unknown colist exists for tracking co-values without schemas
 * @param {Object} peer - Backend instance
 * @returns {Promise<RawCoList>} spark.os.unknown colist
 */
export async function ensureUnknownColist(peer) {
	const osCoMap = await ensureOsCoMap(peer)
	if (!osCoMap) return null

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

	const osId = await groups.getSparkOsId(peer, peer?.systemSparkCoId)
	if (coId === osId) {
		return true
	}

	if (osId) {
		const osCore = peer.node.getCoValue(osId)
		if (osCore && osCore.type === 'comap') {
			const osContent = osCore.getCurrentContent?.()
			if (osContent && typeof osContent.get === 'function') {
				const unknownId = osContent.get('unknown')
				if (coId === unknownId) {
					return true
				}

				const indexesId = osContent.get('indexes')
				if (coId === indexesId) {
					return true
				}

				if (indexesId) {
					const indexesCore = peer.node.getCoValue(indexesId)
					if (indexesCore && indexesCore.type === 'comap') {
						const indexesContent = indexesCore.getCurrentContent?.()
						if (indexesContent && typeof indexesContent.get === 'function') {
							const keys =
								indexesContent.keys && typeof indexesContent.keys === 'function'
									? indexesContent.keys()
									: Object.keys(indexesContent)
							for (const key of keys) {
								if (indexesContent.get(key) === coId) {
									return true
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

	const isInternal = await isInternalCoValue(peer, coValueCore.id)
	if (isInternal) {
		return { shouldIndex: false, factoryCoId: null }
	}

	const header = peer.getHeader(coValueCore)
	if (!header?.meta) {
		return { shouldIndex: false, factoryCoId: null }
	}

	const headerMeta = header.meta
	const schema = headerMeta.$factory

	if (
		EXCEPTION_FACTORIES.ACCOUNT === schema ||
		EXCEPTION_FACTORIES.GROUP === schema ||
		EXCEPTION_FACTORIES.META_SCHEMA === schema
	) {
		return { shouldIndex: false, factoryCoId: null }
	}

	if (headerMeta.type === 'account' || schema === EXCEPTION_FACTORIES.ACCOUNT) {
		return { shouldIndex: false, factoryCoId: null }
	}

	const ruleset = coValueCore.ruleset || header?.ruleset
	if (ruleset && ruleset.type === 'group') {
		return { shouldIndex: false, factoryCoId: null }
	}

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

	if (!schema) {
		return { shouldIndex: false, factoryCoId: null }
	}

	return { shouldIndex: false, factoryCoId: null }
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

	const header = peer.getHeader(coValueCore)
	if (!header?.meta) {
		return false
	}

	const headerMeta = header.meta
	const schema = headerMeta.$factory

	if (!schema) {
		return false
	}

	if (schema === EXCEPTION_FACTORIES.META_SCHEMA) {
		const { content } = readHeaderAndContent(peer, coValueCore)
		if (content && typeof content.get === 'function') {
			const title = content.get('title')
			if (title === '°maia/factory/meta.factory.json') {
				return true
			}
		}
		return false
	}

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
					if (referencedTitle === '°maia/factory/meta.factory.json') {
						return true
					}
				}
			}
		} catch (_e) {}

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
const indexingInProgress = new Set()

export async function indexCoValue(peer, coValueCoreOrId) {
	let coValueCore = coValueCoreOrId
	let coId = null

	if (typeof coValueCoreOrId === 'string') {
		coId = coValueCoreOrId
		coValueCore = peer.getCoValue(coId)
		if (!coValueCore || !peer.isAvailable(coValueCore)) {
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

	if (indexingInProgress.has(coId)) {
		return
	}

	indexingInProgress.add(coId)

	try {
		const { shouldIndex, factoryCoId } = await shouldIndexCoValue(peer, coValueCore)

		if (shouldIndex && factoryCoId) {
			const indexColist = await ensureFactoryIndexColist(peer, factoryCoId)

			if (!indexColist) {
				return
			}

			try {
				const items = indexColist.toJSON ? indexColist.toJSON() : []
				if (Array.isArray(items) && items.includes(coId)) {
					return
				}
			} catch (_e) {}

			try {
				indexColist.append(coId)
			} catch (_e) {
				return
			}
		} else if (!factoryCoId) {
			const unknownColist = await ensureUnknownColist(peer)

			if (!unknownColist) {
				return
			}

			try {
				const items = unknownColist.toJSON ? unknownColist.toJSON() : []
				if (Array.isArray(items) && items.includes(coId)) {
					return
				}
			} catch (_e) {}

			unknownColist.append(coId)
		}
	} finally {
		indexingInProgress.delete(coId)
	}
}

/**
 * Reconcile indexes - ensure all co-values with schemas are indexed
 * @param {Object} peer - Backend instance
 * @param {Object} [options] - Options
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

	const schemaIndexColists = new Map()
	const keys =
		indexesCoMap.keys && typeof indexesCoMap.keys === 'function' ? indexesCoMap.keys() : []

	for (const key of keys) {
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

	const indexed = 0
	const skipped = 0
	const errors = 0

	return { indexed, skipped, errors }
}

async function getFactoryIndexColistForRemoval(peer, factoryCoId) {
	if (!factoryCoId?.startsWith('co_z')) {
		return null
	}

	if (!peer.account) {
		return null
	}

	const indexesCoMap = await ensureIndexesCoMap(peer)
	if (!indexesCoMap) {
		return null
	}

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
		const indexColist = await getFactoryIndexColistForRemoval(peer, factoryCoId)
		removeAllFromColist(indexColist, coId)
	} else {
		const unknownColist = await ensureUnknownColist(peer)
		removeAllFromColist(unknownColist, coId)
	}
}

export { extractHeaderFromStorageMessage, readHeaderAndContent } from './factory-index-headers.js'
