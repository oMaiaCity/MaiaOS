/**
 * Bootstrap - guardian, scaffold, account.registries
 */

import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'
import { waitForStoreReady } from '../../cojson/crud/read-operations.js'
import { buildMetaSchemaForSeeding, removeIdFields } from './helpers.js'

const MAIA_SPARK = '°Maia'

/**
 * Bootstrap and scaffold when account.registries doesn't exist
 * Order: guardian → account.temp → metaschema → schemata → scaffold → cleanup temp.
 */
export async function bootstrapAndScaffold(account, node, schemas, dbEngine = null) {
	const { EXCEPTION_SCHEMAS } = await import('../../schemas/registry.js')
	const { getAllSchemas } = await import('@MaiaOS/schemata')
	const allSchemas = schemas || getAllSchemas()

	const guardian = node.createGroup()
	const tempGroup = node.createGroup()
	tempGroup.extend(guardian, 'extend')
	const tempCoMap = tempGroup.createMap({}, { $schema: EXCEPTION_SCHEMAS.META_SCHEMA })
	account.set('temp', tempCoMap.id)
	tempCoMap.set('guardian', guardian.id)

	const _metaSchemaMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }
	const tempMetaSchemaDef = buildMetaSchemaForSeeding('co_zTEMP')
	const cleanedTempDef = {
		definition: removeIdFields(tempMetaSchemaDef.definition || tempMetaSchemaDef),
	}
	const { coValue: metaSchemaCoMap } = await createCoValueForSpark(
		{ node, account, guardian },
		null,
		{
			schema: EXCEPTION_SCHEMAS.META_SCHEMA,
			cotype: 'comap',
			data: cleanedTempDef,
			dataEngine: dbEngine,
		},
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
				for (const item of Array.isArray(v) ? v : [v]) {
					if (item && typeof item === 'object') {
						for (const r of findCoRefs(item, visited)) refs.add(r)
					}
				}
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
			dataEngine: dbEngine,
			isSchemaDefinition: true,
		})
		const coId = schemaCoMap.id
		schemaCoIdMap.set(schemaKey, coId)
		tempCoMap.set(schemaKey, coId)
	}

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

	const ctx = { node, account, guardian }
	const scaffoldOpts = (schema, data) => ({ schema, cotype: 'comap', data, dataEngine: dbEngine })
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
	os.set('schematas', schematas.id)
	os.set('indexes', indexes.id)
	maiaSpark.set('os', os.id)
	maiaSpark.set('vibes', vibes.id)
	schematas.set('°Maia/schema/meta', metaSchemaCoId)
	for (const [k, coId] of schemaCoIdMap) schematas.set(k, coId)

	const { removeGroupMember } = await import('../../cojson/groups/groups.js')
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
		} catch (_e) {}
	}
	account.set('registries', registries.id)

	if (typeof account.delete === 'function') account.delete('temp')

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
		'✅ Bootstrap scaffold complete: account.registries, °Maia spark, os, schematas, indexes, vibes',
	)
}

/**
 * Bootstrap account.registries (sync agent only, during genesis seed)
 */
export async function bootstrapAccountRegistries(peer, maiaGroup) {
	const registriesId = peer.account?.get('registries')
	if (!registriesId?.startsWith('co_z')) return
	const registriesStore = await peer.read(null, registriesId)
	await waitForStoreReady(registriesStore, registriesId, 10000)
	const registriesData = registriesStore?.value
	if (!registriesData || registriesData.error) return
	const sparksId = registriesData.sparks
	if (!sparksId?.startsWith('co_z')) return
	const sparksStore = await peer.read(null, sparksId)
	await waitForStoreReady(sparksStore, sparksId, 10000)
	const sparksData = sparksStore?.value
	if (!sparksData || sparksData.error) return
	const maiaSparkCoId = sparksData[MAIA_SPARK]
	if (!maiaSparkCoId || !maiaSparkCoId.startsWith('co_z')) return

	const sparkCore = peer.getCoValue(maiaSparkCoId)
	if (!sparkCore) return
	if (!peer.isAvailable(sparkCore)) {
		await new Promise((resolve, reject) => {
			const t = setTimeout(() => reject(new Error('Timeout')), 10000)
			const unsub = sparkCore.subscribe((c) => {
				if (c && peer.isAvailable(c)) {
					clearTimeout(t)
					unsub?.()
					resolve()
				}
			})
		})
	}
	const sparkContent = peer.getCurrentContent(sparkCore)
	if (!sparkContent || typeof sparkContent.get !== 'function') return

	const { EXCEPTION_SCHEMAS } = await import('../../schemas/registry.js')
	const node = peer.node

	const osId = sparkContent.get('os')
	if (!osId || !osId.startsWith('co_z')) return
	const osCore = peer.getCoValue(osId)
	if (!osCore || !peer.isAvailable(osCore)) return
	const osContent = peer.getCurrentContent(osCore)
	if (!osContent || typeof osContent.get !== 'function') return
	const capabilitiesId = osContent.get('capabilities')
	if (!capabilitiesId || !capabilitiesId.startsWith('co_z')) return
	const capabilitiesCore = peer.getCoValue(capabilitiesId)
	if (!capabilitiesCore || !peer.isAvailable(capabilitiesCore)) return
	const capabilitiesContent = peer.getCurrentContent(capabilitiesCore)
	if (!capabilitiesContent || typeof capabilitiesContent.set !== 'function') return

	const { resolve } = await import('../../cojson/schema/resolver.js')
	const registriesSchemaCoId = await resolve(peer, '°Maia/schema/os/registries', {
		returnType: 'coId',
	})
	const sparksRegistrySchemaCoId = await resolve(peer, '°Maia/schema/os/sparks-registry', {
		returnType: 'coId',
	})
	const humansRegistrySchemaCoId = await resolve(peer, '°Maia/schema/os/humans-registry', {
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

	const { removeGroupMember } = await import('../../cojson/groups/groups.js')
	const account = peer.account
	const memberIdToRemove =
		typeof node.getCurrentAccountOrAgentID === 'function'
			? node.getCurrentAccountOrAgentID()
			: (account?.id ?? account?.$jazz?.id)

	const existingRegistriesId = account.get('registries')
	let registriesContent = null
	if (existingRegistriesId?.startsWith('co_z')) {
		const registriesCore = peer.getCoValue(existingRegistriesId)
		if (registriesCore && peer.isAvailable(registriesCore)) {
			registriesContent = peer.getCurrentContent(registriesCore)
		}
	}
	if (!registriesContent || typeof registriesContent.set !== 'function') {
		const registriesGroup = node.createGroup()
		registriesGroup.extend(maiaGroup, 'extend')
		registriesGroup.addMember('everyone', 'reader')
		const registries = registriesGroup.createMap({}, registriesMeta)
		try {
			await removeGroupMember(registriesGroup, memberIdToRemove)
		} catch (_e) {}
		account.set('registries', registries.id)
		registriesContent = registries
	}

	const sparksRegistryId = registriesContent.get('sparks')
	let sparksContent = null
	if (sparksRegistryId) {
		const sparksCore = peer.getCoValue(sparksRegistryId)
		if (sparksCore && peer.isAvailable(sparksCore)) {
			sparksContent = peer.getCurrentContent(sparksCore)
		}
	}
	if (!sparksContent || typeof sparksContent.set !== 'function') {
		const sparksGroup = node.createGroup()
		sparksGroup.extend(maiaGroup, 'extend')
		sparksGroup.addMember('everyone', 'reader')
		const sparks = sparksGroup.createMap({}, sparksRegistryMeta)
		try {
			await removeGroupMember(sparksGroup, memberIdToRemove)
		} catch (_e) {}
		registriesContent.set('sparks', sparks.id)
		sparksContent = sparks
	}

	sparksContent.set(MAIA_SPARK, maiaSparkCoId)

	const humansRegistryId = registriesContent.get('humans')
	let humansContent = null
	if (humansRegistryId) {
		const humansCore = peer.getCoValue(humansRegistryId)
		if (humansCore && peer.isAvailable(humansCore)) {
			humansContent = peer.getCurrentContent(humansCore)
		}
	}
	if (!humansContent || typeof humansContent.set !== 'function') {
		const humansGroup = node.createGroup()
		humansGroup.extend(maiaGroup, 'extend')
		humansGroup.addMember('everyone', 'reader')
		const humans = humansGroup.createMap({}, humansRegistryMeta)
		try {
			await removeGroupMember(humansGroup, memberIdToRemove)
		} catch (_e) {}
		registriesContent.set('humans', humans.id)
	}

	console.log('✅ account.registries bootstrapped (sparks[°Maia], humans)')
}
