/**
 * CoJSON Seed - Bootstrap → Schemas → Configs → Data → Registry
 */

import { iconInstanceRefFromKey } from '@MaiaOS/factories/icon-instance-ref'
import { getVibeKey } from '@MaiaOS/factories/vibe-keys'
import { OPS_PREFIX } from '@MaiaOS/logs'
import { splitGraphemes } from 'unicode-segmenter/grapheme'
import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'
import { ensureCoValueLoaded } from '../../cojson/crud/collection-helpers.js'
import * as groups from '../../cojson/groups/groups.js'
import { bootstrapAccountRegistries, bootstrapAndScaffold } from './bootstrap.js'
import { seedConfigs } from './configs.js'
import { seedData } from './data.js'
import {
	buildMetaFactoryForSeeding,
	ensureSparkOs,
	removeIdFields,
	sortSchemasByDependency,
} from './helpers.js'
import { loadNanoidRegistryFromSpark } from './nanoid-registry.js'
import { storeRegistry } from './store-registry.js'

const MAIA_SPARK = '°maia'

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

export async function simpleAccountSeed(_account, _node) {
	console.log('✅ Simple account seed: (registries via link)')
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
	const { forceFreshSeed = false, forceMigrate = false } = options

	if (forceFreshSeed && forceMigrate) {
		throw new Error('[CoJSONSeed] forceFreshSeed and forceMigrate are mutually exclusive')
	}

	if (!forceFreshSeed && !forceMigrate) {
		return { skipped: true, reason: 'seed_requires_forceFreshSeed_or_forceMigrate' }
	}

	const { MaiaDB } = await import('../../cojson/core/MaiaDB.js')
	const peer = existingBackend || new MaiaDB({ node, account }, {})

	const needsBootstrap =
		!account.get('registries') || !String(account.get('registries')).startsWith('co_z')
	if (forceMigrate) {
		if (needsBootstrap) {
			throw new Error(
				'[CoJSONSeed] PEER_SYNC_MIGRATE requires an existing scaffold. Run with PEER_SYNC_SEED=true first.',
			)
		}
	} else if (needsBootstrap) {
		const { getAllFactories } = await import('@MaiaOS/factories')
		await bootstrapAndScaffold(account, node, schemas || getAllFactories(), peer.dbEngine)
	}

	const migrateSeedOpts = forceMigrate
		? { migrateMode: true, migrateRegistry: await loadNanoidRegistryFromSpark(peer) }
		: undefined

	const { CoIdRegistry } = await import('@MaiaOS/factories/co-id-generator')
	const { transformForSeeding, validateFactoryStructure } = await import(
		'@MaiaOS/factories/factory-transformer'
	)
	const coIdRegistry = new CoIdRegistry()

	const maiaGroup = await groups.getMaiaGroup(peer)
	if (!maiaGroup || typeof maiaGroup.createMap !== 'function') {
		throw new Error(
			'[CoJSONSeed] °maia spark group not found. Ensure bootstrap has created °maia spark.',
		)
	}
	await bootstrapAccountRegistries(peer, maiaGroup)
	await peer.resolveSystemSparkCoId()

	const uniqueSchemasBy$id = new Map()
	for (const [name, schema] of Object.entries(schemas)) {
		const key = schema.$id || `°maia/factory/${name}`
		if (!uniqueSchemasBy$id.has(key)) uniqueSchemasBy$id.set(key, { name, schema })
	}

	const sortedFactoryKeys = sortSchemasByDependency(uniqueSchemasBy$id)

	await ensureSparkOs(account, node, maiaGroup, peer, undefined)

	const { EXCEPTION_FACTORIES } = await import('../../factories/registry.js')
	let metaSchemaCoId = null
	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (osId) {
		const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
		if (osCore && peer.isAvailable(osCore)) {
			const osContent = peer.getCurrentContent(osCore)
			const factoriesId = osContent?.get?.('factories')
			if (factoriesId) {
				const factoriesCore = await ensureCoValueLoaded(peer, factoriesId, {
					waitForAvailable: true,
				})
				if (factoriesCore && peer.isAvailable(factoriesCore)) {
					const factoriesContent = peer.getCurrentContent(factoriesCore)
					metaSchemaCoId = factoriesContent?.get?.('°maia/factory/meta')
				}
			}
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

	if (!coIdRegistry.has('°maia/factory/meta')) {
		coIdRegistry.register('°maia/factory/meta', metaSchemaCoId)
	}

	const factoryCoIdMap = new Map()
	const factoryCoMaps = new Map()
	const { create: crudCreate } = await import('../../cojson/crud/create.js')
	const { update: crudUpdate } = await import('../../cojson/crud/update.js')

	const existingSchemaRegistry = new Map()
	let factoriesContent = null
	if (osId) {
		const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true })
		if (osCore && peer.isAvailable(osCore)) {
			const osContent = peer.getCurrentContent(osCore)
			const factoriesId = osContent?.get?.('factories')
			if (factoriesId) {
				const factoriesCore = await ensureCoValueLoaded(peer, factoriesId, {
					waitForAvailable: true,
				})
				if (factoriesCore && peer.isAvailable(factoriesCore)) {
					factoriesContent = peer.getCurrentContent(factoriesCore)
					const keys = factoriesContent?.keys?.() ?? Object.keys(factoriesContent ?? {})
					for (const key of keys) {
						const factoryCoId = factoriesContent.get(key)
						if (factoryCoId?.startsWith?.('co_z')) existingSchemaRegistry.set(key, factoryCoId)
					}
				}
			}
		}
	}

	for (const factoryKey of sortedFactoryKeys) {
		const { schema } = uniqueSchemasBy$id.get(factoryKey)
		const { $schema: _s, $factory: _f, $id, id, ...directProperties } = schema
		const cleanedProperties = removeIdFields(directProperties)
		const existingSchemaCoId = existingSchemaRegistry.get(factoryKey)
		let actualCoId
		if (existingSchemaCoId) {
			await crudUpdate(peer, metaSchemaCoId, existingSchemaCoId, cleanedProperties)
			actualCoId = existingSchemaCoId
		} else {
			const createdSchema = await crudCreate(peer, metaSchemaCoId, cleanedProperties)
			actualCoId = createdSchema.id
		}
		factoryCoIdMap.set(factoryKey, actualCoId)
		const factoryCoValueCore = peer.getCoValue(actualCoId)
		if (factoryCoValueCore && peer.isAvailable(factoryCoValueCore)) {
			const factoryCoMapContent = peer.getCurrentContent(factoryCoValueCore)
			if (factoryCoMapContent?.set) factoryCoMaps.set(factoryKey, factoryCoMapContent)
		}
		coIdRegistry.register(factoryKey, actualCoId)
	}

	if (metaSchemaCoId && !factoryCoIdMap.has('°maia/factory/meta')) {
		factoryCoIdMap.set('°maia/factory/meta', metaSchemaCoId)
	}

	// Schema definitions (meta-schema children) must always be CoMaps (have .get for resolution)
	for (const [factoryKey, factoryCoId] of factoryCoIdMap) {
		const core = peer.getCoValue(factoryCoId)
		if (!core || !peer.isAvailable(core)) continue
		const content = peer.getCurrentContent(core)
		const isCoMap = content && typeof content.get === 'function'
		if (!isCoMap) {
			const rawType = content?.type ?? core?.type ?? 'unknown'
			throw new Error(
				`[Seed] Factory definition ${factoryKey} must be CoMap but is ${rawType}. ` +
					'Corrupt data. Clear storage (delete DB file or IndexedDB) and run with PEER_FRESH_SEED=true.',
			)
		}
	}

	const seededSchemas = []
	for (const factoryKey of sortedFactoryKeys) {
		const { name, schema } = uniqueSchemasBy$id.get(factoryKey)
		const factoryCoId = factoryCoIdMap.get(factoryKey)
		const factoryCoMap = factoryCoMaps.get(factoryKey)
		const transformedSchema = transformForSeeding(schema, factoryCoIdMap)
		transformedSchema.$id = `https://maia.city/${factoryCoId}`
		const verificationErrors = validateFactoryStructure(transformedSchema, factoryKey, {
			checkSchemaReferences: true,
			checkNestedCoTypes: false,
		})
		if (verificationErrors.length > 0) {
			throw new Error(
				`[Seed] Factory ${factoryKey} still contains °maia/factory/ references: ${verificationErrors.join('\n')}`,
			)
		}
		const { $schema: _s, $factory: _f, $id: _i, id: _id, ...directProps } = transformedSchema
		const cleanedProperties = removeIdFields(directProps)
		for (const [key, value] of Object.entries(cleanedProperties)) factoryCoMap?.set(key, value)
		seededSchemas.push({ name, key: factoryKey, coId: factoryCoId, coMapId: factoryCoMap?.id })
	}

	await ensureSparkOs(account, node, maiaGroup, peer, factoryCoIdMap)

	const instanceCoIdMap = new Map()

	const getCombinedRegistry = async () => {
		const schemaRegistry = new Map()
		const osId2 = await groups.getSparkOsId(peer, MAIA_SPARK)
		if (osId2) {
			const osCore = node.getCoValue(osId2)
			const osContent = osCore?.getCurrentContent?.()
			const factoriesId = osContent?.get?.('factories')
			if (factoriesId) {
				const factoriesCore = node.getCoValue(factoriesId)
				const factoriesContent = factoriesCore?.getCurrentContent?.()
				const keys =
					typeof factoriesContent.keys === 'function'
						? Array.from(factoriesContent.keys())
						: Object.keys(factoriesContent ?? {})
				for (const key of keys) {
					const coId = factoriesContent.get(key)
					if (coId?.startsWith?.('co_z')) schemaRegistry.set(key, coId)
				}
			}
		}
		if (schemaRegistry.size === 0) {
			for (const [k, v] of factoryCoIdMap) schemaRegistry.set(k, v)
			if (metaSchemaCoId) schemaRegistry.set('°maia/factory/meta', metaSchemaCoId)
		}
		return schemaRegistry
	}

	let combinedRegistry = await getCombinedRegistry()
	if (data) {
		for (const [collectionName] of Object.entries(data)) {
			if (collectionName === 'dashboardIconCotexts') continue
			const factoryKey = `°maia/factory/${collectionName}`
			const dataFactoryKey = `°maia/factory/data/${collectionName}`
			const dataFactoryCoId = combinedRegistry.get(dataFactoryKey) || combinedRegistry.get(factoryKey)
			if (dataFactoryCoId) {
				combinedRegistry.set(factoryKey, dataFactoryCoId)
				combinedRegistry.set(dataFactoryKey, dataFactoryCoId)
				coIdRegistry.register(factoryKey, dataFactoryCoId)
				coIdRegistry.register(dataFactoryKey, dataFactoryCoId)
			}
		}
	}

	const seededConfigs = { configs: [], count: 0 }

	const transformSchemaRefsOnly = (instance, schemaRegistry) => {
		if (!instance || typeof instance !== 'object') return instance
		const transformed = JSON.parse(JSON.stringify(instance))
		const factoryRef = transformed.$factory
		if (factoryRef?.startsWith('°maia/factory/')) {
			const coId = schemaRegistry.get(factoryRef)
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
		const refreshed = new Map(combinedRegistry)
		for (const [key, coId] of instanceCoIdMap) {
			if (coId?.startsWith?.('co_z')) refreshed.set(key, coId)
		}
		for (const [key, coId] of coIdRegistry.getAll()) {
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
			migrateSeedOpts,
		)
		for (const configInfo of seeded.configs || []) {
			instanceCoIdMap.set(configInfo.path, configInfo.coId)
			if (configInfo.expectedCoId) {
				instanceCoIdMap.set(configInfo.expectedCoId, configInfo.coId)
				combinedRegistry.set(configInfo.expectedCoId, configInfo.coId)
				coIdRegistry.register(configInfo.expectedCoId, configInfo.coId)
			}
			coIdRegistry.register(configInfo.path, configInfo.coId)
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
				? Object.values(originalConfigs).find((cfg) => cfg.$id === configInfo.expectedCoId)
				: null
			if (!originalConfig) continue
			const fullyTransformed = transformForSeeding(originalConfig, latestRegistry)
			if (configInfo.type === 'actor') {
				for (const prop of ['process', 'context', 'view', 'interface', 'wasm']) {
					const val = fullyTransformed[prop]
					if (val && typeof val === 'string' && !val.startsWith('co_z')) {
						throw new Error(
							`[Seed] Actor config ${configInfo.expectedCoId} has unresolved ref in ${prop}: ${val}. ` +
								`All refs must be transformed to co-ids during seed. Check transformForSeeding and coIdMap coverage.`,
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
				const { $id, $factory, ...propsToSet } = fullyTransformed
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

	const allVibes = configs?.vibes || []
	const iconCotextRows = data?.dashboardIconCotexts
	if (allVibes.length > 0) {
		if (!Array.isArray(iconCotextRows) || iconCotextRows.length === 0) {
			throw new Error(
				'[CoJSONSeed] data.dashboardIconCotexts required when configs include vibes (from buildSeedConfig)',
			)
		}
		const svgByVibeKey = new Map(iconCotextRows.map((r) => [r.vibeKey, r.svg]))
		combinedRegistry = refreshCombinedRegistry()
		const cotextSchemaCoId = factoryCoIdMap.get('°maia/factory/os/cotext')
		if (!cotextSchemaCoId?.startsWith?.('co_z')) {
			throw new Error(
				'[CoJSONSeed] °maia/factory/os/cotext not registered; cannot seed vibe icon CoTexts',
			)
		}
		for (const vibe of allVibes) {
			const vibeKey = getVibeKey(vibe)
			const iconRef = vibe.icon ?? iconInstanceRefFromKey(vibeKey)
			const svg = svgByVibeKey.get(vibeKey)
			if (typeof svg !== 'string' || !svg.trim()) {
				throw new Error(
					`[CoJSONSeed] data.dashboardIconCotexts missing or empty for vibe "${vibeKey}" (${iconRef})`,
				)
			}
			const graphemes = [...splitGraphemes(svg)]
			const ctx = { node, account, guardian: maiaGroup }
			const { coValue: iconCotext } = await createCoValueForSpark(ctx, null, {
				factory: cotextSchemaCoId,
				cotype: 'colist',
				data: graphemes,
				dataEngine: peer?.dbEngine,
			})
			instanceCoIdMap.set(iconRef, iconCotext.id)
			combinedRegistry.set(iconRef, iconCotext.id)
			coIdRegistry.register(iconRef, iconCotext.id)
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
			const { EXCEPTION_FACTORIES } = await import('../../factories/registry.js')
			const vibesRegistrySchemaCoId =
				factoryCoIdMap?.get('°maia/factory/os/vibes-registry') ??
				(await (
					await import('../../cojson/factory/resolver.js')
				).resolve(peer, '°maia/factory/os/vibes-registry', {
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
			if (
				factoryRef &&
				(factoryRef.startsWith('@') || factoryRef.startsWith('°')) &&
				!combinedRegistry.has(factoryRef)
			) {
				const factoryCoId =
					factoryCoIdMap?.get(factoryRef) ??
					(await (
						await import('../../cojson/factory/resolver.js')
					).resolve(peer, factoryRef, { returnType: 'coId' }))
				if (factoryCoId) combinedRegistry.set(factoryRef, factoryCoId)
			}
			const retransformedVibe = transformForSeeding(vibe, combinedRegistry)
			if (!retransformedVibe.$factory?.startsWith('co_z')) {
				throw new Error(
					`${OPS_PREFIX.sync} Vibe "${vibeKey}": $factory missing or not resolved. Ensure °maia/factory/vibe is in schema registry.`,
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
				migrateSeedOpts,
			)
			seededConfigs.configs.push(...(vibeSeeded.configs || []))
			seededConfigs.count += vibeSeeded.count || 0
			if (vibeSeeded.configs?.length > 0) {
				const vibeCoId = vibeSeeded.configs[0].coId
				vibes?.set?.(vibeKey, vibeCoId)
				if (vibe.$id) {
					instanceCoIdMap.set(vibe.$id, vibeCoId)
					combinedRegistry.set(vibe.$id, vibeCoId)
					coIdRegistry.register(vibe.$id, vibeCoId)
				}
			}
		}
	}

	const seededData = await seedData(account, node, maiaGroup, peer, data, coIdRegistry)

	await storeRegistry(
		account,
		node,
		maiaGroup,
		peer,
		coIdRegistry,
		factoryCoIdMap,
		instanceCoIdMap,
		configs || {},
		seededSchemas,
	)

	peer.strictMode = true

	return {
		metaSchema: metaSchemaCoId,
		schemas: seededSchemas,
		configs: seededConfigs,
		data: seededData,
		registry: coIdRegistry.getAll(),
	}
}
