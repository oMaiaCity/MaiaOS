import { TIMEOUT_COVALUE_LOAD } from '@MaiaOS/timeouts'
import { read as universalRead } from '../crud/read.js'
import { waitForStoreReady } from '../crud/read-operations.js'
import * as groups from '../groups/groups.js'
import { SYSTEM_SPARK_REGISTRY_KEY } from './maia-db-constants.js'

/**
 * @param {{ account: object, read: Function, systemSparkCoId: string|null, dbEngine: object|null }} db
 */
export async function maiaDbResolveSystemSparkCoId(db) {
	if (db.systemSparkCoId?.startsWith('co_z')) return db.systemSparkCoId
	if (!db.account?.id) {
		throw new Error('[MaiaDB] resolveSystemSparkCoId: account required')
	}
	const sparksId = db.account.get?.('sparks')
	if (!sparksId?.startsWith('co_z')) {
		throw new Error(
			`[MaiaDB] account.sparks not set (account: ${db.account.id.slice(0, 12)}…). ` +
				`POST /bootstrap must run before MaiaOS.boot — see bootstrapAccountHandshake.`,
		)
	}
	const sparksStore = await db.read(sparksId, sparksId)
	try {
		await waitForStoreReady(sparksStore, sparksId, TIMEOUT_COVALUE_LOAD)
	} catch (e) {
		throw new Error(
			`[MaiaDB] sparks CoMap ${sparksId.slice(0, 12)}… did not load within ${TIMEOUT_COVALUE_LOAD}ms: ${e?.message ?? e}`,
		)
	}
	const sparksRaw = sparksStore?.value
	const id = sparksRaw?.[SYSTEM_SPARK_REGISTRY_KEY]
	if (!id?.startsWith?.('co_z')) {
		throw new Error(
			`[MaiaDB] sparks CoMap ${sparksId.slice(0, 12)}… missing '${SYSTEM_SPARK_REGISTRY_KEY}' entry`,
		)
	}
	db.systemSparkCoId = id
	return id
}

/**
 * @param {{ account: object|null, read: Function, systemSparkCoId: string|null, dbEngine: object|null }} db
 */
export async function maiaDbEnsureAccountOsReady(db, options = {}) {
	const { timeoutMs = 10000 } = options
	if (!db.account && typeof process !== 'undefined' && process.env?.DEBUG) return false
	if (!db.systemSparkCoId?.startsWith('co_z')) await maiaDbResolveSystemSparkCoId(db)
	if (db.dbEngine?.resolveSystemFactories) await db.dbEngine.resolveSystemFactories()
	const osId = await groups.getSparkOsId(db, db.systemSparkCoId)
	if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
		if (typeof process !== 'undefined' && process.env?.DEBUG) return false
	}
	const osStore = await universalRead(db, osId, null, null, null, {
		deepResolve: false,
		timeoutMs,
	})
	try {
		await waitForStoreReady(osStore, osId, timeoutMs)
	} catch (_error) {
		if (typeof process !== 'undefined' && process.env?.DEBUG) return false
	}
	const osData = osStore.value
	if (!osData || osData.error) {
		if (typeof process !== 'undefined' && process.env?.DEBUG) return false
	}
	return true
}
