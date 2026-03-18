/**
 * Bootstrap - guardian, scaffold, account.registries
 */

import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'
import { waitForStoreReady } from '../../cojson/crud/read-operations.js'
import { buildMetaFactoryForSeeding, removeIdFields, sortSchemasByDependency } from './helpers.js'

const MAIA_SPARK = '°Maia'

/**
 * Bootstrap and scaffold when account.registries doesn't exist
 * Order: guardian → account.temp → metaschema → factories → scaffold → cleanup temp.
 */
export async function bootstrapAndScaffold(account, node, schemas, dbEngine = null) {
	const { EXCEPTION_FACTORIES } = await import('../../factories/registry.js')
	const { getAllFactories } = await import('@MaiaOS/factories')
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

	const uniqueSchemasBy$id = new Map()
	for (const [name, schema] of Object.entries(allSchemas)) {
		const key = schema.$id || `°Maia/factory/${name}`
		if (!uniqueSchemasBy$id.has(key)) uniqueSchemasBy$id.set(key, { name, schema })
	}
	const sorted = sortSchemasByDependency(uniqueSchemasBy$id)

	// Ensure migration-stream factory is created before todos (todos needs a migration CoStream)
	if (
		sorted.includes('°Maia/factory/data/todos') &&
		sorted.includes('°Maia/factory/os/migration-stream')
	) {
		const migIdx = sorted.indexOf('°Maia/factory/os/migration-stream')
		const todosIdx = sorted.indexOf('°Maia/factory/data/todos')
		if (migIdx > todosIdx) {
			sorted.splice(migIdx, 1)
			const newTodosIdx = sorted.indexOf('°Maia/factory/data/todos')
			sorted.splice(newTodosIdx, 0, '°Maia/factory/os/migration-stream')
		}
	}

	const factoryCoIdMap = new Map()
	const ctx = { node, account, guardian }
	for (const factoryKey of sorted) {
		const { schema } = uniqueSchemasBy$id.get(factoryKey)
		const { $schema, $id, id, ...props } = schema
		const cleaned = removeIdFields(props)

		let headerMetaOverrides
		if (factoryKey === '°Maia/factory/data/todos') {
			const migStreamFactoryCoId = factoryCoIdMap.get('°Maia/factory/os/migration-stream')
			if (migStreamFactoryCoId) {
				const migGroup = node.createGroup()
				migGroup.extend(guardian, 'admin')
				const migMeta = { $factory: migStreamFactoryCoId }
				const migrationsStream = migGroup.createStream(undefined, 'private', migMeta)
				migrationsStream.push(
					{
						description: 'Added priority field',
						lang: 'js',
						code: `({ migrate: function(d) { if (!d.priority) d.priority = 'medium'; return d; } })`,
					},
					'trusting',
				)
				headerMetaOverrides = { $migrations: migrationsStream.id }
			}
		}

		const { coValue: factoryCoMap } = await createCoValueForSpark(ctx, null, {
			factory: metaSchemaCoId,
			cotype: 'comap',
			data: cleaned,
			dataEngine: dbEngine,
			isFactoryDefinition: true,
			headerMetaOverrides,
		})
		const coId = factoryCoMap.id
		factoryCoIdMap.set(factoryKey, coId)
		tempCoMap.set(factoryKey, coId)
	}

	const sparkSchemaCoId =
		tempCoMap.get('°Maia/factory/data/spark') || EXCEPTION_FACTORIES.META_SCHEMA
	const factoriesRegistrySchemaCoId =
		tempCoMap.get('°Maia/factory/os/factories-registry') || EXCEPTION_FACTORIES.META_SCHEMA
	const osSchemaCoId =
		tempCoMap.get('°Maia/factory/os/os-registry') || EXCEPTION_FACTORIES.META_SCHEMA
	const groupsSchemaCoId =
		tempCoMap.get('°Maia/factory/os/groups') || EXCEPTION_FACTORIES.META_SCHEMA
	const capabilitiesStreamSchemaCoId =
		tempCoMap.get('°Maia/factory/os/capabilities-stream') || EXCEPTION_FACTORIES.META_SCHEMA
	const indexesSchemaCoId =
		tempCoMap.get('°Maia/factory/os/indexes-registry') || EXCEPTION_FACTORIES.META_SCHEMA
	const vibesRegistrySchemaCoId =
		tempCoMap.get('°Maia/factory/os/vibes-registry') ?? EXCEPTION_FACTORIES.META_SCHEMA

	const scaffoldOpts = (factory, data) => ({ factory, cotype: 'comap', data, dataEngine: dbEngine })
	const { coValue: maiaSpark } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(sparkSchemaCoId, { name: '°Maia' }),
	)
	const { coValue: os } = await createCoValueForSpark(ctx, null, scaffoldOpts(osSchemaCoId, {}))
	const { coValue: groups } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(groupsSchemaCoId, {}),
	)
	groups.set('guardian', guardian.id)
	os.set('groups', groups.id)
	const { coValue: capabilitiesStream } = await createCoValueForSpark(ctx, null, {
		factory: capabilitiesStreamSchemaCoId,
		cotype: 'costream',
		dataEngine: dbEngine,
	})
	os.set('capabilities', capabilitiesStream.id)
	const { coValue: factoriesRegistry } = await createCoValueForSpark(
		ctx,
		null,
		scaffoldOpts(factoriesRegistrySchemaCoId, {}),
	)
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
	os.set('factories', factoriesRegistry.id)
	os.set('indexes', indexes.id)
	os.set('vibes', vibes.id)
	maiaSpark.set('os', os.id)
	factoriesRegistry.set('°Maia/factory/meta', metaSchemaCoId)
	for (const [k, coId] of factoryCoIdMap) factoriesRegistry.set(k, coId)

	const { removeGroupMember } = await import('../../cojson/groups/groups.js')
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
		'✅ Bootstrap scaffold complete: account.registries, °Maia spark, os, factories, indexes, vibes',
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

	const { EXCEPTION_FACTORIES } = await import('../../factories/registry.js')
	const node = peer.node

	const osId = sparkContent.get('os')
	if (!osId || !osId.startsWith('co_z')) return
	const osCore = peer.getCoValue(osId)
	if (!osCore || !peer.isAvailable(osCore)) return
	const osContent = peer.getCurrentContent(osCore)
	if (!osContent || typeof osContent.get !== 'function') return
	const groupsId = osContent.get('groups')
	if (!groupsId || !groupsId.startsWith('co_z')) return
	const groupsCore = peer.getCoValue(groupsId)
	if (!groupsCore || !peer.isAvailable(groupsCore)) return
	const groupsContent = peer.getCurrentContent(groupsCore)
	if (!groupsContent || typeof groupsContent.set !== 'function') return

	const { resolve } = await import('../../cojson/factory/resolver.js')
	const registriesSchemaCoId = await resolve(peer, '°Maia/factory/os/registries', {
		returnType: 'coId',
	})
	const sparksRegistrySchemaCoId = await resolve(peer, '°Maia/factory/os/sparks-registry', {
		returnType: 'coId',
	})
	const humansRegistrySchemaCoId = await resolve(peer, '°Maia/factory/os/humans-registry', {
		returnType: 'coId',
	})
	const avensIdentityRegistrySchemaCoId = await resolve(
		peer,
		'°Maia/factory/os/avens-identity-registry',
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

	console.log('✅ account.registries bootstrapped (sparks[°Maia], humans, avens)')
}
