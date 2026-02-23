/**
 * MaiaDB - CoJSON data layer
 *
 * Single implementation. read/create/update/delete/resolve.
 * No DBAdapter interface. Direct CoJSON operations.
 */

import { seed } from '../../migrations/seeding/seed.js'
import { ReactiveStore } from '../../reactive-store.js'
import { EXCEPTION_SCHEMAS } from '../../schemas/registry.js'
import { getGlobalCoCache } from '../cache/coCache.js'
import * as crudCreate from '../crud/create.js'
import { extractCoStreamWithSessions } from '../crud/data-extraction.js'
import * as crudDelete from '../crud/delete.js'
import { createAndPushMessage as createAndPushMessageFn } from '../crud/message-helpers.js'
import { processInbox as processInboxFn } from '../crud/process-inbox.js'
import { resolveReactive as resolveReactiveFn } from '../crud/reactive-resolver.js'
import { findFirst as findFirstByFilter, read as universalRead } from '../crud/read.js'
import {
	waitForReactiveResolution as waitForReactiveResolutionFn,
	waitForStoreReady,
} from '../crud/read-operations.js'
import * as crudUpdate from '../crud/update.js'
import * as groups from '../groups/groups.js'
import { wrapStorageWithIndexingHooks } from '../indexing/storage-hook-wrapper.js'
import { checkCotype as checkCotypeFn, resolve } from '../schema/resolver.js'
import { wrapSyncManagerWithValidation } from '../sync/validation-hook-wrapper.js'

export class MaiaDB {
	/**
	 * @param {{ node: import('cojson').LocalNode, account: import('cojson').RawAccount }} peer - Node and account
	 * @param {Object} [dbEngineOrOptions] - DBEngine for schema validation, or options { systemSpark }
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
		this.systemSpark = options.systemSpark ?? '°Maia'

		this.subscriptionCache = getGlobalCoCache(node)
		if (node.storage) {
			node.storage = wrapStorageWithIndexingHooks(node.storage, this)
		}
		if (node.syncManager && dbEngine) {
			wrapSyncManagerWithValidation(node.syncManager, this, dbEngine)
		}
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
		if (!coValueCore || !coValueCore.isAvailable()) return null
		return coValueCore.getCurrentContent()
	}
	getHeader(coValueCore) {
		return coValueCore?.verified?.header || null
	}
	getAccount() {
		return this.account
	}
	getCurrentSessionID() {
		if (!this.node || !this.node.currentSessionID) return null
		return this.node.currentSessionID
	}

	readInboxWithSessions(inboxCoId) {
		const coValueCore = this.getCoValue(inboxCoId)
		if (!coValueCore || !this.isAvailable(coValueCore)) return null
		return extractCoStreamWithSessions(this, coValueCore)
	}

	async getMaiaGroup() {
		return groups.getMaiaGroup(this)
	}

	getGroupInfo(coValueCore) {
		if (!coValueCore || !this.isAvailable(coValueCore)) return null
		try {
			const header = this.getHeader(coValueCore)
			const content = this.getCurrentContent(coValueCore)
			const ruleset = coValueCore.ruleset || header?.ruleset
			if (!ruleset) return null
			let ownerGroupId = null
			let ownerGroupCore = null
			let ownerGroupContent = null
			if (ruleset.type === 'group') {
				ownerGroupId = coValueCore.id
				ownerGroupCore = coValueCore
				ownerGroupContent = content
			} else if (ruleset.type === 'ownedByGroup' && ruleset.group) {
				ownerGroupId = ruleset.group
				ownerGroupCore = this.getCoValue(ownerGroupId)
				if (ownerGroupCore && this.isAvailable(ownerGroupCore)) {
					ownerGroupContent = this.getCurrentContent(ownerGroupCore)
				}
			} else if (content?.group) {
				const groupRef = content.group
				ownerGroupId = typeof groupRef === 'string' ? groupRef : groupRef.id || groupRef.$jazz?.id
				if (ownerGroupId) {
					ownerGroupCore = this.getCoValue(ownerGroupId)
					if (ownerGroupCore && this.isAvailable(ownerGroupCore)) {
						ownerGroupContent = this.getCurrentContent(ownerGroupCore)
					}
				}
			} else return null
			if (!ownerGroupContent || typeof ownerGroupContent.addMember !== 'function') return null
			const groupInfo = groups.getGroupInfoFromGroup(ownerGroupContent)
			if (groupInfo && ownerGroupId) groupInfo.groupId = ownerGroupId
			return groupInfo
		} catch (_error) {
			return null
		}
	}

	async getGroup(groupId) {
		return await groups.getGroup(this.node, groupId)
	}
	getGroupInfoFromGroup(group) {
		return groups.getGroupInfoFromGroup(group)
	}
	async addGroupMember(group, accountCoId, role) {
		return await groups.addGroupMember(this.node, group, accountCoId, role, this)
	}
	async removeGroupMember(group, memberId) {
		return await groups.removeGroupMember(group, memberId)
	}
	async setGroupMemberRole(group, memberId, role) {
		return await groups.setGroupMemberRole(this.node, group, memberId, role)
	}

	async createSpark(name) {
		if (!this.account) throw new Error('[MaiaDB] Account required for createSpark')
		const trimmed = typeof name === 'string' ? name.trim() : ''
		const normalizedName = trimmed && !trimmed.startsWith('°') ? `°${trimmed}` : trimmed
		const maiaGuardian = await this.getMaiaGroup()
		if (!maiaGuardian) throw new Error('[MaiaDB] °Maia spark group not found')
		const { createChildGroup } = await import('../groups/create.js')
		const childGroup = createChildGroup(this.node, maiaGuardian, { name: normalizedName })
		const sparkSchemaCoId = await resolve(this, '°Maia/schema/data/spark', { returnType: 'coId' })
		const capabilitiesSchemaCoId = await resolve(this, '°Maia/schema/os/capabilities', {
			returnType: 'coId',
		})
		const osSchemaCoId = await resolve(this, '°Maia/schema/os/os-registry', { returnType: 'coId' })
		const agentsSchemaCoId = await resolve(this, '°Maia/schema/os/agents-registry', {
			returnType: 'coId',
		})
		if (!sparkSchemaCoId || !capabilitiesSchemaCoId || !osSchemaCoId || !agentsSchemaCoId) {
			throw new Error('[MaiaDB] Spark scaffold schemas not found')
		}
		const ctx = { node: this.node, account: this.account, guardian: childGroup }
		const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')
		const { coValue: capabilities } = await createCoValueForSpark(ctx, null, {
			schema: capabilitiesSchemaCoId,
			cotype: 'comap',
			data: { guardian: childGroup.id },
			dataEngine: this.dbEngine,
		})
		const { coValue: os } = await createCoValueForSpark(ctx, null, {
			schema: osSchemaCoId,
			cotype: 'comap',
			data: { capabilities: capabilities.id },
			dataEngine: this.dbEngine,
		})
		const { coValue: agents } = await createCoValueForSpark(ctx, null, {
			schema: agentsSchemaCoId,
			cotype: 'comap',
			data: {},
			dataEngine: this.dbEngine,
		})
		const { coValue: sparkCoMap } = await createCoValueForSpark(ctx, null, {
			schema: sparkSchemaCoId,
			cotype: 'comap',
			data: { name: normalizedName, os: os.id, agents: agents.id },
			dataEngine: this.dbEngine,
		})
		return { id: sparkCoMap.id, name: normalizedName, guardian: childGroup.id }
	}

	async readSpark(id, schema = null) {
		if (id) return await this.read(null, id)
		const sparkSchema = schema || '°Maia/schema/data/spark'
		const sparkSchemaCoId = await resolve(this, sparkSchema, { returnType: 'coId' })
		if (!sparkSchemaCoId) throw new Error(`[MaiaDB] Spark schema not found: ${sparkSchema}`)
		return await this.read(sparkSchemaCoId)
	}

	async updateSpark(id, data) {
		const { group: _g, ...allowed } = data || {}
		if (typeof allowed.name === 'string') {
			const trimmed = allowed.name.trim()
			allowed.name = trimmed && !trimmed.startsWith('°') ? `°${trimmed}` : trimmed
		}
		const schemaCoId = await resolve(this, { fromCoValue: id }, { returnType: 'coId' })
		return await this.update(schemaCoId, id, allowed)
	}

	async deleteSpark(id) {
		const schemaCoId = await resolve(this, { fromCoValue: id }, { returnType: 'coId' })
		await this.delete(schemaCoId, id)
		return { success: true, id }
	}

	async read(schema, key, keys, filter, options = {}) {
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
				keys.map((coId) => universalRead(this, coId, schema, null, schema, readOptions)),
			)
			return stores
		}
		if (key) return await universalRead(this, key, schema, null, schema, readOptions)
		if (!schema) return await universalRead(this, null, null, filter, null, readOptions)
		return await universalRead(this, null, schema, filter, null, readOptions)
	}

	async findFirst(schema, filter, options = {}) {
		return await findFirstByFilter(this, schema, filter, options)
	}

	async create(schema, data, options = {}) {
		return await crudCreate.create(this, schema, data, options)
	}

	async update(schema, id, data) {
		return await crudUpdate.update(this, schema, id, data)
	}

	async delete(schema, id) {
		return await crudDelete.deleteRecord(this, schema, id)
	}

	async getRawRecord(id) {
		const coValueCore = this.getCoValue(id)
		if (!coValueCore || !this.isAvailable(coValueCore)) return null
		const content = this.getCurrentContent(coValueCore)
		const header = this.getHeader(coValueCore)
		const headerMeta = header?.meta || null
		const schema = headerMeta?.$schema || null
		if (content?.get && typeof content.get === 'function') {
			const raw = { $schema: schema }
			const keys =
				content.keys && typeof content.keys === 'function' ? content.keys() : Object.keys(content)
			for (const k of keys) {
				raw[k] = content.get && typeof content.get === 'function' ? content.get(k) : content[k]
			}
			return raw
		}
		if (content?.toJSON) {
			try {
				return content.toJSON()
			} catch (_e) {
				return null
			}
		}
		return null
	}

	async seed(configs, schemas, data, options = {}) {
		if (!this.account) throw new Error('[MaiaDB] Account required for seed')
		return await seed(this.account, this.node, configs, schemas, data || {}, this, options)
	}

	async ensureAccountOsReady(options = {}) {
		const { timeoutMs = 10000 } = options
		if (!this.account && typeof process !== 'undefined' && process.env?.DEBUG) return false
		const osId = await groups.getSparkOsId(this, '°Maia')
		if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
			if (typeof process !== 'undefined' && process.env?.DEBUG) return false
		}
		const osStore = await universalRead(this, osId, null, null, null, {
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
		let schematasId = osData.schematas
		if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
			const osCore = this.getCoValue(osId)
			if (!osCore || !osCore.isAvailable()) {
				if (typeof process !== 'undefined' && process.env?.DEBUG) return false
			}
			const osContent = this.getCurrentContent(osCore)
			if (!osContent || typeof osContent.set !== 'function') {
				if (typeof process !== 'undefined' && process.env?.DEBUG) return false
			}
			const schematasSchemaCoId = await resolve(this, '°Maia/schema/os/schematas-registry', {
				returnType: 'coId',
			})
			const schema = schematasSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA
			const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')
			const { coValue: schematasCoMap } = await createCoValueForSpark(this, '°Maia', {
				schema,
				cotype: 'comap',
				data: {},
				dataEngine: this.dbEngine,
			})
			osContent.set('schematas', schematasCoMap.id)
			schematasId = schematasCoMap.id
			const osStore2 = await universalRead(this, osId, null, null, null, {
				deepResolve: false,
				timeoutMs: 2000,
			})
			try {
				await waitForStoreReady(osStore2, osId, 2000)
				const osData2 = osStore2.value
				if (osData2 && !osData2.error) schematasId = osData2.schematas || schematasId
			} catch (_error) {}
		}
		if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
			if (typeof process !== 'undefined' && process.env?.DEBUG) return false
		}
		const schematasStore = await universalRead(this, schematasId, null, null, null, {
			deepResolve: false,
			timeoutMs,
		})
		try {
			await waitForStoreReady(schematasStore, schematasId, timeoutMs)
		} catch (_error) {
			if (typeof process !== 'undefined' && process.env?.DEBUG) return false
		}
		const schematasData = schematasStore.value
		if (!schematasData || schematasData.error) {
			if (typeof process !== 'undefined' && process.env?.DEBUG) return false
		}
		return true
	}

	// Delegate methods for engines (Phase 4: route through peer, no direct db imports in engines)
	async resolve(identifier, opts = {}) {
		return resolve(this, identifier, opts)
	}
	async checkCotype(schemaCoId, expectedCotype) {
		return checkCotypeFn(this, schemaCoId, expectedCotype)
	}
	createReactiveStore(initialValue) {
		return new ReactiveStore(initialValue)
	}
	async getSparkCapabilityGroupIdFromSparkCoId(sparkCoId, capabilityName = 'guardian') {
		return groups.getSparkCapabilityGroupIdFromSparkCoId(this, sparkCoId, capabilityName)
	}
	resolveReactive(identifier, opts = {}) {
		return resolveReactiveFn(this, identifier, opts)
	}
	async waitForReactiveResolution(store, opts = {}) {
		return waitForReactiveResolutionFn(store, opts)
	}
	async processInbox(actorId, inboxCoId) {
		return processInboxFn(this, actorId, inboxCoId)
	}
	async createAndPushMessage(inboxCoId, messageData) {
		if (!this.dbEngine) {
			throw new Error('[MaiaDB.createAndPushMessage] dbEngine required (set via DataEngine)')
		}
		return createAndPushMessageFn(this.dbEngine, inboxCoId, messageData)
	}
}
