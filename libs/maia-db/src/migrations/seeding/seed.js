/**
 * CoJSON Seed Operation - Seed database with configs, schemas, and initial data
 *
 * Model: PEER_FRESH_SEED=true → bootstrap + seed (clean slate).
 *        PEER_FRESH_SEED=false → use existing scaffold, no seed, no cleanup.
 *
 * Seeding Order: Bootstrap → Schemas → Configs → Data → Registry
 * Extracted modules: bootstrap, configs, data, store-registry, helpers
 */

import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'
import { ensureCoValueLoaded } from '../../cojson/crud/collection-helpers.js'
import * as groups from '../../cojson/groups/groups.js'
import { bootstrapAccountRegistries, bootstrapAndScaffold } from './bootstrap.js'
import { seedConfigs } from './configs.js'
import { seedData } from './data.js'
import { buildMetaSchemaForSeeding, ensureSparkOs, removeIdFields } from './helpers.js'
import { storeRegistry } from './store-registry.js'

const MAIA_SPARK = '°Maia'

const REFERENCE_PROPS = [
	'actor',
	'context',
	'view',
	'state',
	'process',
	'brand',
	'style',
	'inbox',
	'subscribers',
	'tool',
]
const NESTED_REF_PROPS = ['states']

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
	const { forceFreshSeed = false } = options

	if (!forceFreshSeed) {
		return { skipped: true, reason: 'seed_requires_forceFreshSeed' }
	}

	const { MaiaDB } = await import('../../cojson/core/MaiaDB.js')
	const peer = existingBackend || new MaiaDB({ node, account }, { systemSpark: '°Maia' })

	let needsBootstrap = true
	if (!needsBootstrap) {
		needsBootstrap =
			!account.get('registries') || !String(account.get('registries')).startsWith('co_z')
	}
	if (needsBootstrap) {
		const { getAllSchemas } = await import('@MaiaOS/schemata')
		await bootstrapAndScaffold(account, node, schemas || getAllSchemas(), peer.dbEngine)
	}

	const { CoIdRegistry } = await import('@MaiaOS/schemata/co-id-generator')
	const { transformForSeeding, validateSchemaStructure } = await import(
		'@MaiaOS/schemata/schema-transformer'
	)
	const coIdRegistry = new CoIdRegistry()

	const maiaGroup = await groups.getMaiaGroup(peer)
	if (!maiaGroup || typeof maiaGroup.createMap !== 'function') {
		throw new Error(
			'[CoJSONSeed] °Maia spark group not found. Ensure bootstrap has created °Maia spark.',
		)
	}
	await bootstrapAccountRegistries(peer, maiaGroup)

	const uniqueSchemasBy$id = new Map()
	for (const [name, schema] of Object.entries(schemas)) {
		const key = schema.$id || `°Maia/schema/${name}`
		if (!uniqueSchemasBy$id.has(key)) uniqueSchemasBy$id.set(key, { name, schema })
	}

	const findCoReferences = (obj, visited = new Set()) => {
		if (!obj || typeof obj !== 'object' || visited.has(obj)) return new Set()
		visited.add(obj)
		const refs = new Set()
		if (obj.$co && typeof obj.$co === 'string' && obj.$co.startsWith('°Maia/schema/'))
			refs.add(obj.$co)
		for (const v of Object.values(obj)) {
			if (v && typeof v === 'object') {
				for (const item of Array.isArray(v) ? v : [v]) {
					if (item && typeof item === 'object') {
						for (const r of findCoReferences(item, visited)) refs.add(r)
					}
				}
			}
		}
		return refs
	}
	const schemaDependencies = new Map()
	for (const [schemaKey, { schema }] of uniqueSchemasBy$id) {
		schemaDependencies.set(schemaKey, findCoReferences(schema))
	}

	const sortedSchemaKeys = []
	const processed = new Set()
	const processing = new Set()
	const visitSchema = (schemaKey) => {
		if (processed.has(schemaKey) || processing.has(schemaKey)) return
		processing.add(schemaKey)
		for (const dep of schemaDependencies.get(schemaKey) || []) {
			if (dep.startsWith('°Maia/schema/') && uniqueSchemasBy$id.has(dep)) visitSchema(dep)
		}
		processing.delete(schemaKey)
		processed.add(schemaKey)
		sortedSchemaKeys.push(schemaKey)
	}
	for (const schemaKey of uniqueSchemasBy$id.keys()) {
		if (schemaKey !== '°Maia/schema/meta') visitSchema(schemaKey)
	}

	await ensureSparkOs(account, node, maiaGroup, peer, undefined)

	const { EXCEPTION_SCHEMAS } = await import('../../schemas/registry.js')
	let metaSchemaCoId = null
	const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
	if (osId) {
		const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true, timeoutMs: 2000 })
		if (osCore && peer.isAvailable(osCore)) {
			const osContent = peer.getCurrentContent(osCore)
			const schematasId = osContent?.get?.('schematas')
			if (schematasId) {
				const schematasCore = await ensureCoValueLoaded(peer, schematasId, {
					waitForAvailable: true,
					timeoutMs: 2000,
				})
				if (schematasCore && peer.isAvailable(schematasCore)) {
					const schematasContent = peer.getCurrentContent(schematasCore)
					metaSchemaCoId = schematasContent?.get?.('°Maia/schema/meta')
				}
			}
		}
	}

	if (!metaSchemaCoId) {
		const tempMetaSchemaDef = buildMetaSchemaForSeeding('co_zTEMP')
		const cleanedTempDef = {
			definition: removeIdFields(tempMetaSchemaDef.definition || tempMetaSchemaDef),
		}
		const { coValue: metaSchemaCoMap } = await createCoValueForSpark(
			{ node, account, guardian: maiaGroup },
			null,
			{ schema: EXCEPTION_SCHEMAS.META_SCHEMA, cotype: 'comap', data: cleanedTempDef },
		)
		const actualMetaSchemaCoId = metaSchemaCoMap.id
		const updatedMetaSchemaDef = buildMetaSchemaForSeeding(actualMetaSchemaCoId)
		const { $schema, $id, id, ...directProperties } =
			updatedMetaSchemaDef.definition || updatedMetaSchemaDef
		const cleanedProperties = removeIdFields(directProperties)
		for (const [key, value] of Object.entries(cleanedProperties)) metaSchemaCoMap.set(key, value)
		metaSchemaCoId = actualMetaSchemaCoId
	} else {
		const updatedMetaSchemaDef = buildMetaSchemaForSeeding(metaSchemaCoId)
		const { $schema, $id, id, ...directProperties } =
			updatedMetaSchemaDef.definition || updatedMetaSchemaDef
		const cleanedProperties = removeIdFields(directProperties)
		const metaSchemaCore = await ensureCoValueLoaded(peer, metaSchemaCoId, {
			waitForAvailable: true,
			timeoutMs: 2000,
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

	if (!coIdRegistry.has('°Maia/schema/meta')) {
		coIdRegistry.register('°Maia/schema/meta', metaSchemaCoId)
	}

	const schemaCoIdMap = new Map()
	const schemaCoMaps = new Map()
	const { create: crudCreate } = await import('../../cojson/crud/create.js')
	const { update: crudUpdate } = await import('../../cojson/crud/update.js')

	const existingSchemaRegistry = new Map()
	let schematasContent = null
	if (osId) {
		const osCore = await ensureCoValueLoaded(peer, osId, { waitForAvailable: true, timeoutMs: 2000 })
		if (osCore && peer.isAvailable(osCore)) {
			const osContent = peer.getCurrentContent(osCore)
			const schematasId = osContent?.get?.('schematas')
			if (schematasId) {
				const schematasCore = await ensureCoValueLoaded(peer, schematasId, {
					waitForAvailable: true,
					timeoutMs: 2000,
				})
				if (schematasCore && peer.isAvailable(schematasCore)) {
					schematasContent = peer.getCurrentContent(schematasCore)
					const keys = schematasContent?.keys?.() ?? Object.keys(schematasContent ?? {})
					for (const key of keys) {
						const schemaCoId = schematasContent.get(key)
						if (schemaCoId?.startsWith?.('co_z')) existingSchemaRegistry.set(key, schemaCoId)
					}
				}
			}
		}
	}

	for (const schemaKey of sortedSchemaKeys) {
		const { schema } = uniqueSchemasBy$id.get(schemaKey)
		const { $schema, $id, id, ...directProperties } = schema
		const cleanedProperties = removeIdFields(directProperties)
		const existingSchemaCoId = existingSchemaRegistry.get(schemaKey)
		let actualCoId
		if (existingSchemaCoId) {
			await crudUpdate(peer, metaSchemaCoId, existingSchemaCoId, cleanedProperties)
			actualCoId = existingSchemaCoId
		} else {
			const createdSchema = await crudCreate(peer, metaSchemaCoId, cleanedProperties)
			actualCoId = createdSchema.id
		}
		schemaCoIdMap.set(schemaKey, actualCoId)
		const schemaCoValueCore = peer.getCoValue(actualCoId)
		if (schemaCoValueCore && peer.isAvailable(schemaCoValueCore)) {
			const schemaCoMapContent = peer.getCurrentContent(schemaCoValueCore)
			if (schemaCoMapContent?.set) schemaCoMaps.set(schemaKey, schemaCoMapContent)
		}
		coIdRegistry.register(schemaKey, actualCoId)
	}

	if (metaSchemaCoId && !schemaCoIdMap.has('°Maia/schema/meta')) {
		schemaCoIdMap.set('°Maia/schema/meta', metaSchemaCoId)
	}

	// Schema definitions (meta-schema children) must always be CoMaps (have .get for resolution)
	for (const [schemaKey, schemaCoId] of schemaCoIdMap) {
		const core = peer.getCoValue(schemaCoId)
		if (!core || !peer.isAvailable(core)) continue
		const content = peer.getCurrentContent(core)
		const isCoMap = content && typeof content.get === 'function'
		if (!isCoMap) {
			const rawType = content?.type ?? core?.type ?? 'unknown'
			throw new Error(
				`[Seed] Schema definition ${schemaKey} must be CoMap but is ${rawType}. ` +
					'Corrupt data. Clear storage (delete DB file or IndexedDB) and run with PEER_FRESH_SEED=true.',
			)
		}
	}

	const seededSchemas = []
	for (const schemaKey of sortedSchemaKeys) {
		const { name, schema } = uniqueSchemasBy$id.get(schemaKey)
		const schemaCoId = schemaCoIdMap.get(schemaKey)
		const schemaCoMap = schemaCoMaps.get(schemaKey)
		const transformedSchema = transformForSeeding(schema, schemaCoIdMap)
		transformedSchema.$id = `https://maia.city/${schemaCoId}`
		const verificationErrors = validateSchemaStructure(transformedSchema, schemaKey, {
			checkSchemaReferences: true,
			checkNestedCoTypes: false,
		})
		if (verificationErrors.length > 0) {
			throw new Error(
				`[Seed] Schema ${schemaKey} still contains °Maia/schema/ references: ${verificationErrors.join('\n')}`,
			)
		}
		const { $schema: _s, $id: _i, id: _id, ...directProps } = transformedSchema
		const cleanedProperties = removeIdFields(directProps)
		for (const [key, value] of Object.entries(cleanedProperties)) schemaCoMap?.set(key, value)
		seededSchemas.push({ name, key: schemaKey, coId: schemaCoId, coMapId: schemaCoMap?.id })
	}

	await ensureSparkOs(account, node, maiaGroup, peer, schemaCoIdMap)

	const instanceCoIdMap = new Map()

	const getCombinedRegistry = async () => {
		const schemaRegistry = new Map()
		const osId2 = await groups.getSparkOsId(peer, MAIA_SPARK)
		if (osId2) {
			const osCore = node.getCoValue(osId2)
			const osContent = osCore?.getCurrentContent?.()
			const schematasId = osContent?.get?.('schematas')
			if (schematasId) {
				const schematasCore = node.getCoValue(schematasId)
				const schematasContent = schematasCore?.getCurrentContent?.()
				const keys =
					typeof schematasContent.keys === 'function'
						? Array.from(schematasContent.keys())
						: Object.keys(schematasContent ?? {})
				for (const key of keys) {
					const coId = schematasContent.get(key)
					if (coId?.startsWith?.('co_z')) schemaRegistry.set(key, coId)
				}
			}
		}
		if (schemaRegistry.size === 0) {
			for (const [k, v] of schemaCoIdMap) schemaRegistry.set(k, v)
			if (metaSchemaCoId) schemaRegistry.set('°Maia/schema/meta', metaSchemaCoId)
		}
		return schemaRegistry
	}

	let combinedRegistry = await getCombinedRegistry()
	if (data) {
		for (const [collectionName] of Object.entries(data)) {
			const schemaKey = `°Maia/schema/${collectionName}`
			const dataSchemaKey = `°Maia/schema/data/${collectionName}`
			const dataSchemaCoId = combinedRegistry.get(dataSchemaKey) || combinedRegistry.get(schemaKey)
			if (dataSchemaCoId) {
				combinedRegistry.set(schemaKey, dataSchemaCoId)
				combinedRegistry.set(dataSchemaKey, dataSchemaCoId)
				coIdRegistry.register(schemaKey, dataSchemaCoId)
				coIdRegistry.register(dataSchemaKey, dataSchemaCoId)
			}
		}
	}

	const seededConfigs = { configs: [], count: 0 }
	const transformSchemaRefsOnly = (instance, schemaRegistry) => {
		if (!instance || typeof instance !== 'object') return instance
		const transformed = JSON.parse(JSON.stringify(instance))
		if (transformed.$schema?.startsWith('°Maia/schema/')) {
			const coId = schemaRegistry.get(transformed.$schema)
			if (coId) transformed.$schema = coId
		}
		for (const prop of REFERENCE_PROPS) delete transformed[prop]
		for (const prop of NESTED_REF_PROPS) {
			if (prop === 'states' && transformed.initial) {
				transformed.states = Object.fromEntries(
					Object.keys(transformed.states || {}).map((k) => [k, {}]),
				)
			} else {
				delete transformed[prop]
			}
		}
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
			schemaCoMaps,
			schemaCoIdMap,
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

	// Process before actors: actor configs reference process, so process must be seeded first
	const CONFIG_ORDER = [
		['styles', 'styles'],
		['inboxes', 'inboxes'],
		['tools', 'tools'],
		['processes', 'processes'],
		['actors', 'actors'],
		['views', 'views'],
		['contexts', 'contexts'],
		['states', 'states'],
		['interfaces', 'interfaces'],
		['subscriptions', 'subscriptions'],
		['children', 'children'],
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
			// Post-transform validation: actor configs must have co-ids for process, context, view
			if (configInfo.type === 'actor') {
				const refProps = ['process', 'context', 'view']
				for (const prop of refProps) {
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
				const { $id, $schema, ...propsToSet } = fullyTransformed
				for (const [key, value] of Object.entries(propsToSet)) coValue.set(key, value)
				updatedCount++
			}
		}
		return updatedCount
	}

	if (configs) {
		const updateOrder = [
			['subscription', 'subscriptions'],
			['inbox', 'inboxes'],
			['children', 'children'],
			['tool', 'tools'],
			['actor', 'actors'],
			['view', 'views'],
			['context', 'contexts'],
			['process', 'processes'],
			['state', 'states'],
			['interface', 'interfaces'],
		]
		for (const [type, prop] of updateOrder) {
			const toUpdate = seededConfigs.configs.filter((c) => c.type === type)
			const originals = configs[prop]
			if (toUpdate.length && originals) await updateConfigReferences(toUpdate, originals)
		}
	}

	const allAgents = configs?.agents || []
	if (allAgents.length > 0) {
		combinedRegistry = refreshCombinedRegistry()
		let agents = null
		const agentsId = await groups.getSparkAgentsId(peer, MAIA_SPARK)
		if (agentsId) {
			const agentsCore = await ensureCoValueLoaded(peer, agentsId, {
				waitForAvailable: true,
				timeoutMs: 5000,
			})
			if (agentsCore?.type === 'comap' && peer.isAvailable(agentsCore)) {
				agents = agentsCore.getCurrentContent?.()
			}
		}
		if (!agents) {
			const { EXCEPTION_SCHEMAS } = await import('../../schemas/registry.js')
			const agentsSchemaCoId =
				schemaCoIdMap?.get('°Maia/schema/os/agents-registry') ??
				(await (
					await import('../../cojson/schema/resolver.js')
				).resolve(peer, '°Maia/schema/os/agents-registry', {
					returnType: 'coId',
				}))
			const { coValue: agentsCoMap } = await createCoValueForSpark(
				{ node, account, guardian: maiaGroup },
				null,
				{
					schema: agentsSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA,
					cotype: 'comap',
					data: {},
					dataEngine: peer?.dbEngine,
				},
			)
			agents = agentsCoMap
			await groups.setSparkAgentsId(peer, MAIA_SPARK, agents.id)
		}
		for (const agent of allAgents) {
			const originalAgentId = agent.$id || ''
			const agentKey = originalAgentId.startsWith('°Maia/agent/')
				? originalAgentId.replace('°Maia/agent/', '')
				: (agent.name || 'default').toLowerCase().replace(/\s+/g, '-')
			const schemaRef = agent.$schema
			if (
				schemaRef &&
				(schemaRef.startsWith('@') || schemaRef.startsWith('°')) &&
				!combinedRegistry.has(schemaRef)
			) {
				const schemaCoId =
					schemaCoIdMap?.get(schemaRef) ??
					(await (
						await import('../../cojson/schema/resolver.js')
					).resolve(peer, schemaRef, { returnType: 'coId' }))
				if (schemaCoId) combinedRegistry.set(schemaRef, schemaCoId)
			}
			const retransformedAgent = transformForSeeding(agent, combinedRegistry)
			if (!retransformedAgent.$schema?.startsWith('co_z')) {
				throw new Error(
					`[sync] Agent "${agentKey}": $schema missing or not resolved. Ensure °Maia/schema/agent is in schema registry.`,
				)
			}
			const agentSeeded = await seedConfigs(
				account,
				node,
				maiaGroup,
				peer,
				{ agent: retransformedAgent },
				instanceCoIdMap,
				schemaCoMaps,
				schemaCoIdMap,
			)
			seededConfigs.configs.push(...(agentSeeded.configs || []))
			seededConfigs.count += agentSeeded.count || 0
			if (agentSeeded.configs?.length > 0) {
				const agentCoId = agentSeeded.configs[0].coId
				agents?.set?.(agentKey, agentCoId)
				if (agent.$id) {
					instanceCoIdMap.set(agent.$id, agentCoId)
					combinedRegistry.set(agent.$id, agentCoId)
					coIdRegistry.register(agent.$id, agentCoId)
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
		schemaCoIdMap,
		instanceCoIdMap,
		configs || {},
		seededSchemas,
	)

	const { indexCoValue } = await import('../../cojson/indexing/schema-index-manager.js')
	const allSeededCoIds = [
		...(seededConfigs.configs || []).map((c) => c.coId).filter(Boolean),
		...(seededData.coIds || []),
	]
	for (const coId of allSeededCoIds) {
		if (coId?.startsWith?.('co_z')) {
			try {
				if (peer.node?.loadCoValueCore) await peer.node.loadCoValueCore(coId).catch(() => {})
				await indexCoValue(peer, coId)
			} catch (e) {
				console.error('[Seed] Re-index pass failed for', coId, e)
			}
		}
	}

	return {
		metaSchema: metaSchemaCoId,
		schemas: seededSchemas,
		configs: seededConfigs,
		data: seededData,
		registry: coIdRegistry.getAll(),
	}
}
