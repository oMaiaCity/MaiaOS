/**
 * Bootstrap - guardian, scaffold, account.sparks
 */

import { createCoValueForSpark, INFRA_SLOTS, waitForStoreReady } from '@MaiaOS/db'
import { createOpsLogger } from '@MaiaOS/logs'
import { maiaFactoryRefToNanoid, maiaIdentity } from '@MaiaOS/validation/identity-from-maia-path.js'
import { removeIdFields } from '@MaiaOS/validation/remove-id-fields'
import { seedDefinitionCatalogBootstrap } from './definition-catalog-bootstrap.js'
import { buildMetaFactoryForSeeding, sortSchemasByDependency } from './helpers.js'

const opsBootstrap = createOpsLogger('seed')

const MAIA_SPARK = '°maia'

/**
 * Bootstrap and scaffold when account.sparks doesn't exist
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
	for (const { slotKey, basename } of INFRA_SLOTS) {
		const n = maiaIdentity(basename).$nanoid
		let coId = factoryCoIdMap.get(n)
		if (slotKey === 'metaFactoryCoId') {
			coId = metaSchemaCoId
		}
		if (coId?.startsWith?.('co_z')) {
			os.set(slotKey, coId)
		}
	}
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
	const sparksMeta = { $factory: EXCEPTION_FACTORIES.META_SCHEMA }

	const sparksGroup = node.createGroup()
	sparksGroup.extend(guardian, 'extend')
	sparksGroup.addMember('everyone', 'reader')
	const sparksRegistry = sparksGroup.createMap({}, sparksMeta)
	sparksRegistry.set(MAIA_SPARK, maiaSpark.id)

	try {
		await removeGroupMember(sparksGroup, memberIdToRemove)
	} catch (_e) {}
	// Private (default): cojson account/group permissions only accept 'trusting' writes on a
	// whitelisted set of keys (readKey, groupSealer, profile, root, key reveals, parent
	// extensions, writeKeys) or valid member-role assignments. Arbitrary keys like 'sparks'
	// with a co_z... value get parsed as "setRole(sparks, <role>)" and rejected. A private
	// admin transaction stores the pointer; any signed-in agent holds the readKey (sealed for
	// their agentSecret) and can decrypt immediately — no pre-sync required for local-first.
	account.set('sparks', sparksRegistry.id)

	if (typeof account.delete === 'function') account.delete('temp')

	const wfs = node.syncManager?.waitForStorageSync
	if (!node.storage) {
		opsBootstrap.warn('[Bootstrap] node.storage missing - scaffold may not persist across restart')
	} else if (!wfs || typeof wfs !== 'function') {
		opsBootstrap.warn(
			'[Bootstrap] waitForStorageSync unavailable - scaffold may not persist across restart',
		)
	} else {
		const PERSIST_TIMEOUT_MS = 30000
		try {
			await Promise.race([
				Promise.all([
					wfs.call(node.syncManager, account.id),
					wfs.call(node.syncManager, sparksRegistry.id),
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

	opsBootstrap.log(
		'✅ Bootstrap scaffold complete: account.sparks, °maia spark, os, metaFactoryCoId, indexes (definition catalog), vibes',
	)
}

/**
 * Bootstrap account.sparks (sync agent only, during genesis seed)
 */
export async function bootstrapAccountSparks(peer, _maiaGroup) {
	const sparksId = peer.account?.get('sparks')
	if (!sparksId?.startsWith('co_z')) return
	const sparksStore = await peer.read(null, sparksId)
	await waitForStoreReady(sparksStore, sparksId, 10000)
	const sparksData = sparksStore?.value
	if (!sparksData || sparksData.error) return
	const maiaSparkCoId = sparksData[MAIA_SPARK]
	if (!maiaSparkCoId?.startsWith('co_z')) return
	// Seed runs before MaiaDB.resolveSystemSparkCoId(); resolver needs this for namekey lookups.
	peer.systemSparkCoId = maiaSparkCoId

	opsBootstrap.log('✅ account.sparks seen (°maia)')
}
