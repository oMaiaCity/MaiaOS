import * as crudDelete from '../crud/delete.js'
import * as crudUpdate from '../crud/update.js'
import { resolve } from '../factory/authoring-resolver.js'
import { normalizeSparkLogicalName } from './maia-db-constants.js'

/**
 * @param {object} db - MaiaDB (`this`)
 */
export async function maiaDbCreateSpark(db, name) {
	if (!db.account) throw new Error('[MaiaDB] Account required for createSpark')
	if (!db.systemSparkCoId?.startsWith('co_z')) await db.resolveSystemSparkCoId()
	if (db.dbEngine?.resolveSystemFactories) await db.dbEngine.resolveSystemFactories()
	const normalizedName = normalizeSparkLogicalName(name)
	const maiaGuardian = await db.getMaiaGroup()
	if (!maiaGuardian) throw new Error('[MaiaDB] °maia spark group not found')
	const { createChildGroup } = await import('../groups/create.js')
	const childGroup = createChildGroup(db.node, maiaGuardian, { name: normalizedName })
	const sparkSchemaCoId = db.infra?.dataSpark
	const groupsSchemaCoId = db.infra?.groups
	const osSchemaCoId = db.infra?.osRegistry
	const vibesRegistrySchemaCoId = db.infra?.vibesRegistry
	if (!sparkSchemaCoId || !groupsSchemaCoId || !osSchemaCoId || !vibesRegistrySchemaCoId) {
		throw new Error(
			'[MaiaDB] Spark scaffold factories not found (peer.infra missing — call resolveSystemFactories)',
		)
	}
	const ctx = { node: db.node, account: db.account, guardian: childGroup }
	const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')
	const { coValue: groupsCo } = await createCoValueForSpark(ctx, null, {
		factory: groupsSchemaCoId,
		cotype: 'comap',
		data: { guardian: childGroup.id },
		dataEngine: db.dbEngine,
	})
	const { coValue: os } = await createCoValueForSpark(ctx, null, {
		factory: osSchemaCoId,
		cotype: 'comap',
		data: { groups: groupsCo.id },
		dataEngine: db.dbEngine,
	})
	const { coValue: vibes } = await createCoValueForSpark(ctx, null, {
		factory: vibesRegistrySchemaCoId,
		cotype: 'comap',
		data: {},
		dataEngine: db.dbEngine,
	})
	const { coValue: sparkCoMap } = await createCoValueForSpark(ctx, null, {
		factory: sparkSchemaCoId,
		cotype: 'comap',
		data: { name: normalizedName, os: os.id, vibes: vibes.id },
		dataEngine: db.dbEngine,
	})
	return { id: sparkCoMap.id, name: normalizedName, guardian: childGroup.id }
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbReadSpark(db, id, schema = null) {
	if (id) return await db.read(null, id)
	if (!schema?.startsWith?.('co_z')) {
		throw new Error('[MaiaDB] readSpark: id or spark schema co-id (co_z...) required')
	}
	return await db.read(schema)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbUpdateSpark(db, id, data) {
	const { group: _g, ...allowed } = data || {}
	if (typeof allowed.name === 'string') {
		const t = allowed.name.trim()
		if (t) allowed.name = normalizeSparkLogicalName(allowed.name)
		else allowed.name = ''
	}
	const factoryCoId = await resolve(db, { fromCoValue: id }, { returnType: 'coId' })
	return await crudUpdate.update(db, factoryCoId, id, allowed)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbDeleteSpark(db, id) {
	const factoryCoId = await resolve(db, { fromCoValue: id }, { returnType: 'coId' })
	await crudDelete.deleteRecord(db, factoryCoId, id)
	return { success: true, id }
}
