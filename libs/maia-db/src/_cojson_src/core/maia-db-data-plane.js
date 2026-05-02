import * as crudCreate from '../crud/create.js'
import { findFirst as findFirstByFilter, read as universalRead } from '../crud/read.js'
import {
	waitForReactiveResolution as waitForReactiveResolutionFn,
	waitForStoreReady,
} from '../crud/read-operations.js'
import {
	checkCotype as checkCotypeFn,
	resolve,
	resolveReactive as resolveReactiveFromResolver,
} from '../factory/authoring-resolver.js'

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbRead(db, schema, key, keys, filter, options = {}) {
	const {
		deepResolve = true,
		maxDepth = 15,
		timeoutMs = 5000,
		map = null,
		onChange = null,
	} = options
	const readOptions = { deepResolve, maxDepth, timeoutMs, map, onChange }
	if (keys && Array.isArray(keys)) {
		const stores = await Promise.all(
			keys.map((coId) => universalRead(db, coId, schema, null, schema, readOptions)),
		)
		return stores
	}
	if (key) return await universalRead(db, key, schema, null, schema, readOptions)
	if (!schema) return await universalRead(db, null, null, filter, null, readOptions)
	return await universalRead(db, null, schema, filter, null, readOptions)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbFindFirst(db, schema, filter, options = {}) {
	return await findFirstByFilter(db, schema, filter, options)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbCreate(db, schema, data, options = {}) {
	return await crudCreate.create(db, schema, data, options)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbUpdate(db, schema, id, data) {
	const crudUpdate = await import('../crud/update.js')
	return await crudUpdate.update(db, schema, id, data)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbDelete(db, schema, id) {
	const crudDelete = await import('../crud/delete.js')
	return await crudDelete.deleteRecord(db, schema, id)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbGetRawRecord(db, id) {
	const store = await universalRead(db, id, null, null, null, { deepResolve: false })
	try {
		await waitForStoreReady(store, id, 5000)
	} catch (_e) {
		return null
	}
	const data = store.value
	if (!data || data.error) return null
	return data
}

/**
 * @param {object} db - MaiaDB
 */
/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbResolve(db, identifier, opts = {}) {
	return resolve(db, identifier, opts)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbCheckCotype(db, factoryCoId, expectedCotype) {
	return checkCotypeFn(db, factoryCoId, expectedCotype)
}

/**
 * @param {object} db - MaiaDB
 */
export function maiaDbResolveReactive(db, identifier, opts = {}) {
	return resolveReactiveFromResolver(db, identifier, opts)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbWaitForReactiveResolution(_db, store, opts = {}) {
	return waitForReactiveResolutionFn(store, opts)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbProcessInbox(db, actorId, inboxCoId) {
	const { processInbox: processInboxFn } = await import('../crud/process-inbox.js')
	return processInboxFn(db, actorId, inboxCoId)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbCreateAndPushMessage(db, inboxCoId, messageData) {
	if (!db.dbEngine) {
		throw new Error('[MaiaDB.createAndPushMessage] dbEngine required (set via DataEngine)')
	}
	const { createAndPushMessage: createAndPushMessageFn } = await import('../crud/message-helpers.js')
	return createAndPushMessageFn(db.dbEngine, inboxCoId, messageData)
}
