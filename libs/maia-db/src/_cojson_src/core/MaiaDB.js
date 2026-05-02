/**
 * MaiaDB - CoJSON data layer
 *
 * Single implementation. read/create/update/delete/resolve.
 * No DBAdapter interface. Direct CoJSON operations.
 */

import { wrapSyncManagerWithValidation } from '@MaiaOS/validation/validation-hook-wrapper'
import { getGlobalCoCache } from '../../primitives/co-cache.js'
import { ReactiveStore } from '../../primitives/reactive-store.js'
import { resolve } from '../factory/authoring-resolver.js'
import { wrapStorageWithIndexingHooks } from '../indexing/storage-hook-wrapper.js'
import {
	maiaDbCheckCotype,
	maiaDbCreate,
	maiaDbCreateAndPushMessage,
	maiaDbDelete,
	maiaDbFindFirst,
	maiaDbGetRawRecord,
	maiaDbProcessInbox,
	maiaDbRead,
	maiaDbResolve,
	maiaDbResolveReactive,
	maiaDbUpdate,
	maiaDbWaitForReactiveResolution,
} from './maia-db-data-plane.js'
import {
	maiaDbAddGroupMember,
	maiaDbGetGroup,
	maiaDbGetGroupInfo,
	maiaDbGetGroupInfoFromGroup,
	maiaDbGetMaiaGroup,
	maiaDbGetSparkCapabilityGroupIdFromSparkCoId,
	maiaDbReadInboxWithSessions,
	maiaDbRemoveGroupMember,
	maiaDbSetGroupMemberRole,
} from './maia-db-groups.js'
import {
	maiaDbCreateSpark,
	maiaDbDeleteSpark,
	maiaDbReadSpark,
	maiaDbUpdateSpark,
} from './maia-db-spark.js'
import { maiaDbEnsureAccountOsReady, maiaDbResolveSystemSparkCoId } from './maia-db-system-spark.js'

export { SYSTEM_SPARK_REGISTRY_KEY } from './maia-db-constants.js'

export class MaiaDB {
	/**
	 * @param {{ node: import('cojson').LocalNode, account: import('cojson').RawAccount }} peer - Node and account
	 * @param {Object} [dbEngineOrOptions] - DBEngine for schema validation, or options bag (no systemSpark; use {@link #resolveSystemSparkCoId})
	 */
	constructor(peer, dbEngineOrOptions = null) {
		const { node, account } = peer
		const isOptions =
			dbEngineOrOptions &&
			typeof dbEngineOrOptions === 'object' &&
			!dbEngineOrOptions.peer &&
			typeof dbEngineOrOptions.execute !== 'function'
		const dbEngine = isOptions ? null : dbEngineOrOptions
		const options = isOptions ? dbEngineOrOptions : {}
		this.node = node
		this.account = account
		this.dbEngine = dbEngine
		/** @type {string|null} Spark CoMap co-id for {@link SYSTEM_SPARK_REGISTRY_KEY}; set by {@link #resolveSystemSparkCoId} */
		this.systemSparkCoId = options.systemSparkCoId ?? null
		/** @type {Readonly<Record<string, string>>|null} Infra factory co-ids (meta, actor, …); set by loadInfraFromSparkOs */
		this.infra = null

		this.subscriptionCache = getGlobalCoCache(node)
		if (node.storage) {
			node.storage = wrapStorageWithIndexingHooks(node.storage, this)
		}
		if (node.syncManager && (dbEngine || options?.beforeAcceptWrite)) {
			wrapSyncManagerWithValidation(node.syncManager, this, dbEngine, {
				beforeAcceptWrite: options?.beforeAcceptWrite,
				resolve,
			})
		}
	}

	/**
	 * Resolve and cache `account.sparks[SYSTEM_SPARK_REGISTRY_KEY]` as {@link #systemSparkCoId}.
	 *
	 * Fast path (new unified bootstrap): the caller (MaiaOS.boot) has already awaited
	 * bootstrapAccountHandshake -> account.sparks is set ('trusting', public pointer) and
	 * the sparks CoMap is synced. We read both values directly via node.load — no 20s × N
	 * cascading waits, no reactive subscription polling.
	 *
	 * Call order: after peer + dataEngine are wired, before dataEngine.resolveSystemFactories.
	 */
	async resolveSystemSparkCoId() {
		return maiaDbResolveSystemSparkCoId(this)
	}

	_resetCaches() {}

	getCoValue(coId) {
		return this.node.getCoValue(coId)
	}
	getAllCoValues() {
		return this.node.coValues || new Map()
	}
	isAvailable(coValueCore) {
		return coValueCore?.isAvailable() || false
	}
	getCurrentContent(coValueCore) {
		if (!coValueCore?.isAvailable()) return null
		return coValueCore.getCurrentContent()
	}
	getHeader(coValueCore) {
		return coValueCore?.verified?.header || null
	}
	getAccount() {
		return this.account
	}
	getCurrentSessionID() {
		if (!this.node?.currentSessionID) return null
		return this.node.currentSessionID
	}

	readInboxWithSessions(inboxCoId) {
		return maiaDbReadInboxWithSessions(this, inboxCoId)
	}

	async getMaiaGroup() {
		return maiaDbGetMaiaGroup(this)
	}

	getGroupInfo(coValueCore) {
		return maiaDbGetGroupInfo(this, coValueCore)
	}

	async getGroup(groupId) {
		return await maiaDbGetGroup(this, groupId)
	}
	getGroupInfoFromGroup(group) {
		return maiaDbGetGroupInfoFromGroup(this, group)
	}
	async addGroupMember(group, accountCoId, role) {
		return await maiaDbAddGroupMember(this, group, accountCoId, role)
	}
	async removeGroupMember(group, memberId) {
		return await maiaDbRemoveGroupMember(this, group, memberId)
	}
	async setGroupMemberRole(group, memberId, role) {
		return await maiaDbSetGroupMemberRole(this, group, memberId, role)
	}

	async createSpark(name) {
		return maiaDbCreateSpark(this, name)
	}

	async readSpark(id, schema = null) {
		return maiaDbReadSpark(this, id, schema)
	}

	async updateSpark(id, data) {
		return maiaDbUpdateSpark(this, id, data)
	}

	async deleteSpark(id) {
		return maiaDbDeleteSpark(this, id)
	}

	async read(schema, key, keys, filter, options = {}) {
		return maiaDbRead(this, schema, key, keys, filter, options)
	}

	async findFirst(schema, filter, options = {}) {
		return maiaDbFindFirst(this, schema, filter, options)
	}

	async create(schema, data, options = {}) {
		return maiaDbCreate(this, schema, data, options)
	}

	async update(schema, id, data) {
		return maiaDbUpdate(this, schema, id, data)
	}

	async delete(schema, id) {
		return maiaDbDelete(this, schema, id)
	}

	async getRawRecord(id) {
		return maiaDbGetRawRecord(this, id)
	}

	async ensureAccountOsReady(options = {}) {
		return maiaDbEnsureAccountOsReady(this, options)
	}

	async resolve(identifier, opts = {}) {
		return maiaDbResolve(this, identifier, opts)
	}
	async checkCotype(factoryCoId, expectedCotype) {
		return maiaDbCheckCotype(this, factoryCoId, expectedCotype)
	}
	createReactiveStore(initialValue) {
		return new ReactiveStore(initialValue)
	}
	async getSparkCapabilityGroupIdFromSparkCoId(sparkCoId, capabilityName = 'guardian') {
		return maiaDbGetSparkCapabilityGroupIdFromSparkCoId(this, sparkCoId, capabilityName)
	}
	resolveReactive(identifier, opts = {}) {
		return maiaDbResolveReactive(this, identifier, opts)
	}
	async waitForReactiveResolution(store, opts = {}) {
		return maiaDbWaitForReactiveResolution(this, store, opts)
	}
	async processInbox(actorId, inboxCoId) {
		return maiaDbProcessInbox(this, actorId, inboxCoId)
	}
	async createAndPushMessage(inboxCoId, messageData) {
		return maiaDbCreateAndPushMessage(this, inboxCoId, messageData)
	}
}
