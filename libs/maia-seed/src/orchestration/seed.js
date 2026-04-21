/**
 * CoJSON Seed - Bootstrap → Schemas → Configs → Data → Registry
 */

import * as groups from '@MaiaOS/db'
import {
	buildSystemFactoryCoIdsFromSparkOs,
	createCoValueForSpark,
	ensureCoValueLoaded,
	fillRuntimeRefsFromSystemFactories,
	SPARK_OS_META_FACTORY_CO_ID_KEY,
} from '@MaiaOS/db'
import { createOpsLogger, OPS_PREFIX } from '@MaiaOS/logs'
import { maiaFactoryRefToNanoid, maiaIdentity } from '@MaiaOS/validation/identity-from-maia-path.js'
import { removeIdFields } from '@MaiaOS/validation/remove-id-fields'
import { getVibeKey } from '@MaiaOS/validation/vibe-keys'
import { bootstrapAccountSparks, bootstrapAndScaffold } from './bootstrap.js'
import { seedConfigs } from './configs.js'
import { seedData } from './data.js'
import { buildMetaFactoryForSeeding, ensureSparkOs, sortSchemasByDependency } from './helpers.js'

const MAIA_SPARK = '°maia'

function registerSeedCoId(registry, humanId, coId) {
	if (registry.has(humanId)) {
		const existing = registry.get(humanId)
		if (existing !== coId) {
			throw new Error(
				`Co-id already registered for ${humanId}: ${existing} (trying to register ${coId})`,
			)
		}
		return
	}
	registry.set(humanId, coId)
}

const opsSeed = createOpsLogger('seed')

function collectUniqueGenesisCoIds({
	metaSchemaCoId,
	seededSchemas,
	seededConfigs,
	seededData,
	seedRegistry,
	instanceCoIdMap,
	factoryCoIdMap,
	combinedRegistry,
}) {
	const s = new Set()
	const add = (id) => {
		if (typeof id === 'string' && id.startsWith('co_z')) s.add(id)
	}
	for (const id of seedRegistry.values()) add(id)
	add(metaSchemaCoId)
	if (Array.isArray(seededSchemas)) {
		for (const row of seededSchemas) add(row?.coId)
	}
	if (Array.isArray(seededConfigs?.configs)) {
		for (const c of seededConfigs.configs) add(c?.coId)
	}
	if (Array.isArray(seededData?.coIds)) {
		for (const id of seededData.coIds) add(id)
	}
	for (const id of instanceCoIdMap.values()) add(id)
	for (const id of factoryCoIdMap.values()) add(id)
	for (const id of combinedRegistry.values()) add(id)
	return s
}

const REFERENCE_PROPS = [
	'actor',
	'context',
	'view',
	'process',
	'brand',
	'style',
	'inbox',
	'interface',
	'wasm',
]
const NESTED_REF_PROPS = []

/**
 * Title/instance-path → co_z from spark.os (definition catalog colist).
 * @param {object} peer — MaiaDB peer
 */
async function collectSparkOsRegistry(peer, osId, metaCoId) {
	if (!osId || !metaCoId?.startsWith?.('co_z')) return new Map()
	return buildSystemFactoryCoIdsFromSparkOs(peer, osId)
}

export async function simpleAccountSeed(_account, _node) {
	opsSeed.log('✅ Simple account seed: (registries via link)')
}

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

	if (!forceFreshSeed) {
		return { skipped: true, reason: 'seed_requires_forceFreshSeed' }
	}

	const { MaiaDB } = await import('@MaiaOS/db')
	const peer = existingBackend || new MaiaDB({ node, account }, {})

	const needsBootstrap = !account.get('sparks') || !String(account.get('sparks')).startsWith('co_z')
	if (needsBootstrap) {
		const { ensureFactoriesLoaded, getAllFactories } = await import(
			'@MaiaOS/validation/factory-registry'
		)
		await ensureFactoriesLoaded()
		await bootstrapAndScaffold(account, node, schemas || getAllFactories(), peer.dbEngine)
	}

	const { transformInstanceForSeeding, transformSchemaForSeeding, validateFactoryStructure } =
		await import('../ref-transform.js')
	/** Pre-seed: $nanoid → co_z (factories + instances). */
	const seedRegistry = new Map()
	const metaFactoryNanoid = maiaIdentity('meta.factory.maia').$nanoid

	const maiaGroup = await groups.getMaiaGroup(peer)
	if (!maiaGroup || typeof maiaGroup.createMap !== 'function') {
		throw new Error(
			'[CoJSONSeed] °maia spark group not found. Ensure bootstrap has created °maia spark.',
		)
	}
	await bootstrapAccountSparks(peer, maiaGroup)
	await peer.resolveSystemSparkCoId()

	const uniqueSchemasByNanoid = new Map()
	for (const [name, schema] of Object.entries(schemas)) {
		const nn = schema.$nanoid
		if (typeof nn !== 'string' || nn.length === 0) {
			throw new Error(`[CoJSONSeed] factory schema missing canonical $nanoid (registry key ${name})`)
		}
		if (!uniqueSchemasByNanoid.has(nn)) uniqueSchemasByNanoid.set(nn, { name, schema })
	}

	const sortedFactoryKeys = sortSchemasByDependency(uniqueSchemasByNanoid)

	await ensureSparkOs(account, node, maiaGroup, peer, undefined)

	const { EXCEPTION_FACTORIES } = await import('@MaiaOS/db/registry')
	let metaSchemaCoId = null
	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (osId) {
		const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
		if (osCore && peer.isAvailable(osCore)) {
			const osContent = peer.getCurrentContent(osCore)
			const anchored = osContent?.get?.(SPARK_OS_META_FACTORY_CO_ID_KEY)
			if (anchored?.startsWith?.('co_z')) metaSchemaCoId = anchored
		}
	}

	if (!metaSchemaCoId) {
		const tempMetaSchemaDef = buildMetaFactoryForSeeding('co_zTEMP')
		const cleanedTempDef = {
			definition: removeIdFields(tempMetaSchemaDef.definition || tempMetaSchemaDef),
		}
		const { coValue: metaSchemaCoMap } = await createCoValueForSpark(
			{ node, account, guardian: maiaGroup },
			null,
			{ factory: EXCEPTION_FACTORIES.META_SCHEMA, cotype: 'comap', data: cleanedTempDef },
		)
		const actualMetaSchemaCoId = metaSchemaCoMap.id
		const updatedMetaSchemaDef = buildMetaFactoryForSeeding(actualMetaSchemaCoId)
		const {
			$schema: _s,
			$factory: _f,
			$id,
			id,
			...directProperties
		} = updatedMetaSchemaDef.definition || updatedMetaSchemaDef
		const cleanedProperties = removeIdFields(directProperties)
		for (const [key, value] of Object.entries(cleanedProperties)) metaSchemaCoMap.set(key, value)
		metaSchemaCoId = actualMetaSchemaCoId
		if (osId) {
			const osCoreForAnchor = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
			if (osCoreForAnchor && peer.isAvailable(osCoreForAnchor)) {
				const osMap = peer.getCurrentContent(osCoreForAnchor)
				osMap?.set?.(SPARK_OS_META_FACTORY_CO_ID_KEY, metaSchemaCoId)
			}
		}
	} else {
		const updatedMetaSchemaDef = buildMetaFactoryForSeeding(metaSchemaCoId)
		const {
			$schema: _s,
			$factory: _f,
			$id,
			id,
			...directProperties
		} = updatedMetaSchemaDef.definition || updatedMetaSchemaDef
		const cleanedProperties = removeIdFields(directProperties)
		const metaSchemaCore = await ensureCoValueLoaded(peer, metaSchemaCoId, {
			waitForAvailable: true,
		})
		if (metaSchemaCore && peer.isAvailable(metaSchemaCore)) {
			const metaSchemaCoMap = peer.getCurrentContent(metaSchemaCore)
			if (metaSchemaCoMap?.set) {
				for (const [key, value] of Object.entries(cleanedProperties)) {
					metaSchemaCoMap.set(key, value)
				}
			}
		}
	}

	if (!seedRegistry.has(metaFactoryNanoid)) {
		registerSeedCoId(seedRegistry, metaFactoryNanoid, metaSchemaCoId)
	}

	peer.systemFactoryCoIds.set(metaFactoryNanoid, metaSchemaCoId)
	fillRuntimeRefsFromSystemFactories(peer)
	const { hydrateValidationMetaFromPeer } = await import('@MaiaOS/validation/validation.helper')
	await hydrateValidationMetaFromPeer(peer)

	const factoryCoIdMap = new Map()
	const factoryCoMaps = new Map()
	const { create: crudCreate } = await import('@MaiaOS/db/cojson/crud/create')
	const { update: crudUpdate } = await import('@MaiaOS/db/cojson/crud/update')

	const existingSchemaRegistry =
		osId && metaSchemaCoId ? await collectSparkOsRegistry(peer, osId, metaSchemaCoId) : new Map()

	for (const factoryNanoidKey of sortedFactoryKeys) {
		const { schema } = uniqueSchemasByNanoid.get(factoryNanoidKey)
		const {
			$schema: _s,
			$factory: _f,
			$label: _lb,
			$nanoid: _n,
			$id: _legacyId,
			id,
			...directProperties
		} = schema
		const cleanedProperties = removeIdFields(directProperties)
		const factoryNanoid = typeof _n === 'string' && _n.length > 0 ? _n : factoryNanoidKey
		if (!factoryNanoid) {
			throw new Error(`[Seed] Missing factory $nanoid for ${factoryNanoidKey}`)
		}
		const existingSchemaCoId = existingSchemaRegistry.get(factoryNanoid)
		let actualCoId
		if (existingSchemaCoId) {
			await crudUpdate(peer, metaSchemaCoId, existingSchemaCoId, cleanedProperties)
			actualCoId = existingSchemaCoId
		} else {
			const createdSchema = await crudCreate(peer, metaSchemaCoId, cleanedProperties)
			actualCoId = createdSchema.id
		}
		factoryCoIdMap.set(factoryNanoid, actualCoId)
		const factoryCoValueCore = peer.getCoValue(actualCoId)
		if (factoryCoValueCore && peer.isAvailable(factoryCoValueCore)) {
			const factoryCoMapContent = peer.getCurrentContent(factoryCoValueCore)
			if (factoryCoMapContent?.set) factoryCoMaps.set(factoryNanoid, factoryCoMapContent)
		}
		registerSeedCoId(seedRegistry, factoryNanoid, actualCoId)
	}

	if (metaSchemaCoId) {
		factoryCoIdMap.set(metaFactoryNanoid, metaSchemaCoId)
	}

	// Schema definitions (meta-schema children) must always be CoMaps (have .get for resolution)
	for (const factoryNanoidKey of sortedFactoryKeys) {
		const { schema } = uniqueSchemasByNanoid.get(factoryNanoidKey)
		const fn =
			typeof schema.$nanoid === 'string' && schema.$nanoid.length > 0
				? schema.$nanoid
				: factoryNanoidKey
		const factoryCoId = fn ? factoryCoIdMap.get(fn) : null
		if (!factoryCoId) continue
		const core = peer.getCoValue(factoryCoId)
		if (!core || !peer.isAvailable(core)) continue
		const content = peer.getCurrentContent(core)
		const isCoMap = content && typeof content.get === 'function'
		if (!isCoMap) {
			const rawType = content?.type ?? core?.type ?? 'unknown'
			throw new Error(
				`[Seed] Factory definition ${factoryNanoidKey} must be CoMap but is ${rawType}. ` +
					'Corrupt data. Clear storage (delete DB file or IndexedDB) and re-run sync genesis (PEER_SYNC_SEED=true once) or wipe and re-seed.',
			)
		}
	}

	const seededSchemas = []
	for (const factoryNanoidKey of sortedFactoryKeys) {
		const { name, schema } = uniqueSchemasByNanoid.get(factoryNanoidKey)
		const fn =
			typeof schema.$nanoid === 'string' && schema.$nanoid.length > 0
				? schema.$nanoid
				: factoryNanoidKey
		const factoryCoId = fn ? factoryCoIdMap.get(fn) : null
		const factoryCoMap = fn ? factoryCoMaps.get(fn) : null
		const transformedSchema = transformSchemaForSeeding(schema, factoryCoIdMap)
		transformedSchema.$id = `https://maia.city/${factoryCoId}`
		const verificationErrors = validateFactoryStructure(transformedSchema, factoryNanoidKey, {
			checkSchemaReferences: true,
			checkNestedCoTypes: false,
		})
		if (verificationErrors.length > 0) {
			throw new Error(
				`[Seed] Factory ${factoryNanoidKey} still contains °maia/factory/ references: ${verificationErrors.join('\n')}`,
			)
		}
		const {
			$schema: _s,
			$factory: _f,
			$label: _l2,
			$nanoid: _n2,
			$id: _i,
			id: _id,
			...directProps
		} = transformedSchema
		const cleanedProperties = removeIdFields(directProps)
		for (const [key, value] of Object.entries(cleanedProperties)) factoryCoMap?.set(key, value)
		seededSchemas.push({ name, key: factoryNanoidKey, coId: factoryCoId, coMapId: factoryCoMap?.id })
	}

	await ensureSparkOs(account, node, maiaGroup, peer, factoryCoIdMap)

	const instanceCoIdMap = new Map()

	const getCombinedRegistry = async () => {
		const osId2 = await groups.getSparkOsId(peer, MAIA_SPARK)
		if (!osId2) return new Map(factoryCoIdMap)
		const fromOs = await collectSparkOsRegistry(peer, osId2, metaSchemaCoId)
		const merged = new Map(factoryCoIdMap)
		for (const [k, v] of fromOs) merged.set(k, v)
		if (metaSchemaCoId) merged.set(metaFactoryNanoid, metaSchemaCoId)
		return merged
	}

	let combinedRegistry = await getCombinedRegistry()
	if (data) {
		for (const [collectionName, bucket] of Object.entries(data)) {
			if (!bucket || typeof bucket !== 'object') continue
			if (collectionName === 'icons') continue
			const factoryBasename =
				typeof bucket.$factory === 'string' && bucket.$factory.startsWith('°maia/factory/')
					? bucket.$factory.slice('°maia/factory/'.length)
					: `${collectionName}.factory.maia`
			const n = maiaIdentity(factoryBasename).$nanoid
			const dataFactoryCoId = combinedRegistry.get(n)
			if (dataFactoryCoId) {
				combinedRegistry.set(n, dataFactoryCoId)
				registerSeedCoId(seedRegistry, n, dataFactoryCoId)
			}
		}
	}

	const seededConfigs = { configs: [], count: 0 }

	const transformSchemaRefsOnly = (instance, schemaRegistry) => {
		if (!instance || typeof instance !== 'object') return instance
		const transformed = JSON.parse(JSON.stringify(instance))
		const factoryRef = transformed.$factory
		if (factoryRef?.startsWith('°maia/factory/')) {
			const n = maiaFactoryRefToNanoid(factoryRef)
			const coId = n ? schemaRegistry.get(n) : null
			if (coId) {
				transformed.$factory = coId
				delete transformed.$schema
			}
		}
		for (const prop of REFERENCE_PROPS) delete transformed[prop]
		for (const prop of NESTED_REF_PROPS) delete transformed[prop]
		return transformed
	}

	const refreshCombinedRegistry = () => {
		const refreshed = new Map(factoryCoIdMap)
		for (const [key, coId] of combinedRegistry) refreshed.set(key, coId)
		for (const [key, coId] of instanceCoIdMap) {
			if (coId?.startsWith?.('co_z')) refreshed.set(key, coId)
		}
		for (const [key, coId] of seedRegistry) {
			if (coId?.startsWith?.('co_z')) refreshed.set(key, coId)
		}
		return refreshed
	}

	const seedConfigTypeAndRegister = async (configTypeKey, configsOfType) => {
		if (!configsOfType || typeof configsOfType !== 'object') return { configs: [], count: 0 }
		const transformed = {}
		for (const [instanceKey, instance] of Object.entries(configsOfType)) {
			transformed[instanceKey] = transformSchemaRefsOnly(instance, combinedRegistry)
		}
		const seeded = await seedConfigs(
			account,
			node,
			maiaGroup,
			peer,
			{ [configTypeKey]: transformed },
			instanceCoIdMap,
			factoryCoMaps,
			factoryCoIdMap,
		)
		for (const configInfo of seeded.configs || []) {
			instanceCoIdMap.set(configInfo.path, configInfo.coId)
			if (configInfo.expectedNanoid) {
				instanceCoIdMap.set(configInfo.expectedNanoid, configInfo.coId)
				combinedRegistry.set(configInfo.expectedNanoid, configInfo.coId)
				registerSeedCoId(seedRegistry, configInfo.expectedNanoid, configInfo.coId)
			}
			registerSeedCoId(seedRegistry, configInfo.path, configInfo.coId)
		}
		return seeded
	}

	// Interfaces before actors (actors reference interface). Process before actors (actors reference process). Wasms before actors (actors reference wasm).
	const CONFIG_ORDER = [
		['styles', 'styles'],
		['inboxes', 'inboxes'],
		['processes', 'processes'],
		['interfaces', 'interfaces'],
		['wasms', 'wasms'],
		['actors', 'actors'],
		['views', 'views'],
		['contexts', 'contexts'],
	]

	if (configs) {
		for (const [key, prop] of CONFIG_ORDER) {
			const configsOfType = configs[prop]
			if (configsOfType) {
				const seeded = await seedConfigTypeAndRegister(key, configsOfType)
				seededConfigs.configs.push(...(seeded.configs || []))
				seededConfigs.count += seeded.count || 0
				combinedRegistry = refreshCombinedRegistry()
			}
		}
	}

	const updateConfigReferences = async (configsToUpdate, originalConfigs) => {
		if (!configsToUpdate || !originalConfigs) return 0
		const latestRegistry = refreshCombinedRegistry()
		let updatedCount = 0
		for (const configInfo of configsToUpdate) {
			const originalConfig = originalConfigs
				? Object.values(originalConfigs).find((cfg) => cfg.$nanoid === configInfo.expectedNanoid)
				: null
			if (!originalConfig) continue
			const fullyTransformed = transformInstanceForSeeding(originalConfig, latestRegistry)
			if (configInfo.type === 'actor' && typeof configInfo.path === 'string') {
				const canonical = maiaIdentity(configInfo.path)
				fullyTransformed.$nanoid = canonical.$nanoid
				fullyTransformed.$label = canonical.$label
			}
			if (configInfo.type === 'actor') {
				for (const prop of ['process', 'context', 'view', 'interface', 'wasm', 'inbox']) {
					const val = fullyTransformed[prop]
					if (val && typeof val === 'string' && !val.startsWith('co_z')) {
						throw new Error(
							`[Seed] Actor config ${configInfo.expectedNanoid} has unresolved ref in ${prop}: ${val}. ` +
								`All refs must be transformed to co-ids during seed. Check transformInstanceForSeeding and coIdMap coverage.`,
						)
					}
				}
			}
			const coValue = configInfo.coMap
			const cotype = configInfo.cotype || 'comap'
			if (cotype === 'colist' && coValue?.append) {
				for (const item of fullyTransformed.items || []) coValue.append(item)
				updatedCount++
			} else if (cotype === 'costream' && coValue?.push) {
				for (const item of fullyTransformed.items || []) coValue.push(item)
				updatedCount++
			} else if (coValue?.set) {
				const { $factory: _factoryInContent, ...propsToSet } = fullyTransformed
				if (configInfo.type === 'wasm') delete propsToSet.code
				for (const [key, value] of Object.entries(propsToSet)) coValue.set(key, value)
				updatedCount++
			}
		}
		return updatedCount
	}

	if (configs) {
		const updateOrder = [
			['inbox', 'inboxes'],
			['wasm', 'wasms'],
			['actor', 'actors'],
			['view', 'views'],
			['context', 'contexts'],
			['process', 'processes'],
			['interface', 'interfaces'],
		]
		for (const [type, prop] of updateOrder) {
			const toUpdate = seededConfigs.configs.filter((c) => c.type === type)
			const originals = configs[prop]
			if (toUpdate.length && originals) await updateConfigReferences(toUpdate, originals)
		}
	}

	let seededData = { collections: [], totalItems: 0, coIds: [] }
	if (data) {
		seededData = await seedData(account, node, maiaGroup, peer, data, seedRegistry, {
			instanceCoIdMap,
			registerSeedCoId,
		})
		combinedRegistry = refreshCombinedRegistry()
	}

	const allVibes = configs?.vibes || []
	if (allVibes.length > 0) {
		if (!data?.icons?.instances?.length) {
			throw new Error(
				'[CoJSONSeed] data.icons.instances required when configs include vibes (from buildSeedConfig / SEED_DATA.icons)',
			)
		}
		combinedRegistry = refreshCombinedRegistry()
		let vibes = null
		const vibesId = await groups.getSparkVibesId(peer, MAIA_SPARK)
		if (vibesId) {
			const vibesCore = await ensureCoValueLoaded(peer, vibesId, {
				waitForAvailable: true,
				timeoutMs: 5000,
			})
			if (vibesCore?.type === 'comap' && peer.isAvailable(vibesCore)) {
				vibes = vibesCore.getCurrentContent?.()
			}
		}
		if (!vibes) {
			const { EXCEPTION_FACTORIES } = await import('@MaiaOS/db/registry')
			const vibesRegistrySchemaCoId =
				factoryCoIdMap?.get(maiaIdentity('vibes-registry.factory.maia').$nanoid) ??
				(await (
					await import('@MaiaOS/db')
				).lookupRegistryKey(peer, '°maia/factory/vibes-registry.factory.maia', {
					returnType: 'coId',
				}))
			const { coValue: vibesCoMap } = await createCoValueForSpark(
				{ node, account, guardian: maiaGroup },
				null,
				{
					factory: vibesRegistrySchemaCoId || EXCEPTION_FACTORIES.META_SCHEMA,
					cotype: 'comap',
					data: {},
					dataEngine: peer?.dbEngine,
				},
			)
			vibes = vibesCoMap
			await groups.setSparkVibesId(peer, MAIA_SPARK, vibes.id)
		}
		for (const vibe of allVibes) {
			const vibeKey = getVibeKey(vibe)
			const factoryRef = vibe.$factory
			const factoryRefN = factoryRef?.startsWith('°maia/factory/')
				? maiaFactoryRefToNanoid(factoryRef)
				: null
			if (
				factoryRef &&
				(factoryRef.startsWith('@') || factoryRef.startsWith('°')) &&
				!(factoryRefN ? combinedRegistry.has(factoryRefN) : combinedRegistry.has(factoryRef))
			) {
				const factoryCoId =
					(factoryRefN ? factoryCoIdMap?.get(factoryRefN) : null) ??
					factoryCoIdMap?.get(factoryRef) ??
					(await (
						await import('@MaiaOS/db')
					).lookupRegistryKey(peer, factoryRef, { returnType: 'coId' }))
				if (factoryCoId) combinedRegistry.set(factoryRefN ?? factoryRef, factoryCoId)
			}
			const retransformedVibe = transformInstanceForSeeding(vibe, combinedRegistry)
			if (!retransformedVibe.$factory?.startsWith('co_z')) {
				throw new Error(
					`${OPS_PREFIX.sync} Vibe "${vibeKey}": $factory missing or not resolved. Ensure °maia/factory/vibe.factory.maia is in schema registry.`,
				)
			}
			const vibeSeeded = await seedConfigs(
				account,
				node,
				maiaGroup,
				peer,
				{ vibe: retransformedVibe },
				instanceCoIdMap,
				factoryCoMaps,
				factoryCoIdMap,
			)
			seededConfigs.configs.push(...(vibeSeeded.configs || []))
			seededConfigs.count += vibeSeeded.count || 0
			if (vibeSeeded.configs?.length > 0) {
				const vibeCoId = vibeSeeded.configs[0].coId
				vibes?.set?.(vibeKey, vibeCoId)
				if (vibe.$nanoid) {
					instanceCoIdMap.set(vibe.$nanoid, vibeCoId)
					combinedRegistry.set(vibe.$nanoid, vibeCoId)
					registerSeedCoId(seedRegistry, vibe.$nanoid, vibeCoId)
				}
			}
		}
	}

	for (const [k, v] of factoryCoIdMap) {
		if (typeof k === 'string' && typeof v === 'string' && v.startsWith('co_z')) {
			peer.systemFactoryCoIds.set(k, v)
		}
	}
	fillRuntimeRefsFromSystemFactories(peer)

	const dataCoIds = seededData?.coIds
	if (Array.isArray(dataCoIds) && dataCoIds.length > 0) {
		const { applyPersistentCoValueIndexing } = await import(
			'@MaiaOS/db/cojson/indexing/factory-index-manager.js'
		)
		for (const coId of dataCoIds) {
			if (typeof coId !== 'string' || !coId.startsWith('co_z')) continue
			const core = await ensureCoValueLoaded(peer, coId, { waitForAvailable: true })
			if (core && peer.isAvailable(core)) {
				await applyPersistentCoValueIndexing(peer, core)
			}
		}
	}

	const uniqueGenesisCoIds = collectUniqueGenesisCoIds({
		metaSchemaCoId,
		seededSchemas,
		seededConfigs,
		seededData,
		seedRegistry,
		instanceCoIdMap,
		factoryCoIdMap,
		combinedRegistry,
	})
	opsSeed.log(
		'Genesis seed %d unique CoValues (co_z); registry keys %d. PG coValues row count is total storage (bootstrap, this seed pass, sessions/transactions, runtime) — not identical to this number.',
		uniqueGenesisCoIds.size,
		seedRegistry.size,
	)

	return {
		metaSchema: metaSchemaCoId,
		schemas: seededSchemas,
		configs: seededConfigs,
		data: seededData,
		registry: new Map(seedRegistry),
	}
}
