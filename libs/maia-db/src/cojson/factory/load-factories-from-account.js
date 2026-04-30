/**
 * Migration-only: load factory definitions from account spark.os indexes.
 * Lives outside authoring-resolver.js so that module has no edge to read.js (Sentrux acyclicity).
 */

import { getGlobalCoCache } from '../cache/coCache.js'
import { read as universalRead } from '../crud/read.js'
import { waitForStoreReady } from '../crud/read-operations.js'
import { SPARK_OS_META_FACTORY_CO_ID_KEY } from '../spark-os-keys.js'
import { resolve } from './authoring-resolver.js'

/** Wait for co-value to become available (node-only, no peer.read) */
async function waitForCoValueAvailable(core, timeoutMs = 5000) {
	if (!core) return false
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		if (core.isAvailable?.()) return true
		await new Promise((r) => setTimeout(r, 50))
	}
	return false
}

/**
 * Resolve spark.os id from account via account.sparks[spark].os (node-only, no peer.read)
 * @param {import('cojson').LocalNode} node
 * @param {import('cojson').RawAccount} account
 * @param {string} spark - Spark name (e.g. '°maia')
 * @returns {Promise<string|null>} os co-id or null
 */
async function resolveSparkOsIdFromNode(node, account, spark) {
	const sparksId = account.get?.('sparks')
	if (!sparksId?.startsWith('co_z')) return null

	const sparksCore = node.getCoValue(sparksId) || (await node.loadCoValueCore?.(sparksId))
	if (!(await waitForCoValueAvailable(sparksCore))) return null
	const sparks = sparksCore?.getCurrentContent?.()
	if (!sparks || typeof sparks.get !== 'function') return null
	const sparkCoId = sparks.get(spark)
	if (!sparkCoId?.startsWith('co_z')) return null

	const sparkCore = node.getCoValue(sparkCoId) || (await node.loadCoValueCore?.(sparkCoId))
	if (!(await waitForCoValueAvailable(sparkCore))) return null
	const sparkContent = sparkCore?.getCurrentContent?.()
	if (!sparkContent || typeof sparkContent.get !== 'function') return null
	return sparkContent.get('os') || null
}

/**
 * Load all factory definitions (definition catalog colist)
 * MIGRATIONS ONLY - uses resolve(peer, factoryCoId, { returnType: 'factory' }) for each schema
 *
 * @param {import('cojson').LocalNode} node - LocalNode instance
 * @param {import('cojson').RawAccount} account - Account CoMap
 * @returns {Promise<Object>} Map of schema co-ids to schema definitions { [coId]: schemaDefinition }
 */
export async function loadFactoriesFromAccount(node, account) {
	if (!node || !account) {
		throw new Error('[loadFactoriesFromAccount] Node and account required')
	}

	try {
		const peer = {
			node,
			account,
			getCoValue: (id) => node.getCoValue(id),
			isAvailable: (c) => c?.isAvailable?.() ?? false,
			getHeader: (c) => c?.verified?.header ?? null,
			getCurrentContent: (c) => c?.getCurrentContent?.() ?? null,
			subscriptionCache: getGlobalCoCache(node),
			systemSpark: '°maia',
			read(schema, key, keys, filter, options = {}) {
				const {
					deepResolve = true,
					maxDepth = 15,
					timeoutMs = 5000,
					map = null,
					onChange = null,
				} = options
				const readOptions = { deepResolve, maxDepth, timeoutMs, map, onChange }
				if (keys && Array.isArray(keys)) {
					return Promise.all(
						keys.map((coId) => universalRead(this, coId, schema, null, schema, readOptions)),
					)
				}
				if (key) return universalRead(this, key, schema, null, schema, readOptions)
				if (!schema) return universalRead(this, null, null, filter, null, readOptions)
				return universalRead(this, null, schema, filter, null, readOptions)
			},
		}

		const osId = await resolveSparkOsIdFromNode(node, account, '°maia')
		if (!osId?.startsWith('co_z')) return {}

		const osStore = await peer.read(null, osId, null, null, { deepResolve: false })
		await waitForStoreReady(osStore, osId, 5000)
		const osData = osStore.value
		const metaCoId = osData?.[SPARK_OS_META_FACTORY_CO_ID_KEY]
		const indexesId = osData?.indexes
		const factoryCoIds = []
		if (metaCoId?.startsWith?.('co_z') && indexesId?.startsWith?.('co_z')) {
			const indexesStore = await peer.read(null, indexesId, null, null, {
				deepResolve: false,
			})
			await waitForStoreReady(indexesStore, indexesId, 5000)
			const indexesData = indexesStore.value
			const catalogColistId = indexesData?.[metaCoId]
			if (catalogColistId?.startsWith?.('co_z')) {
				const colistCore = peer.getCoValue(catalogColistId)
				if (colistCore && peer.isAvailable(colistCore)) {
					const colistContent = peer.getCurrentContent(colistCore)
					const items = colistContent?.toJSON?.() ?? []
					if (Array.isArray(items)) {
						for (const id of items) {
							if (typeof id === 'string' && id.startsWith('co_z')) factoryCoIds.push(id)
						}
					}
				}
			}
		}

		if (factoryCoIds.length === 0) return {}

		const schemas = {}
		for (const factoryCoId of factoryCoIds) {
			if (typeof factoryCoId !== 'string' || !factoryCoId.startsWith('co_z')) continue
			try {
				const schema = await resolve(peer, factoryCoId, { returnType: 'factory', timeoutMs: 5000 })
				if (schema) schemas[factoryCoId] = schema
			} catch (_error) {}
		}
		return schemas
	} catch (_error) {
		return {}
	}
}
