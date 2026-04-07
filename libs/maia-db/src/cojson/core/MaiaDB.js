/**
 * MaiaDB - CoJSON data layer
 *
 * Single implementation. read/create/update/delete/resolve.
 * No DBAdapter interface. Direct CoJSON operations.
 */

import { EXCEPTION_FACTORIES } from '../../factories/registry.js'
import { seed } from '../../migrations/seeding/seed.js'
import { ReactiveStore } from '../../reactive-store.js'
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
	waitForRegistriesSparksCoId,
	waitForSparksCoMapRegistryKey,
	waitForStoreReady,
} from '../crud/read-operations.js'
import * as crudUpdate from '../crud/update.js'
import { checkCotype as checkCotypeFn, resolve } from '../factory/resolver.js'
import { getRuntimeRef, RUNTIME_REF } from '../factory/runtime-factory-refs.js'
import * as groups from '../groups/groups.js'
import { wrapStorageWithIndexingHooks } from '../indexing/storage-hook-wrapper.js'
import { wrapSyncManagerWithValidation } from '../sync/validation-hook-wrapper.js'

/** Key used in `registries.sparks` CoMap for the primary OS spark (written at seed). */
export const SYSTEM_SPARK_REGISTRY_KEY = '°maia'

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
		/** Registry namekey → schema factory co-id; filled by DataEngine.resolveSystemFactories */
		this.systemFactoryCoIds = new Map()
		/** Short role → co_z for infra factories; filled by fillRuntimeRefsFromSystemFactories */
		this.runtimeRefs = new Map()

		this.subscriptionCache = getGlobalCoCache(node)
		if (node.storage) {
			node.storage = wrapStorageWithIndexingHooks(node.storage, this)
		}
		if (node.syncManager && (dbEngine || options?.beforeAcceptWrite)) {
			wrapSyncManagerWithValidation(node.syncManager, this, dbEngine, {
				beforeAcceptWrite: options?.beforeAcceptWrite,
			})
		}
	}

	/**
	 * Resolve and cache `account.registries.sparks[SYSTEM_SPARK_REGISTRY_KEY]` as {@link #systemSparkCoId}.
	 * Call after {@link #dbEngine} is set (loader boot).
	 */
	async resolveSystemSparkCoId() {
		if (this.systemSparkCoId?.startsWith('co_z')) return this.systemSparkCoId
		if (!this.account?.id) {
			throw new Error('[MaiaDB] resolveSystemSparkCoId: account required')
		}
		const accountStore = await this.read('@account', this.account.id)
		const registriesId = accountStore?.value?.registries
		if (!registriesId?.startsWith?.('co_z')) {
			throw new Error('[MaiaDB] resolveSystemSparkCoId: account.registries missing')
		}
		const registriesStore = await this.read(null, registriesId)
		await waitForStoreReady(registriesStore, registriesId, 20000)
		const sparksId = await waitForRegistriesSparksCoId(registriesStore, registriesId, 20000)
		const sparksStore = await this.read(sparksId, sparksId)
		await waitForStoreReady(sparksStore, sparksId, 20000)
		const id = await waitForSparksCoMapRegistryKey(
			sparksStore,
			sparksId,
			SYSTEM_SPARK_REGISTRY_KEY,
			20000,
		)
		this.systemSparkCoId = id
		return id
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
		if (this.dbEngine?.resolveSystemFactories) await this.dbEngine.resolveSystemFactories()
		const trimmed = typeof name === 'string' ? name.trim() : ''
		const normalizedName = trimmed && !trimmed.startsWith('°') ? `°${trimmed}` : trimmed
		const maiaGuardian = await this.getMaiaGroup()
		if (!maiaGuardian) throw new Error('[MaiaDB] °maia spark group not found')
		const { createChildGroup } = await import('../groups/create.js')
		const childGroup = createChildGroup(this.node, maiaGuardian, { name: normalizedName })
		const sparkSchemaCoId = getRuntimeRef(this, RUNTIME_REF.DATA_SPARK)
		const groupsSchemaCoId = getRuntimeRef(this, RUNTIME_REF.OS_GROUPS)
		const osSchemaCoId = getRuntimeRef(this, RUNTIME_REF.OS_OS_REGISTRY)
		const vibesRegistrySchemaCoId = getRuntimeRef(this, RUNTIME_REF.OS_VIBES_REGISTRY)
		if (!sparkSchemaCoId || !groupsSchemaCoId || !osSchemaCoId || !vibesRegistrySchemaCoId) {
			throw new Error('[MaiaDB] Spark scaffold factories not found')
		}
		const ctx = { node: this.node, account: this.account, guardian: childGroup }
		const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')
		const { coValue: groups } = await createCoValueForSpark(ctx, null, {
			factory: groupsSchemaCoId,
			cotype: 'comap',
			data: { guardian: childGroup.id },
			dataEngine: this.dbEngine,
		})
		const { coValue: os } = await createCoValueForSpark(ctx, null, {
			factory: osSchemaCoId,
			cotype: 'comap',
			data: { groups: groups.id },
			dataEngine: this.dbEngine,
		})
		const { coValue: vibes } = await createCoValueForSpark(ctx, null, {
			factory: vibesRegistrySchemaCoId,
			cotype: 'comap',
			data: {},
			dataEngine: this.dbEngine,
		})
		const { coValue: sparkCoMap } = await createCoValueForSpark(ctx, null, {
			factory: sparkSchemaCoId,
			cotype: 'comap',
			data: { name: normalizedName, os: os.id, vibes: vibes.id },
			dataEngine: this.dbEngine,
		})
		return { id: sparkCoMap.id, name: normalizedName, guardian: childGroup.id }
	}

	async readSpark(id, schema = null) {
		if (id) return await this.read(null, id)
		if (!schema?.startsWith?.('co_z')) {
			throw new Error('[MaiaDB] readSpark: id or spark schema co-id (co_z...) required')
		}
		return await this.read(schema)
	}

	async updateSpark(id, data) {
		const { group: _g, ...allowed } = data || {}
		if (typeof allowed.name === 'string') {
			const trimmed = allowed.name.trim()
			allowed.name = trimmed && !trimmed.startsWith('°') ? `°${trimmed}` : trimmed
		}
		const factoryCoId = await resolve(this, { fromCoValue: id }, { returnType: 'coId' })
		return await this.update(factoryCoId, id, allowed)
	}

	async deleteSpark(id) {
		const factoryCoId = await resolve(this, { fromCoValue: id }, { returnType: 'coId' })
		await this.delete(factoryCoId, id)
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
		const store = await universalRead(this, id, null, null, null, { deepResolve: false })
		try {
			await waitForStoreReady(store, id, 5000)
		} catch (_e) {
			return null
		}
		const data = store.value
		if (!data || data.error) return null
		return data
	}

	async seed(configs, schemas, data, options = {}) {
		if (!this.account) throw new Error('[MaiaDB] Account required for seed')
		return await seed(this.account, this.node, configs, schemas, data || {}, this, options)
	}

	async ensureAccountOsReady(options = {}) {
		const { timeoutMs = 10000 } = options
		if (!this.account && typeof process !== 'undefined' && process.env?.DEBUG) return false
		if (!this.systemSparkCoId?.startsWith?.('co_z')) await this.resolveSystemSparkCoId()
		if (this.dbEngine?.resolveSystemFactories) await this.dbEngine.resolveSystemFactories()
		const osId = await groups.getSparkOsId(this, this.systemSparkCoId)
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
		let factoriesId = osData.factories
		if (!factoriesId || typeof factoriesId !== 'string' || !factoriesId.startsWith('co_z')) {
			const osCore = this.getCoValue(osId)
			if (!osCore?.isAvailable()) {
				if (typeof process !== 'undefined' && process.env?.DEBUG) return false
			}
			const osContent = this.getCurrentContent(osCore)
			if (!osContent || typeof osContent.set !== 'function') {
				if (typeof process !== 'undefined' && process.env?.DEBUG) return false
			}
			const factoriesRegistrySchemaCoId = getRuntimeRef(this, RUNTIME_REF.OS_FACTORIES_REGISTRY)
			const schema = factoriesRegistrySchemaCoId || EXCEPTION_FACTORIES.META_SCHEMA
			const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')
			const { coValue: factoriesCoMap } = await createCoValueForSpark(this, this.systemSparkCoId, {
				factory: schema,
				cotype: 'comap',
				data: {},
				dataEngine: this.dbEngine,
			})
			osContent.set('factories', factoriesCoMap.id)
			factoriesId = factoriesCoMap.id
			const osStore2 = await universalRead(this, osId, null, null, null, {
				deepResolve: false,
				timeoutMs: 2000,
			})
			try {
				await waitForStoreReady(osStore2, osId, 2000)
				const osData2 = osStore2.value
				if (osData2 && !osData2.error) factoriesId = osData2.factories || factoriesId
			} catch (_error) {}
		}
		let capabilitiesId = osData.capabilities
		if (!capabilitiesId || typeof capabilitiesId !== 'string' || !capabilitiesId.startsWith('co_z')) {
			const osCore = this.getCoValue(osId)
			if (osCore && this.isAvailable(osCore)) {
				const osContent = this.getCurrentContent(osCore)
				if (osContent && typeof osContent.set === 'function') {
					const capabilitiesStreamSchemaCoId = getRuntimeRef(this, RUNTIME_REF.OS_CAPABILITIES_STREAM)
					const capSchema = capabilitiesStreamSchemaCoId || EXCEPTION_FACTORIES.META_SCHEMA
					const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')
					const { coValue: capabilitiesStream } = await createCoValueForSpark(
						this,
						this.systemSparkCoId,
						{
							factory: capSchema,
							cotype: 'costream',
							dataEngine: this.dbEngine,
						},
					)
					osContent.set('capabilities', capabilitiesStream.id)
					capabilitiesId = capabilitiesStream.id
				}
			}
		}
		if (!factoriesId || typeof factoriesId !== 'string' || !factoriesId.startsWith('co_z')) {
			if (typeof process !== 'undefined' && process.env?.DEBUG) return false
		}
		const factoriesStore = await universalRead(this, factoriesId, null, null, null, {
			deepResolve: false,
			timeoutMs,
		})
		try {
			await waitForStoreReady(factoriesStore, factoriesId, timeoutMs)
		} catch (_error) {
			if (typeof process !== 'undefined' && process.env?.DEBUG) return false
		}
		const factoriesData = factoriesStore.value
		if (!factoriesData || factoriesData.error) {
			if (typeof process !== 'undefined' && process.env?.DEBUG) return false
		}
		return true
	}

	// Delegate methods for engines (Phase 4: route through peer, no direct db imports in engines)
	async resolve(identifier, opts = {}) {
		return resolve(this, identifier, opts)
	}
	async checkCotype(factoryCoId, expectedCotype) {
		return checkCotypeFn(this, factoryCoId, expectedCotype)
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
