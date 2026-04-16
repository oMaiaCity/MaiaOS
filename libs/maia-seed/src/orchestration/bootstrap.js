/**
 * Bootstrap - guardian, scaffold, account.registries
 */

import {
	createCoValueForSpark,
	SPARK_OS_META_FACTORY_CO_ID_KEY,
	waitForStoreReady,
} from '@MaiaOS/db'
import { maiaFactoryRefToNanoid } from '@MaiaOS/validation/identity-from-maia-path.js'
import { removeIdFields } from '@MaiaOS/validation/remove-id-fields'
import { seedDefinitionCatalogBootstrap } from './definition-catalog-bootstrap.js'
import { buildMetaFactoryForSeeding, sortSchemasByDependency } from './helpers.js'

const MAIA_SPARK = '°maia'

/**
 * Bootstrap and scaffold when account.registries doesn't exist
 * Order: guardian → account.temp → metaschema → factories → scaffold → cleanup temp.
 */
export async function bootstrapAndScaffold(account, node, schemas, dbEngine = null) {
	const { EXCEPTION_FACTORIES } = await import('@MaiaOS/db/registry')
	const { getAllFactories } = await import('@MaiaOS/validation/factory-registry')
	const allSchemas = schemas || getAllFactories()

	const guardian = node.createGroup()
	const tempGroup = node.createGroup()
	tempGroup.extend(guardian, 'extend')
	const tempCoMap = tempGroup.createMap({}, { $factory: EXCEPTION_FACTORIES.META_SCHEMA })
	account.set('temp', tempCoMap.id)
	tempCoMap.set('guardian', guardian.id)

	const _metaSchemaMeta = { $factory: EXCEPTION_FACTORIES.META_SCHEMA }
	const tempMetaSchemaDef = buildMetaFactoryForSeeding('co_zTEMP')
	const cleanedTempDef = {
		definition: removeIdFields(tempMetaSchemaDef.definition || tempMetaSchemaDef),
	}
	const { coValue: metaSchemaCoMap } = await createCoValueForSpark(
		{ node, account, guardian },
		null,
		{
			factory: EXCEPTION_FACTORIES.META_SCHEMA,
			cotype: 'comap',
			data: cleanedTempDef,
			dataEngine: dbEngine,
		},
	)
	const metaSchemaCoId = metaSchemaCoMap.id
	const updatedMetaSchemaDef = buildMetaFactoryForSeeding(metaSchemaCoId)
	const {
		$schema: _s,
		$factory: _f,
		$id: _i,
		id: _id,
		...directProps
	} = updatedMetaSchemaDef.definition || updatedMetaSchemaDef
	for (const [k, v] of Object.entries(removeIdFields(directProps))) metaSchemaCoMap.set(k, v)
	tempCoMap.set('metaschema', metaSchemaCoId)

	const uniqueSchemasByLabel = new Map()
	for (const [name, schema] of Object.entries(allSchemas)) {
		const key = schema.$label || `°maia/factory/${name}`
		if (!uniqueSchemasByLabel.has(key)) uniqueSchemasByLabel.set(key, { name, schema })
	}
	const sorted = sortSchemasByDependency(uniqueSchemasByLabel)

	const factoryCoIdMap = new Map()
	const ctx = { node, account, guardian }
	for (const factoryKey of sorted) {
		const { schema } = uniqueSchemasByLabel.get(factoryKey)
		const { $schema, $label: _lb, $nanoid: _nn, $id: _legacy, id, ...props } = schema
		const cleaned = removeIdFields(props)

		const { coValue: factoryCoMap } = await createCoValueForSpark(ctx, null, {
			factory: metaSchemaCoId,
			cotype: 'comap',
			data: cleaned,
			dataEngine: dbEngine,
			isFactoryDefinition: true,
		})
		const coId = factoryCoMap.id
		const factoryNanoid =
			typeof _nn === 'string' && _nn.length > 0 ? _nn : maiaFactoryRefToNanoid(factoryKey)
		if (!factoryNanoid) {
			throw new Error(`[bootstrap] Missing $nanoid for factory ${factoryKey}`)
		}
		factoryCoIdMap.set(factoryNanoid, coId)
		tempCoMap.set(factoryKey, coId)
	}

	const sparkSchemaCoId =
		tempCoMap.get('°maia/factory/spark.factory.maia') || EXCEPTION_FACTORIES.META_SCHEMA
	const osSchemaCoId =
		tempCoMap.get('°maia/factory/os-registry.factory.maia') || EXCEPTION_FACTORIES.META_SCHEMA
	const groupsSchemaCoId =
		tempCoMap.get('°maia/factory/groups.factory.maia') || EXCEPTION_FACTORIES.META_SCHEMA
	const indexesSchemaCoId =
		tempCoMap.get('°maia/factory/indexes-registry.factory.maia') || EXCEPTION_FACTORIES.META_SCHEMA
	const vibesRegistrySchemaCoId =
		tempCoMap.get('°maia/factory/vibes-registry.factory.maia') ?? EXCEPTION_FACTORIES.META_SCHEMA

	const scaffoldOpts = (factory, data) => ({ factory, cotype: 'comap', data, dataEngine: dbEngine })
	const { coValue: maiaSpark } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(sparkSchemaCoId, { name: '°maia' }),
	)
	const { coValue: os } = await createCoValueForSpark(ctx, null, scaffoldOpts(osSchemaCoId, {}))
	const { coValue: groups } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(groupsSchemaCoId, {}),
	)
	groups.set('guardian', guardian.id)
	os.set('groups', groups.id)
	os.set(SPARK_OS_META_FACTORY_CO_ID_KEY, metaSchemaCoId)
	const { coValue: indexes } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(indexesSchemaCoId, {}),
	)
	const { coValue: vibes } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(vibesRegistrySchemaCoId, {}),
	)
	os.set('indexes', indexes.id)
	os.set('vibes', vibes.id)
	maiaSpark.set('os', os.id)
	await seedDefinitionCatalogBootstrap(ctx, indexes, metaSchemaCoId, factoryCoIdMap, dbEngine)

	const { removeGroupMember } = await import('@MaiaOS/db')
	const memberIdToRemove = account?.id ?? account?.$jazz?.id
	const registriesMeta = { $factory: EXCEPTION_FACTORIES.META_SCHEMA }

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

	const avensGroup = node.createGroup()
	avensGroup.extend(guardian, 'extend')
	avensGroup.addMember('everyone', 'reader')
	const avensIdentityRegistry = avensGroup.createMap({}, registriesMeta)
	registries.set('avens', avensIdentityRegistry.id)

	for (const g of [registriesGroup, sparksGroup, humansGroup, avensGroup]) {
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
		'✅ Bootstrap scaffold complete: account.registries, °maia spark, os, metaFactoryCoId, indexes (definition catalog), vibes',
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
	if (!maiaSparkCoId?.startsWith('co_z')) return
	// Seed runs bootstrapAccountRegistries before MaiaDB.resolveSystemSparkCoId(); resolver needs this for namekey lookups.
	peer.systemSparkCoId = maiaSparkCoId

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

	const { EXCEPTION_FACTORIES } = await import('@MaiaOS/db/registry')
	const node = peer.node

	const osId = sparkContent.get('os')
	if (!osId?.startsWith('co_z')) return
	const osCore = peer.getCoValue(osId)
	if (!osCore || !peer.isAvailable(osCore)) return
	const osContent = peer.getCurrentContent(osCore)
	if (!osContent || typeof osContent.get !== 'function') return
	const groupsId = osContent.get('groups')
	if (!groupsId?.startsWith('co_z')) return
	const groupsCore = peer.getCoValue(groupsId)
	if (!groupsCore || !peer.isAvailable(groupsCore)) return
	const groupsContent = peer.getCurrentContent(groupsCore)
	if (!groupsContent || typeof groupsContent.set !== 'function') return

	const { lookupRegistryKey } = await import('@MaiaOS/db')
	const registriesSchemaCoId = await lookupRegistryKey(
		peer,
		'°maia/factory/registries.factory.maia',
		{
			returnType: 'coId',
		},
	)
	const sparksRegistrySchemaCoId = await lookupRegistryKey(
		peer,
		'°maia/factory/sparks-registry.factory.maia',
		{
			returnType: 'coId',
		},
	)
	const humansRegistrySchemaCoId = await lookupRegistryKey(
		peer,
		'°maia/factory/humans-registry.factory.maia',
		{
			returnType: 'coId',
		},
	)
	const avensIdentityRegistrySchemaCoId = await lookupRegistryKey(
		peer,
		'°maia/factory/avens-identity-registry.factory.maia',
		{
			returnType: 'coId',
		},
	)
	const registriesMeta = registriesSchemaCoId
		? { $factory: registriesSchemaCoId }
		: { $factory: EXCEPTION_FACTORIES.META_SCHEMA }
	const sparksRegistryMeta = sparksRegistrySchemaCoId
		? { $factory: sparksRegistrySchemaCoId }
		: { $factory: EXCEPTION_FACTORIES.META_SCHEMA }
	const humansRegistryMeta = humansRegistrySchemaCoId
		? { $factory: humansRegistrySchemaCoId }
		: { $factory: EXCEPTION_FACTORIES.META_SCHEMA }
	const avensIdentityRegistryMeta = avensIdentityRegistrySchemaCoId
		? { $factory: avensIdentityRegistrySchemaCoId }
		: { $factory: EXCEPTION_FACTORIES.META_SCHEMA }

	const { removeGroupMember } = await import('@MaiaOS/db')
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

	const avensRegistryId = registriesContent.get('avens')
	let avensContent = null
	if (avensRegistryId) {
		const avensCore = peer.getCoValue(avensRegistryId)
		if (avensCore && peer.isAvailable(avensCore)) {
			avensContent = peer.getCurrentContent(avensCore)
		}
	}
	if (!avensContent || typeof avensContent.set !== 'function') {
		const avensGroup = node.createGroup()
		avensGroup.extend(maiaGroup, 'extend')
		avensGroup.addMember('everyone', 'reader')
		const avens = avensGroup.createMap({}, avensIdentityRegistryMeta)
		try {
			await removeGroupMember(avensGroup, memberIdToRemove)
		} catch (_e) {}
		registriesContent.set('avens', avens.id)
	}

	console.log('✅ account.registries bootstrapped (sparks[°maia], humans, avens)')
}
