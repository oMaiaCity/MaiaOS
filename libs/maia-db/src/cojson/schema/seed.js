/**
 * CoJSON Seed Operation - Seed database with configs, schemas, and initial data
 *
 * Mirrors IndexedDB seeding logic but uses CRDTs instead of mocked objects/arrays
 *
 * IMPORTANT: CoJSON assigns IDs automatically when creating CoValues.
 * We create CoValues first, get their `.id` property, then use those IDs for transformations.
 *
 * SPECIAL HANDLING:
 * - @metaSchema (Meta Schema): Uses "@metaSchema" string in headerMeta.$schema (can't self-reference co-id)
 *   The CoMap definition has title: "Meta Schema"
 * - °Maia/schema/meta: Human-readable ID for metaschema (matches schema $id format)
 *   Gets transformed to °Maia co-id during transformation
 *
 * Seeding Order (matches plan):
 * 1. Migration creates account, profile only (no scaffold)
 * 2. Bootstrap (when no account.registries): guardian, account.temp, metaschema, schemata, scaffold, cleanup temp
 * 3. Schemas (topologically sorted) - each with own group extending guardian
 * 4. Populate os.schematas with schema co-ids
 * 5. Configs (actors, views, contexts, etc.) - per-CoValue groups with guardian
 * 6. Data (todos, entities) - per-CoValue groups with guardian
 *
 * account.temp staging: Bootstrap co-ids stored in account.temp (persists across restarts).
 * Every CoValue has its own group extending guardian.
 * @metaSchema only for metaschema; all other infra uses real schema co-ids.
 */

import { SCHEMA_REF_PATTERN } from '@MaiaOS/schemata'
import mergedMetaSchema from '@MaiaOS/schemata/os/meta.schema.json'
import { createCoValueForSpark } from '../covalue/create-covalue-for-spark.js'
import { ensureCoValueLoaded } from '../crud/collection-helpers.js'
import { deleteRecord } from '../crud/delete.js'
import { waitForStoreReady } from '../crud/read-operations.js'
import * as groups from '../groups/groups.js'
import { ensureIndexesCoMap } from '../indexing/schema-index-manager.js'
import { resolve } from '../schema/resolver.js'

const MAIA_SPARK = '°Maia'

/**
 * Simple account seed: no account.sparks.
 * Used for all signups (human + agent). Genesis (full scaffold + vibes) is PEER_MODE=sync only.
 * Vibes come from sync; registries set via linkAccountToRegistries.
 * @param {RawAccount} account
 * @param {LocalNode} node
 */
export async function simpleAccountSeed(_account, _node) {
	// No account.sparks - human/agent get vibes via sync; registries via linkAccountToRegistries
	console.log('✅ Simple account seed: (registries via link)')
}

/**
 * Bootstrap and scaffold when account.registries doesn't exist (migration only creates account+profile).
 * Order: guardian → account.temp → metaschema → schemata → scaffold → cleanup temp.
 * @param {RawAccount} account
 * @param {LocalNode} node
 * @param {Object} schemas - Schema definitions from getAllSchemas()
 * @param {Object} [dbEngine] - DB engine for co-id schema validation (required when schemas use co-ids)
 * @returns {Promise<void>}
 */
async function bootstrapAndScaffold(account, node, schemas, dbEngine = null) {
	const { EXCEPTION_SCHEMAS } = await import('../../schemas/registry.js')
	const { getAllSchemas } = await import('@MaiaOS/schemata')
	const allSchemas = schemas || getAllSchemas()

	// 1. guardian (spark's admin group)
	const guardian = node.createGroup()

	// 2. account.temp
	const tempGroup = node.createGroup()
	tempGroup.extend(guardian, 'extend')
	const tempCoMap = tempGroup.createMap({}, { $schema: EXCEPTION_SCHEMAS.META_SCHEMA })
	account.set('temp', tempCoMap.id)
	tempCoMap.set('guardian', guardian.id)

	// 3. Metaschema
	const _metaSchemaMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }
	const tempMetaSchemaDef = buildMetaSchemaForSeeding('co_zTEMP')
	const cleanedTempDef = {
		definition: removeIdFields(tempMetaSchemaDef.definition || tempMetaSchemaDef),
	}
	const { coValue: metaSchemaCoMap } = await createCoValueForSpark(
		{ node, account, guardian },
		null,
		{ schema: EXCEPTION_SCHEMAS.META_SCHEMA, cotype: 'comap', data: cleanedTempDef, dbEngine },
	)
	const metaSchemaCoId = metaSchemaCoMap.id
	const updatedMetaSchemaDef = buildMetaSchemaForSeeding(metaSchemaCoId)
	const {
		$schema: _s,
		$id: _i,
		id: _id,
		...directProps
	} = updatedMetaSchemaDef.definition || updatedMetaSchemaDef
	for (const [k, v] of Object.entries(removeIdFields(directProps))) metaSchemaCoMap.set(k, v)
	tempCoMap.set('metaschema', metaSchemaCoId)

	// 4. Schemata (topologically sorted)
	const uniqueSchemasBy$id = new Map()
	for (const [name, schema] of Object.entries(allSchemas)) {
		const key = schema.$id || `°Maia/schema/${name}`
		if (!uniqueSchemasBy$id.has(key)) uniqueSchemasBy$id.set(key, { name, schema })
	}
	const findCoRefs = (obj, visited = new Set()) => {
		if (!obj || typeof obj !== 'object' || visited.has(obj)) return new Set()
		visited.add(obj)
		const refs = new Set()
		if (obj.$co && typeof obj.$co === 'string' && obj.$co.startsWith('°Maia/schema/'))
			refs.add(obj.$co)
		for (const v of Object.values(obj)) {
			if (v && typeof v === 'object') {
				;(Array.isArray(v) ? v : [v]).forEach((item) => {
					if (item && typeof item === 'object')
						findCoRefs(item, visited).forEach((r) => {
							refs.add(r)
						})
				})
			}
		}
		return refs
	}
	const deps = new Map()
	for (const [key, { schema }] of uniqueSchemasBy$id) deps.set(key, findCoRefs(schema))
	const sorted = []
	const done = new Set()
	const doing = new Set()
	const visit = (key) => {
		if (done.has(key)) return
		if (doing.has(key)) return
		doing.add(key)
		for (const d of deps.get(key) || []) {
			if (d.startsWith('°Maia/schema/') && uniqueSchemasBy$id.has(d)) visit(d)
		}
		doing.delete(key)
		done.add(key)
		sorted.push(key)
	}
	for (const key of uniqueSchemasBy$id.keys()) {
		if (key !== '°Maia/schema/meta') visit(key)
	}

	const schemaCoIdMap = new Map()
	for (const schemaKey of sorted) {
		const { schema } = uniqueSchemasBy$id.get(schemaKey)
		const { $schema, $id, id, ...props } = schema
		const cleaned = removeIdFields(props)
		const { coValue: schemaCoMap } = await createCoValueForSpark({ node, account, guardian }, null, {
			schema: metaSchemaCoId,
			cotype: 'comap',
			data: cleaned,
			dbEngine,
		})
		const coId = schemaCoMap.id
		schemaCoIdMap.set(schemaKey, coId)
		tempCoMap.set(schemaKey, coId)
	}

	// 5. Scaffold (use real schema co-ids, @metaSchema only for metaschema)
	// Each scaffold type gets its own group extending guardian (no shared group).
	const sparkSchemaCoId = tempCoMap.get('°Maia/schema/data/spark') || EXCEPTION_SCHEMAS.META_SCHEMA
	const schematasSchemaCoId =
		tempCoMap.get('°Maia/schema/os/schematas-registry') || EXCEPTION_SCHEMAS.META_SCHEMA
	const osSchemaCoId = tempCoMap.get('°Maia/schema/os/os-registry') || EXCEPTION_SCHEMAS.META_SCHEMA
	const capabilitiesSchemaCoId =
		tempCoMap.get('°Maia/schema/os/capabilities') || EXCEPTION_SCHEMAS.META_SCHEMA
	const indexesSchemaCoId =
		tempCoMap.get('°Maia/schema/os/indexes-registry') || EXCEPTION_SCHEMAS.META_SCHEMA
	const vibesSchemaCoId =
		tempCoMap.get('°Maia/schema/os/vibes-registry') || EXCEPTION_SCHEMAS.META_SCHEMA
	const runtimesSchemaCoId =
		tempCoMap.get('°Maia/schema/os/runtimes-registry') || EXCEPTION_SCHEMAS.META_SCHEMA
	const _sparksSchemaCoId =
		tempCoMap.get('°Maia/schema/os/sparks-registry') || EXCEPTION_SCHEMAS.META_SCHEMA

	const ctx = { node, account, guardian }
	const scaffoldOpts = (schema, data) => ({ schema, cotype: 'comap', data, dbEngine })
	const { coValue: maiaSpark } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(sparkSchemaCoId, { name: '°Maia' }),
	)
	const { coValue: os } = await createCoValueForSpark(ctx, null, scaffoldOpts(osSchemaCoId, {}))
	const { coValue: capabilities } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(capabilitiesSchemaCoId, {}),
	)
	capabilities.set('guardian', guardian.id)
	os.set('capabilities', capabilities.id)
	const { coValue: schematas } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(schematasSchemaCoId, {}),
	)
	const { coValue: indexes } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(indexesSchemaCoId, {}),
	)
	const { coValue: vibes } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(vibesSchemaCoId, {}),
	)
	const { coValue: runtimes } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(runtimesSchemaCoId, {}),
	)
	os.set('schematas', schematas.id)
	os.set('indexes', indexes.id)
	os.set('runtimes', runtimes.id)
	maiaSpark.set('os', os.id)
	maiaSpark.set('vibes', vibes.id)
	schematas.set('°Maia/schema/meta', metaSchemaCoId)
	for (const [k, coId] of schemaCoIdMap) schematas.set(k, coId)

	// Create account.registries with registries.sparks["°Maia"] (replaces account.sparks)
	const { removeGroupMember } = await import('../groups/groups.js')
	const memberIdToRemove = account?.id ?? account?.$jazz?.id
	const registriesMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }

	const registriesGroup = node.createGroup()
	registriesGroup.extend(guardian, 'extend')
	registriesGroup.addMember('everyone', 'reader')
	const registries = registriesGroup.createMap({}, registriesMeta)

	const sparksGroup = node.createGroup()
	sparksGroup.extend(guardian, 'extend')
	sparksGroup.addMember('everyone', 'reader')
	const sparksRegistry = sparksGroup.createMap({}, registriesMeta)
	sparksRegistry.set(MAIA_SPARK, maiaSpark.id)
	registries.set('sparks', sparksRegistry.id)

	const humansGroup = node.createGroup()
	humansGroup.extend(guardian, 'extend')
	humansGroup.addMember('everyone', 'reader')
	const humans = humansGroup.createMap({}, registriesMeta)
	registries.set('humans', humans.id)

	for (const g of [registriesGroup, sparksGroup, humansGroup]) {
		try {
			await removeGroupMember(g, memberIdToRemove)
		} catch (_e) {
			/* guardian remains admin */
		}
	}
	account.set('registries', registries.id)

	// 6. Cleanup temp
	if (typeof account.delete === 'function') account.delete('temp')

	// 7. Persist scaffold to storage before returning (critical: account.registries + °Maia must survive restart)
	const wfs = node.syncManager?.waitForStorageSync
	if (!node.storage) {
		console.warn('[Bootstrap] node.storage missing - scaffold may not persist across restart')
	} else if (!wfs || typeof wfs !== 'function') {
		console.warn(
			'[Bootstrap] waitForStorageSync unavailable - scaffold may not persist across restart',
		)
	} else {
		const PERSIST_TIMEOUT_MS = 30000
		try {
			await Promise.race([
				Promise.all([
					wfs.call(node.syncManager, account.id),
					wfs.call(node.syncManager, registries.id),
					wfs.call(node.syncManager, maiaSpark.id),
				]),
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error(`waitForStorageSync timeout after ${PERSIST_TIMEOUT_MS}ms`)),
						PERSIST_TIMEOUT_MS,
					),
				),
			])
			// Belt-and-suspenders: wait for all dirty co-values to flush
			if (node.syncManager.waitForAllCoValuesSync) {
				await Promise.race([
					node.syncManager.waitForAllCoValuesSync(PERSIST_TIMEOUT_MS),
					new Promise((_, reject) =>
						setTimeout(() => reject(new Error('waitForAllCoValuesSync timeout')), PERSIST_TIMEOUT_MS),
					),
				])
			}
		} catch (e) {
			throw new Error(
				`[Bootstrap] Failed to persist scaffold: ${e?.message ?? e}. Restart would re-bootstrap with new ids.`,
			)
		}
	}

	console.log(
		'✅ Bootstrap scaffold complete: account.registries, °Maia spark, os, schematas, indexes, runtimes, vibes',
	)
}

/**
 * Bootstrap account.registries (sync agent only, during genesis seed).
 * Creates account.registries with registries.sparks and registries.humans.
 * Default first spark: registries.sparks["°Maia"] = maiaSparkCoId.
 * Maia guardian owner, everyone=reader on registries/sparks/humans. Human/agent link via GET /syncRegistry.
 * @private
 * @param {Object} backend
 * @param {Object} maiaGroup - °Maia spark's guardian group
 */
async function bootstrapAccountRegistries(backend, maiaGroup) {
	const registriesId = backend.account?.get('registries')
	if (!registriesId?.startsWith('co_z')) return
	const registriesStore = await backend.read(null, registriesId)
	await waitForStoreReady(registriesStore, registriesId, 10000)
	const registriesData = registriesStore?.value
	if (!registriesData || registriesData.error) return
	const sparksId = registriesData.sparks
	if (!sparksId?.startsWith('co_z')) return
	const sparksStore = await backend.read(null, sparksId)
	await waitForStoreReady(sparksStore, sparksId, 10000)
	const sparksData = sparksStore?.value
	if (!sparksData || sparksData.error) return
	const maiaSparkCoId = sparksData[MAIA_SPARK]
	if (!maiaSparkCoId || !maiaSparkCoId.startsWith('co_z')) return

	const sparkCore = backend.getCoValue(maiaSparkCoId)
	if (!sparkCore) return
	if (!backend.isAvailable(sparkCore)) {
		await new Promise((resolve, reject) => {
			const t = setTimeout(() => reject(new Error('Timeout')), 10000)
			const unsub = sparkCore.subscribe((c) => {
				if (c && backend.isAvailable(c)) {
					clearTimeout(t)
					unsub?.()
					resolve()
				}
			})
		})
	}
	const sparkContent = backend.getCurrentContent(sparkCore)
	if (!sparkContent || typeof sparkContent.get !== 'function') return

	const { EXCEPTION_SCHEMAS } = await import('../../schemas/registry.js')
	const node = backend.node

	// Get capabilities from spark.os (source of truth for guardian)
	const osId = sparkContent.get('os')
	if (!osId || !osId.startsWith('co_z')) return
	const osCore = backend.getCoValue(osId)
	if (!osCore || !backend.isAvailable(osCore)) return
	const osContent = backend.getCurrentContent(osCore)
	if (!osContent || typeof osContent.get !== 'function') return
	const capabilitiesId = osContent.get('capabilities')
	if (!capabilitiesId || !capabilitiesId.startsWith('co_z')) return
	const capabilitiesCore = backend.getCoValue(capabilitiesId)
	if (!capabilitiesCore || !backend.isAvailable(capabilitiesCore)) return
	const capabilitiesContent = backend.getCurrentContent(capabilitiesCore)
	if (!capabilitiesContent || typeof capabilitiesContent.set !== 'function') return

	const { resolve } = await import('../schema/resolver.js')
	const registriesSchemaCoId = await resolve(backend, '°Maia/schema/os/registries', {
		returnType: 'coId',
	})
	const sparksRegistrySchemaCoId = await resolve(backend, '°Maia/schema/os/sparks-registry', {
		returnType: 'coId',
	})
	const humansRegistrySchemaCoId = await resolve(backend, '°Maia/schema/os/humans-registry', {
		returnType: 'coId',
	})
	const registriesMeta = registriesSchemaCoId
		? { $schema: registriesSchemaCoId }
		: { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }
	const sparksRegistryMeta = sparksRegistrySchemaCoId
		? { $schema: sparksRegistrySchemaCoId }
		: { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }
	const humansRegistryMeta = humansRegistrySchemaCoId
		? { $schema: humansRegistrySchemaCoId }
		: { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }

	const { removeGroupMember } = await import('../groups/groups.js')
	const account = backend.account
	const memberIdToRemove =
		typeof node.getCurrentAccountOrAgentID === 'function'
			? node.getCurrentAccountOrAgentID()
			: (account?.id ?? account?.$jazz?.id)

	// account.registries (top-level, not under spark) - Maia guardian, public read
	const existingRegistriesId = account.get('registries')
	let registriesContent = null
	if (existingRegistriesId?.startsWith('co_z')) {
		const registriesCore = backend.getCoValue(existingRegistriesId)
		if (registriesCore && backend.isAvailable(registriesCore)) {
			registriesContent = backend.getCurrentContent(registriesCore)
		}
	}
	if (!registriesContent || typeof registriesContent.set !== 'function') {
		const registriesGroup = node.createGroup()
		registriesGroup.extend(maiaGroup, 'extend')
		registriesGroup.addMember('everyone', 'reader')
		const registries = registriesGroup.createMap({}, registriesMeta)
		try {
			await removeGroupMember(registriesGroup, memberIdToRemove)
		} catch (_e) {
			/* guardian remains admin */
		}
		account.set('registries', registries.id)
		registriesContent = registries
	}

	const sparksRegistryId = registriesContent.get('sparks')
	let sparksContent = null
	if (sparksRegistryId) {
		const sparksCore = backend.getCoValue(sparksRegistryId)
		if (sparksCore && backend.isAvailable(sparksCore)) {
			sparksContent = backend.getCurrentContent(sparksCore)
		}
	}
	if (!sparksContent || typeof sparksContent.set !== 'function') {
		const sparksGroup = node.createGroup()
		sparksGroup.extend(maiaGroup, 'extend')
		sparksGroup.addMember('everyone', 'reader')
		const sparks = sparksGroup.createMap({}, sparksRegistryMeta)
		try {
			await removeGroupMember(sparksGroup, memberIdToRemove)
		} catch (_e) {
			/* guardian remains admin */
		}
		registriesContent.set('sparks', sparks.id)
		sparksContent = sparks
	}

	// Default first spark: registries.sparks["°Maia"] = maiaSparkCoId
	sparksContent.set(MAIA_SPARK, maiaSparkCoId)

	// Ensure registries.humans exists (username -> account co-id)
	const humansRegistryId = registriesContent.get('humans')
	let humansContent = null
	if (humansRegistryId) {
		const humansCore = backend.getCoValue(humansRegistryId)
		if (humansCore && backend.isAvailable(humansCore)) {
			humansContent = backend.getCurrentContent(humansCore)
		}
	}
	if (!humansContent || typeof humansContent.set !== 'function') {
		const humansGroup = node.createGroup()
		humansGroup.extend(maiaGroup, 'extend')
		humansGroup.addMember('everyone', 'reader')
		const humans = humansGroup.createMap({}, humansRegistryMeta)
		try {
			await removeGroupMember(humansGroup, memberIdToRemove)
		} catch (_e) {
			/* guardian remains admin */
		}
		registriesContent.set('humans', humans.id)
	}

	console.log('✅ account.registries bootstrapped (sparks[°Maia], humans)')
}

/**
 * Recursively remove 'id' fields from schema objects (AJV only accepts $id, not id)
 * Preserve 'id' in properties/items (valid property names).
 * @param {any} obj - Object to clean
 * @param {boolean} inPropertiesOrItems - Whether inside properties/items
 * @returns {any} Cleaned object
 */
function removeIdFields(obj, inPropertiesOrItems = false) {
	if (obj === null || obj === undefined) return obj
	if (typeof obj !== 'object') return obj
	if (Array.isArray(obj)) return obj.map((item) => removeIdFields(item, inPropertiesOrItems))
	const cleaned = {}
	for (const [key, value] of Object.entries(obj)) {
		if (key === 'id' && !inPropertiesOrItems) continue
		const isPropertiesOrItems = key === 'properties' || key === 'items'
		cleaned[key] =
			value !== null && value !== undefined && typeof value === 'object'
				? removeIdFields(value, isPropertiesOrItems || inPropertiesOrItems)
				: value
	}
	return cleaned
}

/**
 * Delete all seeded co-values (configs and data) but preserve account identity and schemata
 *
 * This function is used before reseeding to clean up old configs and data
 * while preserving essential account structure. It:
 * 1. Queries all schema index colists from spark.os.indexes
 * 2. Gets all co-value co-ids from those colists and spark.os.unknown
 * 3. Filters out schemata co-values (checking spark.os.schematas registry)
 * 4. Deletes all non-schema co-values (configs, vibes, data entities)
 * 5. Deletes all index colists from spark.os.indexes
 * 6. Clears containers: spark.os.indexes, spark.os.unknown, spark.vibes
 *
 * **PRESERVED** (not deleted):
 * - account (the account CoMap itself)
 * - account.profile (profile CoMap with identity info)
 * - account.registries.sparks["°Maia"] (system spark with group)
 * - spark.os.schematas (schema registry - all schema co-ids)
 * - spark.os.metaSchema (metaschema reference)
 *
 * **DELETED** (cleaned up):
 * - All configs (actors, views, contexts, states, styles, inboxes)
 * - All vibes (from account.vibes)
 * - All data entities (todos, etc.)
 * - All schema index colists (will be recreated automatically)
 * - All entries in spark.os.indexes (container cleared)
 * - All entries in spark.os.unknown (items removed via deleteRecord)
 * - All entries in account.vibes (container cleared)
 *
 * @param {RawAccount} account - The account
 * @param {LocalNode} node - The LocalNode instance
 * @param {CoJSONBackend} backend - Backend instance
 * @returns {Promise<{deleted: number, errors: number}>} Summary of deletion
 */
async function deleteSeededCoValues(_account, _node, backend) {
	let deletedCount = 0
	let errorCount = 0

	try {
		// Get °Maia spark's os
		const osId = await groups.getSparkOsId(backend, MAIA_SPARK)
		if (!osId) {
			return { deleted: 0, errors: 0 }
		}

		const osCore = await ensureCoValueLoaded(backend, osId, {
			waitForAvailable: true,
			timeoutMs: 5000,
		})

		if (!osCore || !backend.isAvailable(osCore)) {
			return { deleted: 0, errors: 0 }
		}

		const osCoMap = backend.getCurrentContent(osCore)
		if (!osCoMap || typeof osCoMap.get !== 'function') {
			return { deleted: 0, errors: 0 }
		}

		// Get spark.os.schematas CoMap to build set of schema co-ids
		const schematasId = osCoMap.get('schematas')
		const schemaCoIds = new Set()

		if (schematasId) {
			const schematasCore = await ensureCoValueLoaded(backend, schematasId, {
				waitForAvailable: true,
				timeoutMs: 5000,
			})

			if (schematasCore && backend.isAvailable(schematasCore)) {
				const schematasContent = backend.getCurrentContent(schematasCore)
				if (schematasContent && typeof schematasContent.get === 'function') {
					// Get all schema co-ids from registry (values are schema co-ids)
					const keys =
						schematasContent.keys && typeof schematasContent.keys === 'function'
							? schematasContent.keys()
							: Object.keys(schematasContent)

					for (const key of keys) {
						const schemaCoId = schematasContent.get(key)
						if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
							schemaCoIds.add(schemaCoId)
						}
					}
				}
			}
		}

		// Also add metaschema if it exists in spark.os.metaSchema
		const metaSchemaId = osCoMap.get('metaSchema')
		if (metaSchemaId && typeof metaSchemaId === 'string' && metaSchemaId.startsWith('co_z')) {
			schemaCoIds.add(metaSchemaId)
		}

		// Collect all co-value co-ids from schema index colists in spark.os.indexes
		const coValuesToDelete = new Set()
		let indexesContentForCollection = null

		// Get spark.os.indexes CoMap
		const indexesId = osCoMap.get('indexes')
		if (indexesId) {
			try {
				const indexesCore = await ensureCoValueLoaded(backend, indexesId, {
					waitForAvailable: true,
					timeoutMs: 5000,
				})

				if (indexesCore && backend.isAvailable(indexesCore)) {
					indexesContentForCollection = backend.getCurrentContent(indexesCore)
					if (indexesContentForCollection && typeof indexesContentForCollection.get === 'function') {
						// Iterate all keys in spark.os.indexes (all are schema index colists)
						const keys =
							indexesContentForCollection.keys && typeof indexesContentForCollection.keys === 'function'
								? indexesContentForCollection.keys()
								: Object.keys(indexesContentForCollection)

						console.log(`[Seed] Found ${keys.length} schema index colists in spark.os.indexes`)

						for (const key of keys) {
							// All keys in indexes are schema co-ids (starts with co_z) - these are schema index colists
							if (key.startsWith('co_z')) {
								const indexColistId = indexesContentForCollection.get(key)
								if (indexColistId) {
									try {
										const indexColistCore = await ensureCoValueLoaded(backend, indexColistId, {
											waitForAvailable: true,
											timeoutMs: 2000,
										})

										if (indexColistCore && backend.isAvailable(indexColistCore)) {
											const indexColistContent = backend.getCurrentContent(indexColistCore)
											if (indexColistContent && typeof indexColistContent.toJSON === 'function') {
												const items = indexColistContent.toJSON()
												// Add all co-value co-ids from this index colist
												for (const item of items) {
													if (item && typeof item === 'string' && item.startsWith('co_z')) {
														coValuesToDelete.add(item)
													}
												}
											}
										}
									} catch (_e) {
										errorCount++
									}
								}
							}
						}
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		// Also get co-values from unknown colist
		let unknownContentForClearing = null
		const unknownId = osCoMap.get('unknown')
		if (unknownId) {
			try {
				const unknownCore = await ensureCoValueLoaded(backend, unknownId, {
					waitForAvailable: true,
					timeoutMs: 2000,
				})

				if (unknownCore && backend.isAvailable(unknownCore)) {
					unknownContentForClearing = backend.getCurrentContent(unknownCore)
					if (unknownContentForClearing && typeof unknownContentForClearing.toJSON === 'function') {
						const items = unknownContentForClearing.toJSON()
						console.log(`[Seed] Found ${items.length} co-values in spark.os.unknown`)
						for (const item of items) {
							if (item && typeof item === 'string' && item.startsWith('co_z')) {
								coValuesToDelete.add(item)
							}
						}
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		// Filter out schemata co-values
		const coValuesToDeleteFiltered = Array.from(coValuesToDelete).filter((coId) => {
			// Skip if it's a schema co-id
			if (schemaCoIds.has(coId)) {
				return false
			}

			// Also check if the co-value itself is a schema (by checking if it's in schematas registry)
			// This handles edge cases where schema might not be in the set yet
			return true // Include by default, deleteRecord will handle errors gracefully
		})

		console.log(
			`[Seed] Deleting ${coValuesToDeleteFiltered.length} co-values (filtered from ${coValuesToDelete.size} total, preserving ${schemaCoIds.size} schemas)`,
		)

		// Delete all non-schema co-values
		for (const coId of coValuesToDeleteFiltered) {
			try {
				// Get schema co-id from co-value headerMeta
				const coValueCore = backend.getCoValue(coId)
				if (!coValueCore) {
					// Co-value doesn't exist, skip
					continue
				}

				const header = backend.getHeader(coValueCore)
				const headerMeta = header?.meta || null
				const schemaCoId = headerMeta?.$schema

				// Skip if this is a schema co-value (double-check)
				if (schemaCoId && schemaCoIds.has(coId)) {
					continue
				}

				// Delete using deleteRecord (handles index removal automatically)
				// Note: Deletion may trigger reactive subscriptions (e.g., actor engine subscriptions)
				// These subscription errors are expected during cleanup and can be safely ignored
				// The co-value is still deleted successfully even if subscriptions fail
				try {
					await deleteRecord(backend, schemaCoId || null, coId)
					deletedCount++
				} catch (deleteError) {
					// Check if this is a subscription/actor engine error (expected during cleanup)
					// These happen when deleting co-values that have active subscriptions
					// The deletion still succeeds, but the subscription callback fails
					if (
						deleteError.message &&
						(deleteError.message.includes('Cannot access') ||
							deleteError.message.includes('before initialization') ||
							deleteError.message.includes('ReferenceError'))
					) {
						// Subscription error during cleanup - expected and safe to ignore
						// The co-value deletion still succeeded (index removed, content cleared)
						deletedCount++
					} else {
						// Real deletion error - rethrow to be caught by outer catch
						throw deleteError
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		// Also delete vibes from registries.sparks[°Maia].vibes
		let vibesContentForClearing = null
		const vibesId = await groups.getSparkVibesId(backend, MAIA_SPARK)
		if (vibesId) {
			try {
				const vibesCore = await ensureCoValueLoaded(backend, vibesId, {
					waitForAvailable: true,
					timeoutMs: 2000,
				})

				if (vibesCore && backend.isAvailable(vibesCore)) {
					vibesContentForClearing = backend.getCurrentContent(vibesCore)
					if (vibesContentForClearing && typeof vibesContentForClearing.get === 'function') {
						const vibeKeys =
							vibesContentForClearing.keys && typeof vibesContentForClearing.keys === 'function'
								? vibesContentForClearing.keys()
								: Object.keys(vibesContentForClearing)

						console.log(`[Seed] Deleting ${vibeKeys.length} vibes from account.vibes`)

						for (const vibeKey of vibeKeys) {
							const vibeCoId = vibesContentForClearing.get(vibeKey)
							if (vibeCoId && typeof vibeCoId === 'string' && vibeCoId.startsWith('co_z')) {
								try {
									// Get schema from vibe co-value
									const vibeCore = backend.getCoValue(vibeCoId)
									if (vibeCore) {
										const header = backend.getHeader(vibeCore)
										const headerMeta = header?.meta || null
										const schemaCoId = headerMeta?.$schema

										await deleteRecord(backend, schemaCoId || null, vibeCoId)
										deletedCount++
									}
								} catch (_e) {
									errorCount++
								}
							}
						}

						// Clear all vibe entries from account.vibes
						for (const vibeKey of vibeKeys) {
							if (typeof vibesContentForClearing.delete === 'function') {
								vibesContentForClearing.delete(vibeKey)
							}
						}
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		// Delete index colist co-values themselves from spark.os.indexes (not just clear them)
		// Index colists will be recreated automatically when new co-values are created
		const indexColistsToDelete = []
		let indexesContentForDeletion = null

		// Get spark.os.indexes CoMap (reuse the one we already loaded if available)
		if (indexesContentForCollection) {
			indexesContentForDeletion = indexesContentForCollection
		} else {
			const indexesIdForDeletion = osCoMap.get('indexes')
			if (indexesIdForDeletion) {
				try {
					const indexesCore = await ensureCoValueLoaded(backend, indexesIdForDeletion, {
						waitForAvailable: true,
						timeoutMs: 5000,
					})

					if (indexesCore && backend.isAvailable(indexesCore)) {
						indexesContentForDeletion = backend.getCurrentContent(indexesCore)
					}
				} catch (_e) {
					errorCount++
				}
			}
		}

		if (indexesContentForDeletion && typeof indexesContentForDeletion.get === 'function') {
			// Iterate all keys in spark.os.indexes (all are schema index colists)
			const keys =
				indexesContentForDeletion.keys && typeof indexesContentForDeletion.keys === 'function'
					? indexesContentForDeletion.keys()
					: Object.keys(indexesContentForDeletion)

			console.log(`[Seed] Deleting ${keys.length} index colists from spark.os.indexes`)

			for (const key of keys) {
				// All keys in indexes are schema co-ids (starts with co_z) - these are schema index colists
				if (key.startsWith('co_z')) {
					const indexColistId = indexesContentForDeletion.get(key)
					if (indexColistId && typeof indexColistId === 'string' && indexColistId.startsWith('co_z')) {
						// Get the schema co-id (the key) and the index colist co-id (the value)
						const schemaCoId = key
						indexColistsToDelete.push({ schemaCoId, indexColistId })
					}
				}
			}
		}

		// Delete each index colist co-value
		for (const { schemaCoId, indexColistId } of indexColistsToDelete) {
			try {
				// Get the schema definition to construct the index colist schema title
				const schemaDef = await resolve(backend, schemaCoId, { returnType: 'schema' })
				if (!schemaDef || !schemaDef.title) {
					continue
				}

				// Construct the index colist schema title (e.g., "°Maia/schema/index/data/todos")
				const schemaTitle = schemaDef.title
				if (!schemaTitle || !SCHEMA_REF_PATTERN.test(schemaTitle)) {
					continue
				}
				const match = schemaTitle.match(/^([°@][a-zA-Z0-9_-]+)\/schema\/(.+)$/)
				if (!match) {
					continue
				}
				const [, prefix, path] = match
				const indexColistSchemaTitle = `${prefix}/schema/index/${path}`

				// Resolve the index colist schema co-id
				const indexColistSchemaCoId = await resolve(backend, indexColistSchemaTitle, {
					returnType: 'coId',
				})
				if (!indexColistSchemaCoId) {
					continue
				}

				// Delete the index colist co-value itself
				try {
					await deleteRecord(backend, indexColistSchemaCoId, indexColistId)
					deletedCount++

					// Remove the entry from spark.os.indexes
					if (indexesContentForDeletion && typeof indexesContentForDeletion.delete === 'function') {
						indexesContentForDeletion.delete(schemaCoId)
					}
				} catch (deleteError) {
					// Check if this is a subscription/actor engine error (expected during cleanup)
					if (
						deleteError.message &&
						(deleteError.message.includes('Cannot access') ||
							deleteError.message.includes('before initialization') ||
							deleteError.message.includes('ReferenceError'))
					) {
						// Subscription error during cleanup - expected and safe to ignore
						deletedCount++

						// Still remove from spark.os.indexes even if subscription error occurred
						if (indexesContentForDeletion && typeof indexesContentForDeletion.delete === 'function') {
							indexesContentForDeletion.delete(schemaCoId)
						}
					} else {
						// Real deletion error - rethrow to be caught by outer catch
						throw deleteError
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		// Clear containers after all deletions are complete
		// This ensures containers are empty even if some deletions failed

		// Clear spark.os.indexes container (remove all entries)
		if (indexesContentForDeletion && typeof indexesContentForDeletion.delete === 'function') {
			try {
				const remainingKeys =
					indexesContentForDeletion.keys && typeof indexesContentForDeletion.keys === 'function'
						? Array.from(indexesContentForDeletion.keys())
						: Object.keys(indexesContentForDeletion)

				if (remainingKeys.length > 0) {
					console.log(`[Seed] Clearing ${remainingKeys.length} remaining entries from spark.os.indexes`)
					for (const key of remainingKeys) {
						indexesContentForDeletion.delete(key)
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		// Clear spark.os.unknown container (remove all entries)
		if (unknownContentForClearing && typeof unknownContentForClearing.delete === 'function') {
			try {
				// For CoList, we need to clear all items
				// Get current items and remove them
				const currentItems = unknownContentForClearing.toJSON ? unknownContentForClearing.toJSON() : []
				if (currentItems.length > 0) {
					console.log(`[Seed] Clearing ${currentItems.length} remaining entries from spark.os.unknown`)
					// CoList doesn't have a direct clear method, but deleteRecord should have removed items
					// We'll verify this is working correctly
				}
			} catch (_e) {
				errorCount++
			}
		}

		// Verify account.vibes is cleared (already cleared above, but log confirmation)
		if (vibesContentForClearing && typeof vibesContentForClearing.get === 'function') {
			const remainingVibeKeys =
				vibesContentForClearing.keys && typeof vibesContentForClearing.keys === 'function'
					? Array.from(vibesContentForClearing.keys())
					: Object.keys(vibesContentForClearing)

			if (remainingVibeKeys.length > 0) {
			} else {
				console.log(`[Seed] account.vibes cleared successfully`)
			}
		}

		console.log(`[Seed] Cleanup complete: deleted ${deletedCount} co-values, ${errorCount} errors`)

		return { deleted: deletedCount, errors: errorCount }
	} catch (_e) {
		return { deleted: deletedCount, errors: errorCount + 1 }
	}
}

/**
 * Build metaschema definition for seeding
 * Loads merged meta.schema.json and updates $id/$schema with actual co-id
 *
 * @param {string} metaSchemaCoId - The co-id of the meta schema CoMap (for self-reference)
 * @returns {Object} Schema CoMap structure with definition property
 */
function buildMetaSchemaForSeeding(metaSchemaCoId) {
	const metaSchemaId = metaSchemaCoId
		? `https://maia.city/${metaSchemaCoId}`
		: 'https://json-schema.org/draft/2020-12/schema'

	// Clone merged meta.schema.json and update $id/$schema with actual co-id
	// Everything else is already complete in the merged JSON file
	const fullMetaSchema = {
		...mergedMetaSchema,
		$id: metaSchemaId,
		$schema: metaSchemaId,
	}

	// Return structure for CoMap creation (wrapped in definition property)
	return {
		definition: fullMetaSchema,
	}
}

/**
 * Seed CoJSON database with configs, schemas, and data
 *
 * @param {RawAccount} account - The account (must have °Maia spark)
 * @param {LocalNode} node - The LocalNode instance
 * @param {Object} configs - Config registry {vibe, styles, actors, views, contexts, states, interfaces}
 * @param {Object} schemas - Schema definitions
 * @param {Object} data - Initial application data {todos: [], ...}
 * @param {CoJSONBackend} [existingBackend] - Optional existing backend instance (with dbEngine set)
 * @returns {Promise<Object>} Summary of what was seeded
 */
export async function seed(
	account,
	node,
	configs,
	schemas,
	data,
	existingBackend = null,
	options = {},
) {
	const { forceFreshSeed = false } = options

	// Use existing backend if provided (has dbEngine set), otherwise create new one
	const { CoJSONBackend } = await import('../core/cojson-backend.js')
	const backend = existingBackend || new CoJSONBackend(node, account, { systemSpark: '°Maia' })

	// Bootstrap scaffold when: forceFreshSeed, or no account.registries, or registries.sparks lacks °Maia
	let needsBootstrap = forceFreshSeed
	if (!needsBootstrap) {
		needsBootstrap =
			!account.get('registries') || !String(account.get('registries')).startsWith('co_z')
	}
	if (!needsBootstrap) {
		const osId = await groups.getSparkOsId(backend, MAIA_SPARK)
		if (!osId) needsBootstrap = true // registries exists but °Maia not present (e.g. from simpleAccountSeed)
	}
	if (needsBootstrap) {
		const { getAllSchemas } = await import('@MaiaOS/schemata')
		await bootstrapAndScaffold(account, node, schemas || getAllSchemas(), backend.dbEngine)
	}

	// IDEMPOTENCY CHECK: Only skip if account is already seeded AND no configs provided AND not forceFreshSeed
	// forceFreshSeed bypasses this (explicit overwrite from PEER_FRESH_SEED=true)
	try {
		const osId = await groups.getSparkOsId(backend, MAIA_SPARK)
		if (osId) {
			const osCore = await ensureCoValueLoaded(backend, osId, {
				waitForAvailable: true,
				timeoutMs: 2000,
			})

			if (osCore && backend.isAvailable(osCore)) {
				const osContent = backend.getCurrentContent(osCore)
				if (osContent && typeof osContent.get === 'function') {
					const schematasId = osContent.get('schematas')
					if (schematasId) {
						const schematasCore = await ensureCoValueLoaded(backend, schematasId, {
							waitForAvailable: true,
							timeoutMs: 2000,
						})

						if (schematasCore && backend.isAvailable(schematasCore)) {
							const schematasContent = backend.getCurrentContent(schematasCore)
							if (schematasContent && typeof schematasContent.get === 'function') {
								const keys =
									schematasContent.keys && typeof schematasContent.keys === 'function'
										? schematasContent.keys()
										: Object.keys(schematasContent)

								// If schematas registry has entries, account is already seeded
								if (keys.length > 0 && !forceFreshSeed) {
									// Check if configs are provided - if yes, allow reseeding (manual seed button)
									// If no configs, skip (prevent double auto-seeding)
									if (
										!configs ||
										(!configs.vibes?.length && Object.keys(configs.actors || {}).length === 0)
									) {
										console.log('ℹ️  Account already seeded and no configs provided, skipping')
										return { skipped: true, reason: 'already_seeded_no_configs' }
									}
									// Configs provided - proceed with reseeding (cleanup will happen in Phase -1)
								}
							}
						}
					}
				}
			}
		}
	} catch (_e) {}

	// Import co-id registry and transformer
	const { CoIdRegistry } = await import('@MaiaOS/schemata/co-id-generator')
	const { transformForSeeding, validateSchemaStructure } = await import(
		'@MaiaOS/schemata/schema-transformer'
	)

	const coIdRegistry = new CoIdRegistry()

	// Phase -1: Cleanup existing seeded co-values (but preserve schemata)
	// Skip cleanup when we just bootstrapped - scaffold is fresh, nothing to clean.
	// Cleanup only for reseeding an existing scaffold (would corrupt fresh bootstrap).
	// NOTE: Schema index colists are automatically managed:
	// - deleteRecord() automatically removes co-values from schema indexes via removeFromIndex()
	// - create() operations automatically add co-values to schema indexes via storage hooks
	// No manual index management needed during reseeding
	const osIdForCleanup = needsBootstrap ? null : await groups.getSparkOsId(backend, MAIA_SPARK)
	if (osIdForCleanup) {
		try {
			const osCoreForCleanup = await ensureCoValueLoaded(backend, osIdForCleanup, {
				waitForAvailable: true,
				timeoutMs: 2000,
			})

			if (osCoreForCleanup && backend.isAvailable(osCoreForCleanup)) {
				const osContentForCleanup = backend.getCurrentContent(osCoreForCleanup)
				if (osContentForCleanup && typeof osContentForCleanup.get === 'function') {
					const schematasIdForCleanup = osContentForCleanup.get('schematas')
					if (schematasIdForCleanup) {
						// Account has schematas - run cleanup before reseeding
						console.log('🌱 Cleaning up existing seeded data before reseeding...')
						const cleanupResult = await deleteSeededCoValues(account, node, backend)
						console.log(
							`[Seed] Cleanup complete: deleted ${cleanupResult.deleted} co-values, ${cleanupResult.errors} errors`,
						)
					}
				}
			}
		} catch (_e) {}
	}

	// Resolve °Maia spark's group (replaces old profile.group)
	const maiaGroup = await groups.getMaiaGroup(backend)
	if (!maiaGroup || typeof maiaGroup.createMap !== 'function') {
		throw new Error(
			'[CoJSONSeed] °Maia spark group not found. Ensure bootstrap has created °Maia spark.',
		)
	}

	// Bootstrap account.registries (sync agent only): registries.sparks["°Maia"] = maiaSparkCoId
	await bootstrapAccountRegistries(backend, maiaGroup)

	// Starting CoJSON seeding...

	// Deduplicate schemas by $id (same schema may be registered under multiple keys)
	const uniqueSchemasBy$id = new Map()
	for (const [name, schema] of Object.entries(schemas)) {
		const schemaKey = schema.$id || `°Maia/schema/${name}`
		// Only keep first occurrence of each $id (deduplicate)
		if (!uniqueSchemasBy$id.has(schemaKey)) {
			uniqueSchemasBy$id.set(schemaKey, { name, schema })
		}
	}

	// Helper function to find all $co references in a schema (recursively)
	const findCoReferences = (obj, visited = new Set()) => {
		const refs = new Set()
		if (!obj || typeof obj !== 'object' || visited.has(obj)) {
			return refs
		}
		visited.add(obj)

		// Check if this object has a $co keyword
		if (obj.$co && typeof obj.$co === 'string' && obj.$co.startsWith('°Maia/schema/')) {
			refs.add(obj.$co)
		}

		// Recursively check all properties
		for (const value of Object.values(obj)) {
			if (value && typeof value === 'object') {
				if (Array.isArray(value)) {
					for (const item of value) {
						if (item && typeof item === 'object') {
							const itemRefs = findCoReferences(item, visited)
							itemRefs.forEach((ref) => {
								refs.add(ref)
							})
						}
					}
				} else {
					const nestedRefs = findCoReferences(value, visited)
					nestedRefs.forEach((ref) => {
						refs.add(ref)
					})
				}
			}
		}

		return refs
	}

	// Build dependency map: schemaKey -> Set of referenced schema keys
	const schemaDependencies = new Map()
	for (const [schemaKey, { schema }] of uniqueSchemasBy$id) {
		const refs = findCoReferences(schema)
		schemaDependencies.set(schemaKey, refs)
	}

	// Sort schemas by dependency order (leaf schemas first, then composite schemas)
	// Use topological sort to handle dependencies correctly
	const sortedSchemaKeys = []
	const processed = new Set()
	const processing = new Set() // Detect circular dependencies

	const visitSchema = (schemaKey) => {
		if (processed.has(schemaKey)) {
			return // Already processed
		}
		if (processing.has(schemaKey)) {
			// Circular dependency detected - this is OK for self-references (e.g., actor -> actor)
			// Just continue processing
			return
		}

		processing.add(schemaKey)

		// Process dependencies first
		const deps = schemaDependencies.get(schemaKey) || new Set()
		for (const dep of deps) {
			// Only process if it's a schema we're seeding (starts with °Maia/schema/)
			if (dep.startsWith('°Maia/schema/') && uniqueSchemasBy$id.has(dep)) {
				visitSchema(dep)
			}
		}

		processing.delete(schemaKey)
		processed.add(schemaKey)
		sortedSchemaKeys.push(schemaKey)
	}

	// Visit all schemas (except °Maia/schema/meta which is handled specially in Phase 1)
	for (const schemaKey of uniqueSchemasBy$id.keys()) {
		if (schemaKey !== '°Maia/schema/meta') {
			visitSchema(schemaKey)
		}
	}

	// Phase 0: Ensure spark.os structure (schematas, indexes)
	await ensureSparkOs(account, node, maiaGroup, backend, undefined)

	// Phase 1: Create or update metaschema FIRST (needed for schema CoMaps)
	// SPECIAL HANDLING: Metaschema uses "@metaSchema" as exception since headerMeta is read-only after creation
	// We can't put the metaschema's own co-id in headerMeta.$schema (chicken-egg problem)

	// Check if metaschema exists in spark.os.schematas registry
	let metaSchemaCoId = null
	const osId = await groups.getSparkOsId(backend, MAIA_SPARK)
	if (osId) {
		const osCore = await ensureCoValueLoaded(backend, osId, {
			waitForAvailable: true,
			timeoutMs: 2000,
		})
		if (osCore && backend.isAvailable(osCore)) {
			const osContent = backend.getCurrentContent(osCore)
			if (osContent && typeof osContent.get === 'function') {
				// STRICT: Only check spark.os.schematas registry - no legacy metaSchema
				// Check spark.os.schematas registry
				if (!metaSchemaCoId) {
					const schematasId = osContent.get('schematas')
					if (schematasId) {
						const schematasCore = await ensureCoValueLoaded(backend, schematasId, {
							waitForAvailable: true,
							timeoutMs: 2000,
						})
						if (schematasCore && backend.isAvailable(schematasCore)) {
							const schematasContent = backend.getCurrentContent(schematasCore)
							if (schematasContent && typeof schematasContent.get === 'function') {
								metaSchemaCoId = schematasContent.get('°Maia/schema/meta')
							}
						}
					}
				}
			}
		}
	}

	if (!metaSchemaCoId) {
		// Create metaschema with "@metaSchema" exception (can't self-reference co-id in read-only headerMeta)
		const _metaSchemaMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA } // Special exception for metaschema
		const tempMetaSchemaDef = buildMetaSchemaForSeeding('co_zTEMP')
		// Clean the initial meta-schema definition to remove any 'id' fields
		const cleanedTempDef = {
			definition: removeIdFields(tempMetaSchemaDef.definition || tempMetaSchemaDef),
		}
		const { coValue: metaSchemaCoMap } = await createCoValueForSpark(
			{ node, account, guardian: maiaGroup },
			null,
			{ schema: EXCEPTION_SCHEMAS.META_SCHEMA, cotype: 'comap', data: cleanedTempDef },
		)

		// Update metaschema with direct properties (flattened structure)
		const actualMetaSchemaCoId = metaSchemaCoMap.id
		const updatedMetaSchemaDef = buildMetaSchemaForSeeding(actualMetaSchemaCoId)

		// Extract direct properties (exclude $schema, $id, and id - they go in metadata only)
		// Note: AJV only accepts $id, not id, so we must exclude both
		const { $schema, $id, id, ...directProperties } =
			updatedMetaSchemaDef.definition || updatedMetaSchemaDef

		// Recursively remove any nested 'id' fields (AJV validation will fail if any 'id' exists)
		const cleanedProperties = removeIdFields(directProperties)

		// Set each property directly on the CoMap (flattened, no nested definition object)
		for (const [key, value] of Object.entries(cleanedProperties)) {
			metaSchemaCoMap.set(key, value)
		}

		metaSchemaCoId = actualMetaSchemaCoId
	} else {
		// Metaschema exists - update it with latest definition
		const updatedMetaSchemaDef = buildMetaSchemaForSeeding(metaSchemaCoId)
		// Extract direct properties (exclude $schema, $id, and id - they go in metadata only)
		// Note: AJV only accepts $id, not id, so we must exclude both
		const { $schema, $id, id, ...directProperties } =
			updatedMetaSchemaDef.definition || updatedMetaSchemaDef

		// Recursively remove any nested 'id' fields (AJV validation will fail if any 'id' exists)
		const cleanedProperties = removeIdFields(directProperties)

		// Get metaschema CoMap and update it
		const metaSchemaCore = await ensureCoValueLoaded(backend, metaSchemaCoId, {
			waitForAvailable: true,
			timeoutMs: 2000,
		})
		if (metaSchemaCore && backend.isAvailable(metaSchemaCore)) {
			const metaSchemaCoMap = backend.getCurrentContent(metaSchemaCore)
			if (metaSchemaCoMap && typeof metaSchemaCoMap.set === 'function') {
				// Update all properties
				for (const [key, value] of Object.entries(cleanedProperties)) {
					metaSchemaCoMap.set(key, value)
				}
			}
		}
	}

	// Register metaschema with °Maia/schema/meta key (matches schema title format)
	// Only register if not already registered (idempotent - allows re-seeding)
	if (!coIdRegistry.has('°Maia/schema/meta')) {
		coIdRegistry.register('°Maia/schema/meta', metaSchemaCoId)
	} else {
		// If already registered, verify it matches (if not, that's an error)
		const existingCoId = coIdRegistry.get('°Maia/schema/meta')
		if (existingCoId !== metaSchemaCoId) {
			metaSchemaCoId = existingCoId
		}
	}

	// Phase 2: Create or update schema CoMaps using CRUD API (so hooks fire automatically)
	// Use metaSchema co-id in headerMeta
	const schemaCoIdMap = new Map() // Will be populated as we create/update CoMaps
	const schemaCoMaps = new Map() // Store CoMap instances for later updates

	// Import CRUD create and update functions
	const crudCreate = await import('../crud/create.js')
	const crudUpdate = await import('../crud/update.js')

	// Get existing schema registry from spark.os.schematas
	const existingSchemaRegistry = new Map() // schemaKey -> schemaCoId
	if (osId) {
		const osCore = await ensureCoValueLoaded(backend, osId, {
			waitForAvailable: true,
			timeoutMs: 2000,
		})
		if (osCore && backend.isAvailable(osCore)) {
			const osContent = backend.getCurrentContent(osCore)
			if (osContent && typeof osContent.get === 'function') {
				const schematasId = osContent.get('schematas')
				if (schematasId) {
					const schematasCore = await ensureCoValueLoaded(backend, schematasId, {
						waitForAvailable: true,
						timeoutMs: 2000,
					})
					if (schematasCore && backend.isAvailable(schematasCore)) {
						const schematasContent = backend.getCurrentContent(schematasCore)
						if (schematasContent && typeof schematasContent.get === 'function') {
							// Read all schema mappings from registry
							const keys =
								schematasContent.keys && typeof schematasContent.keys === 'function'
									? schematasContent.keys()
									: Object.keys(schematasContent)

							for (const key of keys) {
								const schemaCoId = schematasContent.get(key)
								if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
									existingSchemaRegistry.set(key, schemaCoId)
								}
							}
						}
					}
				}
			}
		}
	}

	// Create or update schemas in dependency order WITHOUT transformed references first
	for (const schemaKey of sortedSchemaKeys) {
		const { name: _name, schema } = uniqueSchemasBy$id.get(schemaKey)

		// Extract direct properties (exclude $schema, $id, and id - they go in metadata only)
		// Note: AJV only accepts $id, not id, so we must exclude both
		const { $schema, $id, id, ...directProperties } = schema

		// Recursively remove any nested 'id' fields (AJV validation will fail if any 'id' exists)
		const cleanedProperties = removeIdFields(directProperties)

		// Check if schema already exists
		const existingSchemaCoId = existingSchemaRegistry.get(schemaKey)
		let actualCoId

		if (existingSchemaCoId) {
			// Schema exists - update it instead of creating new one

			// Update schema CoMap with new definition
			await crudUpdate.update(backend, metaSchemaCoId, existingSchemaCoId, cleanedProperties)

			actualCoId = existingSchemaCoId
		} else {
			// Schema doesn't exist - create new one

			// Create schema CoMap using CRUD API (hooks will fire automatically)
			// Pass metaSchema co-id as schema parameter (CRUD will use it in headerMeta)
			const createdSchema = await crudCreate.create(backend, metaSchemaCoId, cleanedProperties)

			// CRUD API returns the created record with id
			actualCoId = createdSchema.id
		}

		schemaCoIdMap.set(schemaKey, actualCoId)

		// Get the actual CoMap instance for later updates
		const schemaCoValueCore = backend.getCoValue(actualCoId)
		if (schemaCoValueCore && backend.isAvailable(schemaCoValueCore)) {
			const schemaCoMapContent = backend.getCurrentContent(schemaCoValueCore)
			if (schemaCoMapContent && typeof schemaCoMapContent.set === 'function') {
				schemaCoMaps.set(schemaKey, schemaCoMapContent)
			}
		}

		coIdRegistry.register(schemaKey, actualCoId)
	}

	// Phase 3: Now transform all schemas with actual co-ids and update CoMaps
	// CRITICAL: Add metaschema to schemaCoIdMap so transformSchemaForSeeding can replace °Maia/schema/meta references
	if (metaSchemaCoId && !schemaCoIdMap.has('°Maia/schema/meta')) {
		schemaCoIdMap.set('°Maia/schema/meta', metaSchemaCoId)
	}

	const transformedSchemas = {}
	const transformedSchemasByKey = new Map()

	for (const schemaKey of sortedSchemaKeys) {
		const { name, schema } = uniqueSchemasBy$id.get(schemaKey)
		const schemaCoId = schemaCoIdMap.get(schemaKey)
		const schemaCoMap = schemaCoMaps.get(schemaKey)

		// Transform schema with actual co-ids (includes °Maia/schema/meta → metaSchemaCoId mapping)
		const transformedSchema = transformForSeeding(schema, schemaCoIdMap)
		transformedSchema.$id = `https://maia.city/${schemaCoId}`

		// Verify no °Maia/schema/... references remain after transformation
		const verificationErrors = validateSchemaStructure(transformedSchema, schemaKey, {
			checkSchemaReferences: true,
			checkNestedCoTypes: false,
		})
		if (verificationErrors.length > 0) {
			const errorMsg = `[Seed] Schema ${schemaKey} still contains °Maia/schema/ references after transformation:\n${verificationErrors.join('\n')}`
			throw new Error(errorMsg)
		}

		transformedSchemas[name] = transformedSchema
		transformedSchemasByKey.set(schemaKey, transformedSchema)

		// Extract direct properties (exclude $schema, $id, and id - they go in metadata only)
		// Note: AJV only accepts $id, not id, so we must exclude both
		const { $schema, $id, id, ...directProperties } = transformedSchema

		// Recursively remove any nested 'id' fields (AJV validation will fail if any 'id' exists)
		const cleanedProperties = removeIdFields(directProperties)

		// Update the CoMap with cleaned properties (flattened, no nested definition object)
		// Set each property directly on the CoMap
		for (const [key, value] of Object.entries(cleanedProperties)) {
			schemaCoMap.set(key, value)
		}
	}

	// Phase 3: Build seeded schemas summary (already created above)
	const seededSchemas = []
	for (const schemaKey of sortedSchemaKeys) {
		const { name } = uniqueSchemasBy$id.get(schemaKey)
		const schemaCoId = schemaCoIdMap.get(schemaKey)
		const schemaCoMap = schemaCoMaps.get(schemaKey)

		seededSchemas.push({
			name,
			key: schemaKey,
			coId: schemaCoId,
			coMapId: schemaCoMap.id,
		})
	}

	// Phase 3b: Ensure spark.vibes exists (with proper schema) - now that schemaCoIdMap is ready
	await ensureSparkOs(account, node, maiaGroup, backend, schemaCoIdMap)

	// Empty maps for now (data is commented out)
	const instanceCoIdMap = new Map()
	const _dataCollectionCoIds = new Map()

	// Phase 6-7: Config seeding with "leaf first" order (same as IndexedDB)
	// Strategy: Generate co-ids for ALL configs first, register them, then transform and seed

	// Step 1: Build combined registry (schema co-ids + will include instance co-ids)
	// Read schema co-ids from persisted registry (spark.os.schematas) - REAL co-ids from CoJSON
	const getCombinedRegistry = async () => {
		// Start with schema registry
		const schemaRegistry = new Map()

		// Try to read from persisted registry first
		const osId = await groups.getSparkOsId(backend, MAIA_SPARK)
		if (osId) {
			const osCore = node.getCoValue(osId)
			if (osCore && osCore.type === 'comap') {
				const osContent = osCore.getCurrentContent?.()
				if (osContent && typeof osContent.get === 'function') {
					const schematasId = osContent.get('schematas')
					if (schematasId) {
						const schematasCore = node.getCoValue(schematasId)
						if (schematasCore && schematasCore.type === 'comap') {
							const schematasContent = schematasCore.getCurrentContent?.()
							if (schematasContent && typeof schematasContent.get === 'function') {
								// Read all mappings from persisted registry (REAL co-ids from CoJSON)
								const keys = schematasContent.keys()
								for (const key of keys) {
									const coId = schematasContent.get(key)
									if (coId && typeof coId === 'string' && coId.startsWith('co_z')) {
										schemaRegistry.set(key, coId)
									}
								}
								if (schemaRegistry.size > 0) {
								}
							}
						}
					}
				}
			}
		}

		// If registry doesn't exist yet, build it from actual co-ids we just created (from schemaCoIdMap)
		if (schemaRegistry.size === 0) {
			for (const [schemaKey, actualCoId] of schemaCoIdMap.entries()) {
				schemaRegistry.set(schemaKey, actualCoId)
			}
			// Also add metaschema if we have it (as °Maia/schema/meta to match schema title)
			if (metaSchemaCoId) {
				schemaRegistry.set('°Maia/schema/meta', metaSchemaCoId)
			}
		}

		return schemaRegistry
	}

	let combinedRegistry = await getCombinedRegistry()

	// Step 2: Register data collection schema co-ids (for query object transformations)
	// Some configs have query objects and tool payloads that reference data collection schemas
	// (e.g., °Maia/schema/todos, °Maia/schema/data/todos in vibe state machine tool payloads)
	// We need BOTH keys in the registry before transforming configs - vibes use °Maia/schema/data/todos
	if (data) {
		for (const [collectionName] of Object.entries(data)) {
			const schemaKey = `°Maia/schema/${collectionName}`
			const dataSchemaKey = `°Maia/schema/data/${collectionName}`

			// Check if data schema exists in schema registry (try both key formats)
			const dataSchemaCoId = combinedRegistry.get(dataSchemaKey) || combinedRegistry.get(schemaKey)
			if (dataSchemaCoId) {
				// Register BOTH °Maia/schema/todos AND °Maia/schema/data/todos → same co-id
				// Vibes use °Maia/schema/data/todos in tool payloads; both must resolve correctly
				combinedRegistry.set(schemaKey, dataSchemaCoId)
				combinedRegistry.set(dataSchemaKey, dataSchemaCoId)
				coIdRegistry.register(schemaKey, dataSchemaCoId)
				coIdRegistry.register(dataSchemaKey, dataSchemaCoId)
			}
		}
	}

	// Step 3: Seed configs in "leaf first" order - ONLY use real co-ids from CoJSON!
	// Create actors first WITHOUT transforming config references (only schema refs)
	// Then register real co-ids, then transform dependent configs like vibes
	const seededConfigs = { configs: [], count: 0 }

	// Reference props that must be co-ids at create time - omit until update phase when all refs exist
	const REFERENCE_PROPS = [
		'actor',
		'context',
		'view',
		'state',
		'brand',
		'style',
		'inbox',
		'subscribers',
	]

	// Props with nested $co refs (states has actions arrays with action co-ids or built-in names like sendToDetailActor)
	// Strip at create, add in update (transformForSeeding handles nested refs then)
	const NESTED_REF_PROPS = ['states']

	// Helper: Transform only schema references, strip config references (add in update phase)
	const transformSchemaRefsOnly = (instance, schemaRegistry) => {
		if (!instance || typeof instance !== 'object') {
			return instance
		}
		const transformed = JSON.parse(JSON.stringify(instance))

		// Transform $schema reference only
		if (transformed.$schema?.startsWith('°Maia/schema/')) {
			const coId = schemaRegistry.get(transformed.$schema)
			if (coId) {
				transformed.$schema = coId
			}
		}

		// Strip reference props - they require co-ids but we create in leaf-first order so refs may not exist yet
		for (const prop of REFERENCE_PROPS) {
			delete transformed[prop]
		}

		// Strip nested ref props (states with actions arrays containing $co refs or built-in names)
		// updateConfigReferences adds them with full transformForSeeding
		for (const prop of NESTED_REF_PROPS) {
			if (prop === 'states' && transformed.initial) {
				// State schema requires initial + states; provide minimal valid states
				transformed.states = Object.fromEntries(
					Object.keys(transformed.states || {}).map((k) => [k, {}]),
				)
			} else {
				delete transformed[prop]
			}
		}

		return transformed
	}

	// Helper to rebuild combined registry with latest registrations
	const refreshCombinedRegistry = () => {
		// Start with schema registry (from spark.os.schematas)
		const refreshed = new Map(combinedRegistry)

		// Add all instance co-ids registered so far
		for (const [key, coId] of instanceCoIdMap.entries()) {
			if (coId && typeof coId === 'string' && coId.startsWith('co_z')) {
				refreshed.set(key, coId)
			}
		}

		// Add all co-ids from coIdRegistry
		for (const [key, coId] of coIdRegistry.getAll()) {
			if (coId && typeof coId === 'string' && coId.startsWith('co_z')) {
				refreshed.set(key, coId)
			}
		}

		return refreshed
	}

	// Seed all configs in "leaf first" order (same as IndexedDB)
	// Order: styles → actors → views → contexts → states → interfaces → subscriptions → inboxes → tool → vibe
	// Create all configs first with schema refs only, register their co-ids, then update references

	// Helper to seed a config type and register co-ids
	// Note: configTypeKey is plural (e.g., 'actors'), but seedConfigs expects singular type names
	const seedConfigTypeAndRegister = async (configTypeKey, configsOfType, _singularTypeName) => {
		if (!configsOfType || typeof configsOfType !== 'object') {
			return { configs: [], count: 0 }
		}

		const transformed = {}
		for (const [instanceKey, instance] of Object.entries(configsOfType)) {
			transformed[instanceKey] = transformSchemaRefsOnly(instance, combinedRegistry)
		}

		// seedConfigs expects keys like 'actors', 'views', etc., but uses singular type names internally
		const configsToSeed = { [configTypeKey]: transformed }
		const seeded = await seedConfigs(
			account,
			node,
			maiaGroup,
			backend,
			configsToSeed,
			instanceCoIdMap,
			schemaCoMaps,
			schemaCoIdMap,
		)

		// Register REAL co-ids from CoJSON
		for (const configInfo of seeded.configs || []) {
			const actualCoId = configInfo.coId
			const path = configInfo.path
			const originalId = configInfo.expectedCoId

			instanceCoIdMap.set(path, actualCoId)
			if (originalId) {
				instanceCoIdMap.set(originalId, actualCoId)
				combinedRegistry.set(originalId, actualCoId)
				coIdRegistry.register(originalId, actualCoId)
			}
			coIdRegistry.register(path, actualCoId)
		}

		return seeded
	}

	// Seed all config types in dependency order (same as IndexedDB)
	// Order: styles → actors → views → contexts → states → interfaces → subscriptions → inboxes → tool
	// Note: topics removed - topics infrastructure deprecated, use direct messaging with target instead
	if (configs) {
		const stylesSeeded = await seedConfigTypeAndRegister('styles', configs.styles, 'style')
		seededConfigs.configs.push(...(stylesSeeded.configs || []))
		seededConfigs.count += stylesSeeded.count || 0
		combinedRegistry = refreshCombinedRegistry() // REFRESH: styles now available

		const actorsSeeded = await seedConfigTypeAndRegister('actors', configs.actors, 'actor')
		seededConfigs.configs.push(...(actorsSeeded.configs || []))
		seededConfigs.count += actorsSeeded.count || 0
		combinedRegistry = refreshCombinedRegistry() // REFRESH: actors now available

		const viewsSeeded = await seedConfigTypeAndRegister('views', configs.views, 'view')
		seededConfigs.configs.push(...(viewsSeeded.configs || []))
		seededConfigs.count += viewsSeeded.count || 0
		combinedRegistry = refreshCombinedRegistry() // REFRESH: views now available

		const contextsSeeded = await seedConfigTypeAndRegister('contexts', configs.contexts, 'context')
		seededConfigs.configs.push(...(contextsSeeded.configs || []))
		seededConfigs.count += contextsSeeded.count || 0
		combinedRegistry = refreshCombinedRegistry() // REFRESH: contexts now available

		const statesSeeded = await seedConfigTypeAndRegister('states', configs.states, 'state')
		seededConfigs.configs.push(...(statesSeeded.configs || []))
		seededConfigs.count += statesSeeded.count || 0
		combinedRegistry = refreshCombinedRegistry() // REFRESH: states now available

		const interfacesSeeded = await seedConfigTypeAndRegister(
			'interfaces',
			configs.interfaces,
			'interface',
		)
		seededConfigs.configs.push(...(interfacesSeeded.configs || []))
		seededConfigs.count += interfacesSeeded.count || 0
		combinedRegistry = refreshCombinedRegistry() // REFRESH: interfaces now available

		const subscriptionsSeeded = await seedConfigTypeAndRegister(
			'subscriptions',
			configs.subscriptions,
			'subscription',
		)
		seededConfigs.configs.push(...(subscriptionsSeeded.configs || []))
		seededConfigs.count += subscriptionsSeeded.count || 0
		combinedRegistry = refreshCombinedRegistry() // REFRESH: subscriptions now available

		const inboxesSeeded = await seedConfigTypeAndRegister('inboxes', configs.inboxes, 'inbox')
		seededConfigs.configs.push(...(inboxesSeeded.configs || []))
		seededConfigs.count += inboxesSeeded.count || 0
		combinedRegistry = refreshCombinedRegistry() // REFRESH: inboxes now available

		const childrenSeeded = await seedConfigTypeAndRegister('children', configs.children, 'children')
		seededConfigs.configs.push(...(childrenSeeded.configs || []))
		seededConfigs.count += childrenSeeded.count || 0
		combinedRegistry = refreshCombinedRegistry() // REFRESH: children now available

		const toolsSeeded = await seedConfigTypeAndRegister('tool', configs.tool, 'tool')
		seededConfigs.configs.push(...(toolsSeeded.configs || []))
		seededConfigs.count += toolsSeeded.count || 0
		combinedRegistry = refreshCombinedRegistry() // REFRESH: tools now available
	}

	// Now update all configs with transformed references (all co-ids are now registered)
	const updateConfigReferences = async (configsToUpdate, originalConfigs) => {
		if (!configsToUpdate || !originalConfigs) {
			return 0
		}

		// Use latest registry with all registered co-ids
		const latestRegistry = refreshCombinedRegistry()

		let updatedCount = 0
		for (const configInfo of configsToUpdate) {
			const _coId = configInfo.coId
			const originalId = configInfo.expectedCoId

			// Find original config
			const originalConfig =
				originalId && originalConfigs
					? Object.values(originalConfigs).find((cfg) => cfg.$id === originalId)
					: null

			if (!originalConfig) {
				continue
			}

			// Transform with full registry (all co-ids now available)
			const fullyTransformed = transformForSeeding(originalConfig, latestRegistry)

			// Use the stored CoValue reference (CoMap, CoList, or CoStream)
			const coValue = configInfo.coMap
			const cotype = configInfo.cotype || 'comap'

			if (cotype === 'colist') {
				// CoList: Append transformed items (CoLists are append-only, items are added via append())
				if (coValue && typeof coValue.append === 'function') {
					const transformedItems = fullyTransformed.items || []
					// Append transformed items (CoLists created empty, so just append all items)
					for (const item of transformedItems) {
						coValue.append(item)
					}
					updatedCount++
				} else {
				}
			} else if (cotype === 'costream') {
				// CoStream: Append-only, add items with resolved references
				if (coValue && typeof coValue.push === 'function') {
					const transformedItems = fullyTransformed.items || []
					// Append transformed items to the stream
					for (const item of transformedItems) {
						coValue.push(item)
					}
					updatedCount++
				} else {
				}
			} else {
				// CoMap: Update all properties
				if (coValue && typeof coValue.set === 'function') {
					// Skip $id and $schema (those are in metadata, not properties)
					const { $id, $schema, ...propsToSet } = fullyTransformed

					// For state machines, transform schema references in entry actions
					if (propsToSet.states && typeof propsToSet.states === 'object') {
						// State machines may have entry actions with schema references that need transformation
						// This is handled automatically by transformForSeeding above
					}

					for (const [key, value] of Object.entries(propsToSet)) {
						coValue.set(key, value)
					}

					updatedCount++
				} else {
				}
			}
		}
		return updatedCount
	}

	if (configs) {
		// Update order: dependencies first, then dependents
		// 1. Update subscriptions, inboxes first (they reference actors, but don't affect actor updates)
		const subscriptionsToUpdate = seededConfigs.configs.filter((c) => c.type === 'subscription')
		await updateConfigReferences(subscriptionsToUpdate, configs.subscriptions)

		const inboxesToUpdate = seededConfigs.configs.filter((c) => c.type === 'inbox')
		await updateConfigReferences(inboxesToUpdate, configs.inboxes)

		// Update children BEFORE actors (actors reference children)
		const childrenToUpdate = seededConfigs.configs.filter((c) => c.type === 'children')
		await updateConfigReferences(childrenToUpdate, configs.children)

		// Refresh registry after children are updated (so actor updates can resolve children references)
		refreshCombinedRegistry()

		// 2. Update actors AFTER children are registered (actors reference children)
		const actorsToUpdate = seededConfigs.configs.filter((c) => c.type === 'actor')
		await updateConfigReferences(actorsToUpdate, configs.actors)

		const viewsToUpdate = seededConfigs.configs.filter((c) => c.type === 'view')
		await updateConfigReferences(viewsToUpdate, configs.views)

		const contextsToUpdate = seededConfigs.configs.filter((c) => c.type === 'context')
		await updateConfigReferences(contextsToUpdate, configs.contexts)

		const statesToUpdate = seededConfigs.configs.filter((c) => c.type === 'state')
		await updateConfigReferences(statesToUpdate, configs.states)

		const interfacesToUpdate = seededConfigs.configs.filter((c) => c.type === 'interface')
		await updateConfigReferences(interfacesToUpdate, configs.interfaces)

		// Styles and tools don't typically reference other configs, skip update
	}

	// Seed vibes (depends on actors, so seed after actors)
	// Now that actors are registered, we can transform vibe references properly
	// STRICT: Only configs.vibes (array) - no backward compatibility for configs.vibe
	const allVibes = configs?.vibes || []
	console.log(
		`[sync] Seeding ${allVibes.length} vibes: ${allVibes.map((v) => v?.$id || v?.name || '?').join(', ')}`,
	)
	if (allVibes.length === 0) {
		console.warn(
			'[sync] configs.vibes is empty - skipping vibe registry. Ensure buildSeedConfig returns vibes and configs.vibes is passed to seed.',
		)
	}
	if (allVibes.length > 0) {
		// REFRESH REGISTRY before transforming vibes (actors are now registered)
		combinedRegistry = refreshCombinedRegistry()

		// Anchor: registries.sparks[°Maia].vibes must exist (scaffolded in bootstrap) before we populate it.
		// Ensure vibes CoMap is loaded and writable before seeding entries.
		const vibesId = await groups.getSparkVibesId(backend, MAIA_SPARK)
		let vibes

		if (vibesId) {
			const vibesCore = await ensureCoValueLoaded(backend, vibesId, {
				waitForAvailable: true,
				timeoutMs: 5000,
			})
			if (vibesCore && vibesCore.type === 'comap' && backend.isAvailable(vibesCore)) {
				const vibesContent = vibesCore.getCurrentContent?.()
				if (vibesContent && typeof vibesContent.set === 'function') {
					vibes = vibesContent
				}
			}
		}

		if (!vibes) {
			const vibesSchemaCoId =
				schemaCoIdMap?.get('°Maia/schema/os/vibes-registry') ??
				(await (
					await import('../schema/resolver.js')
				).resolve(backend, '°Maia/schema/os/vibes-registry', { returnType: 'coId' }))
			const ctx = { node, account, guardian: maiaGroup }
			const { coValue: vibesCoMap } = await createCoValueForSpark(ctx, null, {
				schema: vibesSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA,
				cotype: 'comap',
				data: {},
				dbEngine: backend?.dbEngine,
			})
			vibes = vibesCoMap
			await groups.setSparkVibesId(backend, MAIA_SPARK, vibes.id)
		}

		// Ensure spark.os.runtimes exists (create if missing for legacy accounts)
		let runtimes = null
		const osId = await groups.getSparkOsId(backend, MAIA_SPARK)
		if (osId) {
			const osCore = await ensureCoValueLoaded(backend, osId, {
				waitForAvailable: true,
				timeoutMs: 2000,
			})
			if (osCore && backend.isAvailable(osCore)) {
				const osContent = backend.getCurrentContent(osCore)
				if (osContent) {
					const runtimesId = osContent.get('runtimes')
					if (runtimesId) {
						const runtimesCore = node.getCoValue(runtimesId)
						if (runtimesCore && runtimesCore.type === 'comap') {
							const runtimesContent = runtimesCore.getCurrentContent?.()
							if (runtimesContent && typeof runtimesContent.set === 'function') {
								runtimes = runtimesContent
							}
						}
					}
					if (!runtimes) {
						const runtimesSchemaCoId =
							schemaCoIdMap?.get('°Maia/schema/os/runtimes-registry') ??
							(await (
								await import('../schema/resolver.js')
							).resolve(backend, '°Maia/schema/os/runtimes-registry', { returnType: 'coId' }))
						const ctx = { node, account, guardian: maiaGroup }
						const { coValue: runtimesCoMap } = await createCoValueForSpark(ctx, null, {
							schema: runtimesSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA,
							cotype: 'comap',
							data: {},
							dbEngine: backend?.dbEngine,
						})
						runtimes = runtimesCoMap
						osContent.set('runtimes', runtimes.id)
					}
				}
			}
		}

		const runtimeAssignmentSchemaCoId = schemaCoIdMap?.get('°Maia/schema/os/runtime-assignment')
		const runtimeAssignmentsColistSchemaCoId = schemaCoIdMap?.get(
			'°Maia/schema/os/runtime-assignments-colist',
		)

		// Seed each vibe
		for (const vibe of allVibes) {
			const originalVibeId = vibe.$id || ''
			const vibeKey = originalVibeId.startsWith('°Maia/vibe/')
				? originalVibeId.replace('°Maia/vibe/', '')
				: (vibe.name || 'default').toLowerCase().replace(/\s+/g, '-')

			// Ensure schema and actor refs are in combinedRegistry before transform
			const schemaRef = vibe.$schema
			if (
				schemaRef &&
				(schemaRef.startsWith('@') || schemaRef.startsWith('°')) &&
				!combinedRegistry.has(schemaRef)
			) {
				const schemaCoId =
					schemaCoIdMap?.get(schemaRef) ??
					(await (
						await import('../schema/resolver.js')
					).resolve(backend, schemaRef, { returnType: 'coId' }))
				if (schemaCoId) combinedRegistry.set(schemaRef, schemaCoId)
			}
			const actorRef = vibe.actor
			if (actorRef && !actorRef.startsWith('co_z') && !combinedRegistry.has(actorRef)) {
				console.warn(
					`[sync] Vibe "${vibeKey}": actor ref "${actorRef}" not in registry (seed may skip)`,
				)
			}

			// Re-transform vibe now that actors are registered
			let retransformedVibe
			try {
				retransformedVibe = transformForSeeding(vibe, combinedRegistry)
			} catch (e) {
				console.error(`[sync] Vibe "${vibeKey}" transform failed:`, e?.message ?? e)
				throw e
			}

			// createConfig requires $schema to be co_z...
			if (!retransformedVibe.$schema || !retransformedVibe.$schema.startsWith('co_z')) {
				throw new Error(
					`[sync] Vibe "${vibeKey}": $schema missing or not resolved (got ${retransformedVibe.$schema ?? 'undefined'}). ` +
						`Ensure °Maia/schema/vibe is in schema registry.`,
				)
			}

			const vibeConfigs = { vibe: retransformedVibe }
			let vibeSeeded
			try {
				vibeSeeded = await seedConfigs(
					account,
					node,
					maiaGroup,
					backend,
					vibeConfigs,
					instanceCoIdMap,
					schemaCoMaps,
					schemaCoIdMap,
				)
			} catch (e) {
				console.error(`[sync] Vibe "${vibeKey}" seedConfigs failed:`, e?.message ?? e)
				throw e
			}
			seededConfigs.configs.push(...(vibeSeeded.configs || []))
			seededConfigs.count += vibeSeeded.count || 0

			// Store vibe in account.vibes CoMap (simplified structure: account.vibes.todos = co-id)
			if (!vibeSeeded.configs || vibeSeeded.configs.length === 0) {
				console.warn(`[sync] Vibe "${vibeKey}": seedConfigs returned no configs (skipping registry)`)
			}
			if (vibeSeeded.configs && vibeSeeded.configs.length > 0) {
				const vibeInfo = vibeSeeded.configs[0] // First config should be the vibe
				const vibeCoId = vibeInfo.coId

				// Use the vibes CoMap created before the loop
				if (vibes && typeof vibes.set === 'function') {
					vibes.set(vibeKey, vibeCoId)
					console.log(`[sync] Registered vibe "${vibeKey}" -> ${vibeCoId.slice(0, 12)}...`)
					// Verify it was stored (read back immediately)
					const storedValue = vibes.get(vibeKey)
					if (storedValue !== vibeCoId) {
						console.warn(
							`[sync] Vibe "${vibeKey}" write verify failed: stored ${storedValue?.slice?.(0, 12) ?? 'undefined'}`,
						)
					}
				} else {
					console.warn(`[sync] Vibes CoMap not writable (vibes=${!!vibes}, set=${!!vibes?.set})`)
				}

				// Register REAL co-id from CoJSON (never pre-generate!)
				const originalVibeIdForRegistry = vibe.$id // Original $id (e.g., °Maia/vibe/todos)
				// STRICT: Only register by original vibe ID - no backward compat 'vibe' key
				if (originalVibeIdForRegistry) {
					instanceCoIdMap.set(originalVibeIdForRegistry, vibeCoId)
					combinedRegistry.set(originalVibeIdForRegistry, vibeCoId) // Add to registry for future transformations
					coIdRegistry.register(originalVibeIdForRegistry, vibeCoId)
				}

				// Add runtime assignment: runtimes[vibeCoId] = [{ browser: guardianId }] (browser = spark guardian)
				if (
					runtimes &&
					runtimeAssignmentSchemaCoId &&
					runtimeAssignmentsColistSchemaCoId &&
					maiaGroup?.id
				) {
					const ctx = { node, account, guardian: maiaGroup }
					const { coValue: assignmentCoMap } = await createCoValueForSpark(ctx, null, {
						schema: runtimeAssignmentSchemaCoId,
						cotype: 'comap',
						data: { browser: maiaGroup.id },
						dbEngine: backend?.dbEngine,
					})
					const { coValue: assignmentsColist } = await createCoValueForSpark(ctx, null, {
						schema: runtimeAssignmentsColistSchemaCoId,
						cotype: 'colist',
						data: [assignmentCoMap.id],
						dbEngine: backend?.dbEngine,
					})
					runtimes.set(vibeCoId, assignmentsColist.id)
				}
			}
		}

		// Verify all vibes were stored in spark.vibes (registries.sparks[°Maia].vibes)
		if (vibes && typeof vibes.get === 'function') {
			const storedKeys =
				typeof vibes.keys === 'function' ? Array.from(vibes.keys()) : Object.keys(vibes ?? {})
			const vibeKeys = storedKeys.filter(
				(k) => k !== '$schema' && k !== 'type' && k !== 'id' && !k.startsWith('_'),
			)
			if (vibeKeys.length > 0) {
				console.log(`[sync] spark.vibes registry: ${vibeKeys.length} entries (${vibeKeys.join(', ')})`)
			} else {
				const attempted = allVibes.map((v) => v?.$id || v?.name || '?').join(', ')
				throw new Error(
					`[sync] spark.vibes registry is empty after seeding ${allVibes.length} vibe(s) (${attempted}). ` +
						`Each vibe should have triggered vibes.set(). Check for "[sync] Vibe X: seedConfigs returned no configs" above.`,
				)
			}
			for (const vibe of allVibes) {
				const originalVibeId = vibe.$id || ''
				const vibeKey = originalVibeId.startsWith('°Maia/vibe/')
					? originalVibeId.replace('°Maia/vibe/', '')
					: (vibe.name || 'default').toLowerCase().replace(/\s+/g, '-')
				const storedValue = vibes.get(vibeKey)
				if (!storedValue) {
					console.warn(`[sync] Vibe "${vibeKey}" missing from spark.vibes`)
				}
			}
		}
	}

	// Phase 8: Seed data entities to CoJSON
	// Creates individual CoMap items - storage hooks automatically index them into spark.os.indexes[schemaCoId]
	const seededData = await seedData(account, node, maiaGroup, backend, data, coIdRegistry)

	// Phase 9: Store registry in spark.os.schematas CoMap
	await storeRegistry(
		account,
		node,
		maiaGroup,
		backend,
		coIdRegistry,
		schemaCoIdMap,
		instanceCoIdMap,
		configs || {},
		seededSchemas,
	)

	// Phase 10: Explicit re-index pass - ensures 100% of seeded CoValues are indexed
	// Storage hooks may have skipped some (e.g. CoValue not immediately available, os not loaded during bootstrap)
	// indexCoValue is idempotent - skips if already indexed
	const { indexCoValue } = await import('../indexing/schema-index-manager.js')
	const allSeededCoIds = [
		...(seededConfigs.configs || []).map((c) => c.coId).filter(Boolean),
		...(seededData.coIds || []),
	]
	for (const coId of allSeededCoIds) {
		if (coId && typeof coId === 'string' && coId.startsWith('co_z')) {
			try {
				// Pre-load co-value so indexCoValue can access it (we created it locally)
				if (backend.node?.loadCoValueCore) {
					await backend.node.loadCoValueCore(coId).catch(() => {})
				}
				await indexCoValue(backend, coId)
			} catch (e) {
				console.error('[Seed] Re-index pass failed for', coId, e)
			}
		}
	}

	// CoJSON seeding complete

	return {
		metaSchema: metaSchemaCoId,
		schemas: seededSchemas,
		configs: seededConfigs,
		data: seededData,
		registry: coIdRegistry.getAll(),
	}
}

/**
 * Seed configs/instances to CoJSON
 * Creates CoMaps for each config instance (vibe, actors, views, contexts, etc.)
 * @private
 */
async function seedConfigs(
	account,
	node,
	maiaGroup,
	backend,
	transformedConfigs,
	instanceCoIdMap,
	schemaCoMaps,
	schemaCoIdMap,
) {
	const seededConfigs = []
	let totalCount = 0

	// Helper to create a config (CoMap, CoList, or CoStream based on schema's cotype)
	const createConfig = async (config, configType, path) => {
		// Get schema co-id from $schema property
		const schemaCoId = config.$schema
		if (!schemaCoId || !schemaCoId.startsWith('co_z')) {
			throw new Error(`[CoJSONSeed] Config ${configType}:${path} has invalid $schema: ${schemaCoId}`)
		}

		// Retrieve the schema definition to check its cotype
		// Use the schemaCoMaps map we created during schema seeding (more reliable than getCoValue)
		let cotype = 'comap' // Default to comap

		// Find schema by reverse lookup in schemaCoIdMap
		let schemaCoMap = null
		for (const [schemaKey, coId] of schemaCoIdMap.entries()) {
			if (coId === schemaCoId) {
				schemaCoMap = schemaCoMaps.get(schemaKey)
				break
			}
		}

		// If not found in map, try getCoValue as fallback
		if (!schemaCoMap) {
			const schemaCore = node.getCoValue(schemaCoId)
			if (schemaCore && schemaCore.type === 'comap') {
				schemaCoMap = schemaCore.getCurrentContent?.()
			}
		}

		if (schemaCoMap && typeof schemaCoMap.get === 'function') {
			// Try to get cotype property
			cotype = schemaCoMap.get('cotype') || 'comap'

			// Debug: log all properties to see what's actually stored
		} else {
		}

		// Remove $id and $schema from config (they're stored in metadata, not as properties)
		const { $id, $schema, ...configWithoutId } = config

		// Create the appropriate CoJSON type via createCoValueForSpark (3-step: group, extend, leave)
		const ctx = { node, account, guardian: maiaGroup }
		const data = cotype === 'colist' ? [] : cotype === 'costream' ? undefined : configWithoutId
		const { coValue } = await createCoValueForSpark(ctx, null, {
			schema: schemaCoId,
			cotype,
			data,
			dbEngine: backend?.dbEngine,
		})
		const actualCoId = coValue.id

		// Update instanceCoIdMap with actual co-id (CoJSON generates random co-ids, so they won't match human-readable IDs)
		if ($id) {
			instanceCoIdMap.set(path, actualCoId)
			instanceCoIdMap.set($id, actualCoId)
		}

		return {
			type: configType,
			path,
			coId: actualCoId,
			expectedCoId: $id || undefined, // Use $id from config (line 899), or undefined if not present
			coMapId: actualCoId,
			coMap: coValue, // Store the actual CoValue reference (CoMap, CoList, or CoStream)
			cotype: cotype, // Store the type for reference
		}
	}

	// Seed vibe (single instance at root)
	if (transformedConfigs.vibe) {
		const vibeInfo = await createConfig(transformedConfigs.vibe, 'vibe', 'vibe')
		seededConfigs.push(vibeInfo)
		totalCount++
	}

	// Helper to seed a config type (actors, views, etc.)
	const seedConfigType = async (configType, configsOfType) => {
		if (!configsOfType || typeof configsOfType !== 'object') {
			return 0
		}

		let typeCount = 0
		for (const [path, config] of Object.entries(configsOfType)) {
			if (config && typeof config === 'object' && config.$schema) {
				const configInfo = await createConfig(config, configType, path)
				seededConfigs.push(configInfo)
				typeCount++
			}
		}
		return typeCount
	}

	// Seed all config types
	// Note: topics removed - topics infrastructure deprecated, use direct messaging with target instead
	totalCount += await seedConfigType('style', transformedConfigs.styles)
	totalCount += await seedConfigType('actor', transformedConfigs.actors)
	totalCount += await seedConfigType('view', transformedConfigs.views)
	totalCount += await seedConfigType('context', transformedConfigs.contexts)
	totalCount += await seedConfigType('state', transformedConfigs.states)
	totalCount += await seedConfigType('interface', transformedConfigs.interfaces)
	totalCount += await seedConfigType('subscription', transformedConfigs.subscriptions)
	totalCount += await seedConfigType('inbox', transformedConfigs.inboxes)
	totalCount += await seedConfigType('children', transformedConfigs.children)

	return {
		count: totalCount,
		types: [...new Set(seededConfigs.map((c) => c.type))],
		configs: seededConfigs,
	}
}

/**
 * Seed data entities to CoJSON
 *
 * Creates individual CoMap items for each data entity. Items are automatically indexed
 * into spark.os.indexes[schemaCoId] via storage hooks (schema-index-manager.js).
 *
 * The read() query reads from spark.os.indexes[schemaCoId] schema index CoLists, not from
 * account.data.{collectionName} CoLists (which are deprecated).
 *
 * @private
 */
async function seedData(account, node, maiaGroup, backend, data, coIdRegistry) {
	// Import transformer for data items
	const { transformForSeeding } = await import('@MaiaOS/schemata/schema-transformer')

	if (!data || Object.keys(data).length === 0) {
		return {
			collections: [],
			totalItems: 0,
			coIds: [],
		}
	}

	const seededCollections = []
	let totalItems = 0

	// Create individual CoMap items for each collection
	// Storage hooks will automatically index them into spark.os.indexes[schemaCoId]
	for (const [collectionName, collectionItems] of Object.entries(data)) {
		if (!Array.isArray(collectionItems)) {
			continue
		}

		// Get schema co-id for this collection
		// Try multiple possible schema key formats:
		// 1. "data/todos" (direct schema name)
		// 2. "°Maia/schema/data/todos" (with °Maia/schema prefix)
		// 3. "°Maia/schema/todos" (without data prefix, for backward compatibility)
		const schemaKey1 = `data/${collectionName}`
		const schemaKey2 = `°Maia/schema/data/${collectionName}`
		const schemaKey3 = `°Maia/schema/${collectionName}`

		const schemaCoId =
			coIdRegistry.registry.get(schemaKey1) ||
			coIdRegistry.registry.get(schemaKey2) ||
			coIdRegistry.registry.get(schemaKey3)

		if (!schemaCoId) {
			continue
		}

		// Create CoMaps for each item
		// Storage hooks will automatically index them; we collect co-ids for explicit re-index pass
		let itemCount = 0
		const coIds = []
		for (const item of collectionItems) {
			// Transform item references
			const transformedItem = transformForSeeding(item, coIdRegistry.getAll())

			// Remove $id if present (CoJSON will assign ID when creating CoMap)
			const { $id, ...itemWithoutId } = transformedItem

			// Create CoMap via createCoValueForSpark (3-step: group, extend, leave)
			const ctx = { node, account, guardian: maiaGroup }
			const { coValue: itemCoMap } = await createCoValueForSpark(ctx, null, {
				schema: schemaCoId,
				cotype: 'comap',
				data: itemWithoutId,
				dbEngine: backend?.dbEngine,
			})
			coIds.push(itemCoMap.id)
			itemCount++
		}

		seededCollections.push({
			name: collectionName,
			schemaCoId: schemaCoId,
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

/**
 * Ensure spark.os CoMap exists (creates if needed)
 * Also ensures spark.os.schematas, spark.os.indexes, spark.vibes
 * Uses real schema co-ids where available
 * @private
 */
async function ensureSparkOs(account, node, maiaGroup, backend, schemaCoIdMap) {
	const osId = await groups.getSparkOsId(backend, MAIA_SPARK)
	if (!osId) {
		throw new Error('[Seed] °Maia spark.os not found. Ensure bootstrap has run.')
	}

	const { resolve } = await import('../schema/resolver.js')
	const schematasSchemaCoId =
		schemaCoIdMap?.get('°Maia/schema/os/schematas-registry') ??
		(await resolve(backend, '°Maia/schema/os/schematas-registry', { returnType: 'coId' }))
	const vibesSchemaCoId =
		schemaCoIdMap?.get('°Maia/schema/os/vibes-registry') ??
		(await resolve(backend, '°Maia/schema/os/vibes-registry', { returnType: 'coId' }))
	const _schematasMeta = schematasSchemaCoId
		? { $schema: schematasSchemaCoId }
		: { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }
	const _vibesMeta = vibesSchemaCoId
		? { $schema: vibesSchemaCoId }
		: { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }

	let osCore = node.getCoValue(osId)
	if (!osCore && node.loadCoValueCore) {
		await node.loadCoValueCore(osId)
		osCore = node.getCoValue(osId)
	}

	if (!osCore || !osCore.isAvailable()) {
		await new Promise((r) => {
			let unsub
			const t = setTimeout(r, 5000)
			if (osCore) {
				unsub = osCore.subscribe((c) => {
					if (c?.isAvailable?.()) {
						clearTimeout(t)
						unsub?.()
						r()
					}
				})
			} else r()
		})
		osCore = node.getCoValue(osId)
	}

	if (osCore?.isAvailable()) {
		const osContent = osCore.getCurrentContent?.()
		if (osContent && typeof osContent.get === 'function') {
			const schematasId = osContent.get('schematas')
			if (!schematasId) {
				const ctx = { node, account, guardian: maiaGroup }
				const { coValue: schematas } = await createCoValueForSpark(ctx, null, {
					schema: schematasSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA,
					cotype: 'comap',
					data: {},
					dbEngine: backend?.dbEngine,
				})
				osContent.set('schematas', schematas.id)
				if (node.storage?.syncManager) {
					try {
						await node.syncManager.waitForStorageSync(schematas.id)
						await node.syncManager.waitForStorageSync(osId)
					} catch (_e) {}
				}
			}
			const indexesId = osContent.get('indexes')
			if (!indexesId && backend) {
				await ensureIndexesCoMap(backend)
			}
		}
	}

	// Ensure spark.vibes exists (for old scaffolds) - only when we have schemaCoIdMap for proper schema
	// Use account.registries.sparks (new path); legacy account.sparks no longer exists
	const vibesId = await groups.getSparkVibesId(backend, MAIA_SPARK)
	if (!vibesId && schemaCoIdMap) {
		const sparksId = await groups.getSparksRegistryId(backend)
		if (sparksId?.startsWith('co_z')) {
			const sparksStore = await backend.read(null, sparksId)
			await waitForStoreReady(sparksStore, sparksId, 10000)
			const sparksData = sparksStore?.value ?? {}
			const maiaSparkCoId = sparksData?.[MAIA_SPARK] ?? sparksData?.['°Maia']
			if (maiaSparkCoId?.startsWith('co_z')) {
				const sparkCore = backend.getCoValue(maiaSparkCoId)
				if (sparkCore && backend.isAvailable(sparkCore)) {
					const sparkContent = backend.getCurrentContent(sparkCore)
					if (sparkContent && typeof sparkContent.set === 'function') {
						const ctx = { node, account, guardian: maiaGroup }
						const { coValue: vibes } = await createCoValueForSpark(ctx, null, {
							schema: vibesSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA,
							cotype: 'comap',
							data: {},
							dbEngine: backend?.dbEngine,
						})
						sparkContent.set('vibes', vibes.id)
					}
				}
			}
		}
	}
}

/**
 * Store registry in spark.os.schematas CoMap
 * Also ensures spark.os CoMap (if not already created by ensureSparkOs)
 * @private
 */
async function storeRegistry(
	account,
	node,
	maiaGroup,
	backend,
	coIdRegistry,
	schemaCoIdMap,
	_instanceCoIdMap,
	_configs,
	_seededSchemas,
) {
	// spark.os should already exist (created by ensureSparkOs in Phase 0)
	// Schemas are auto-registered by storage hook
	const osId = await groups.getSparkOsId(backend, MAIA_SPARK)
	if (!osId) {
		return
	}

	// Get spark.os CoMap
	let osCore = node.getCoValue(osId)
	if (!osCore && node.loadCoValueCore) {
		await node.loadCoValueCore(osId)
		osCore = node.getCoValue(osId)
	}

	if (!osCore || !osCore.isAvailable()) {
		return
	}

	const osContent = osCore.getCurrentContent?.()
	if (!osContent || typeof osContent.get !== 'function') {
		return
	}

	// Get or create spark.os.schematas CoMap
	const schematasId = osContent.get('schematas')
	let schematas

	if (schematasId) {
		const schematasCore = node.getCoValue(schematasId)
		if (schematasCore?.isAvailable()) {
			const schematasContent = schematasCore.getCurrentContent?.()
			if (schematasContent && typeof schematasContent.set === 'function') {
				schematas = schematasContent
			}
		}
	}

	if (!schematas) {
		// Create schematas CoMap if it doesn't exist
		// Try to use proper schema (°Maia/schema/os/schematas-registry), fallback to °Maia if not available
		// Note: During initial seeding, the schema might not be registered yet, so we fallback to °Maia
		let schematasSchemaCoId = null
		if (schemaCoIdMap?.has('°Maia/schema/os/schematas-registry')) {
			schematasSchemaCoId = schemaCoIdMap.get('°Maia/schema/os/schematas-registry')
		}
		const schemaForSchematas = schematasSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA
		const ctx = { node, account, guardian: maiaGroup }
		const { coValue: schematasCreated } = await createCoValueForSpark(ctx, null, {
			schema: schemaForSchematas,
			cotype: 'comap',
			data: {},
			dbEngine: backend?.dbEngine,
		})
		schematas = schematasCreated
		osContent.set('schematas', schematas.id)

		// Wait for storage sync
		if (node.storage && node.syncManager) {
			try {
				await node.syncManager.waitForStorageSync(schematas.id)
				await node.syncManager.waitForStorageSync(osId)
			} catch (_e) {}
		}
	}

	// CRITICAL: Storage hook automatically registers ALL schemas when they're created via CRUD API
	// However, metaschema is created directly (not via CRUD API) so it needs manual registration
	// All other schemas (°Maia/schema/* except °Maia/schema/meta) are auto-registered by storage hook
	// They're created via CRUD API, so the hook fires automatically
	const metaschemaCoId = coIdRegistry.get('°Maia/schema/meta')

	if (metaschemaCoId) {
		// Metaschema is created directly (not via CRUD API), so storage hook won't register it
		// Manually register it here as a fallback
		const existingCoId = schematas.get('°Maia/schema/meta')
		if (!existingCoId) {
			schematas.set('°Maia/schema/meta', metaschemaCoId)
		} else if (existingCoId !== metaschemaCoId) {
		} else {
		}
	}
}
