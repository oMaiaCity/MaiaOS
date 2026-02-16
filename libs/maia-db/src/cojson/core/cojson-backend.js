/**
 * CoJSON Backend - Implements DBAdapter interface using CoJSON raw operations
 *
 * Directly translates database operations to native CoJSON operations.
 * No wrapping layer - works directly with CoJSON raw types (CoMap, CoList, CoStream).
 */

import { DBAdapter } from '@MaiaOS/operations/db-adapter'
import { EXCEPTION_SCHEMAS } from '../../schemas/registry.js'
import { getGlobalCoCache } from '../cache/coCache.js'
import * as crudCreate from '../crud/create.js'
import { extractCoStreamWithSessions } from '../crud/data-extraction.js'
import * as crudDelete from '../crud/delete.js'
import { read as universalRead } from '../crud/read.js'
import { waitForStoreReady } from '../crud/read-operations.js'
import * as crudUpdate from '../crud/update.js'
import * as groups from '../groups/groups.js'
import { wrapStorageWithIndexingHooks } from '../indexing/storage-hook-wrapper.js'
import { resolve } from '../schema/resolver.js'
import { seed } from '../schema/seed.js'
import { wrapSyncManagerWithValidation } from '../sync/validation-hook-wrapper.js'

export class CoJSONBackend extends DBAdapter {
	constructor(node, account, dbEngineOrOptions = null) {
		super()
		// Third param: dbEngine (has .backend, .execute) or options (e.g. { systemSpark })
		const isOptions =
			dbEngineOrOptions &&
			typeof dbEngineOrOptions === 'object' &&
			!dbEngineOrOptions.backend &&
			typeof dbEngineOrOptions.execute !== 'function'
		const dbEngine = isOptions ? null : dbEngineOrOptions
		const options = isOptions ? dbEngineOrOptions : {}
		this.node = node
		this.account = account
		this.dbEngine = dbEngine // Store dbEngine for runtime schema validation
		this.systemSpark = options.systemSpark ?? '°Maia' // Spark scope for registry lookups (passed from app)

		// Get node-aware unified cache (auto-clears if node changed)
		this.subscriptionCache = getGlobalCoCache(node)
		// This prevents stale group references after re-login
		// Note: Global unified cache is cleared automatically by getGlobalCoCache(node)
		// when it detects a node change, so we don't need to reset it here
		// Note: _storeSubscriptions removed - using unified cache for all caching

		// Wrap storage with indexing hooks (MORE RESILIENT than API hooks!)
		// This catches ALL writes: CRUD API, sync, direct CoJSON ops, etc.
		if (node.storage) {
			node.storage = wrapStorageWithIndexingHooks(node.storage, this)
		}

		// Wrap sync manager with validation hooks (CRITICAL for P2P architecture)
		// Validates remote transactions BEFORE they enter CRDT (before tryAddTransactions)
		// This ensures each peer validates incoming data before accepting it
		if (node.syncManager && dbEngine) {
			wrapSyncManagerWithValidation(node.syncManager, this, dbEngine)
		}

		// Schema indexing is handled ONLY via storage-level hooks (most resilient approach)
		// Storage hooks catch ALL writes: CRUD API, sync, direct CoJSON ops, etc.
		// No CRUD-level hooks needed - storage hooks are universal and resilient
	}

	/**
	 * Reset all subscription-related caches
	 *
	 * Called when new backend is created to clear stale subscriptions from previous session.
	 */
	_resetCaches() {
		// Note: Global unified cache is cleared automatically by getGlobalCoCache(node)
		// when it detects a node change, so we don't need to reset it here
	}

	/**
	 * Get a CoValue by ID
	 * @param {string} coId - CoValue ID
	 * @returns {CoValueCore|null} CoValueCore or null if not found
	 */
	getCoValue(coId) {
		return this.node.getCoValue(coId)
	}

	/**
	 * Get all CoValues from the node
	 * @returns {Map<string, CoValueCore>} Map of CoValue IDs to CoValueCore instances
	 */
	getAllCoValues() {
		return this.node.coValues || new Map()
	}

	/**
	 * Check if CoValue is available (has verified state)
	 * @param {CoValueCore} coValueCore - CoValueCore instance
	 * @returns {boolean} True if available
	 */
	isAvailable(coValueCore) {
		return coValueCore?.isAvailable() || false
	}

	/**
	 * Get current content from CoValueCore
	 * @param {CoValueCore} coValueCore - CoValueCore instance
	 * @returns {RawCoValue|null} Current content or null
	 */
	getCurrentContent(coValueCore) {
		if (!coValueCore || !coValueCore.isAvailable()) {
			return null
		}
		return coValueCore.getCurrentContent()
	}

	/**
	 * Get header from CoValueCore
	 * @param {CoValueCore} coValueCore - CoValueCore instance
	 * @returns {Object|null} Header object or null
	 */
	getHeader(coValueCore) {
		return coValueCore?.verified?.header || null
	}

	/**
	 * Get account (for create operations)
	 * @returns {RawAccount} Account CoMap
	 */
	getAccount() {
		return this.account
	}

	/**
	 * Get current session ID from the node
	 * @returns {string|null} Current session ID or null if node not available
	 */
	getCurrentSessionID() {
		if (!this.node || !this.node.currentSessionID) {
			return null
		}
		return this.node.currentSessionID
	}

	/**
	 * Read inbox CoStream with session structure and CRDT metadata preserved
	 * Backend-to-backend method for inbox processing
	 * @param {string} inboxCoId - Inbox CoStream co-id
	 * @returns {Object|null} CoStream data with sessions and CRDT metadata, or null if not found/not a CoStream
	 */
	readInboxWithSessions(inboxCoId) {
		const coValueCore = this.getCoValue(inboxCoId)
		if (!coValueCore || !this.isAvailable(coValueCore)) {
			return null
		}

		// Use backend-to-backend helper to extract CoStream with sessions
		return extractCoStreamWithSessions(this, coValueCore)
	}

	/**
	 * Get °Maia spark's group (for create operations)
	 * @returns {Promise<RawGroup|null>} °Maia spark's group
	 */
	async getMaiaGroup() {
		return groups.getMaiaGroup(this)
	}

	/**
	 * Get group information for a CoValue
	 * Extracts owner group, account members, and group members with roles
	 * @param {CoValueCore} coValueCore - CoValueCore instance
	 * @returns {Object|null} Group info object or null if no group found
	 */
	getGroupInfo(coValueCore) {
		if (!coValueCore || !this.isAvailable(coValueCore)) {
			return null
		}

		try {
			const header = this.getHeader(coValueCore)
			const content = this.getCurrentContent(coValueCore)
			const ruleset = coValueCore.ruleset || header?.ruleset

			if (!ruleset) {
				return null
			}

			// Determine owner group
			let ownerGroupId = null
			let ownerGroupCore = null
			let ownerGroupContent = null

			// Method 1: If this IS a group (ruleset.type === 'group')
			if (ruleset.type === 'group') {
				ownerGroupId = coValueCore.id
				ownerGroupCore = coValueCore
				ownerGroupContent = content
			} else if (ruleset.type === 'ownedByGroup' && ruleset.group) {
				// Method 2: For co-values owned by a group, extract owner from ruleset.group
				// This is the "ultimate" owner group that controls access to this co-value
				ownerGroupId = ruleset.group
				ownerGroupCore = this.getCoValue(ownerGroupId)
				if (ownerGroupCore && this.isAvailable(ownerGroupCore)) {
					ownerGroupContent = this.getCurrentContent(ownerGroupCore)
				}
			} else {
				// Method 3: Fallback - try to get owner from content.group (RawCoValue.group property)
				// This is less reliable but may work for some legacy cases
				if (content?.group) {
					const groupRef = content.group
					ownerGroupId = typeof groupRef === 'string' ? groupRef : groupRef.id || groupRef.$jazz?.id

					if (ownerGroupId) {
						ownerGroupCore = this.getCoValue(ownerGroupId)
						if (ownerGroupCore && this.isAvailable(ownerGroupCore)) {
							ownerGroupContent = this.getCurrentContent(ownerGroupCore)
						}
					}
				} else {
					// No owner group found
					return null
				}
			}

			if (!ownerGroupContent || typeof ownerGroupContent.addMember !== 'function') {
				// Not a valid group
				return null
			}

			// Get group info and include owner group ID
			const groupInfo = groups.getGroupInfoFromGroup(ownerGroupContent)
			if (groupInfo && ownerGroupId) {
				// Ensure groupId is set (it should be, but make it explicit)
				groupInfo.groupId = ownerGroupId
			}

			return groupInfo
		} catch (_error) {
			return null
		}
	}

	/**
	 * Get a Group CoValue by ID
	 * @param {string} groupId - Group CoValue ID
	 * @returns {Promise<RawGroup|null>} Group CoValue or null if not found
	 */
	async getGroup(groupId) {
		return await groups.getGroup(this.node, groupId)
	}

	/**
	 * Get group info from a RawGroup
	 * @param {RawGroup} group - RawGroup instance
	 * @returns {Object|null} Group info object
	 */
	getGroupInfoFromGroup(group) {
		return groups.getGroupInfoFromGroup(group)
	}

	/**
	 * Add a member to a group
	 * @param {RawGroup} group - Group CoValue
	 * @param {string} accountCoId - Account co-id (co_z...) - agent ID resolved internally, never exposed
	 * @param {string} role - Role name
	 * @returns {Promise<void>}
	 */
	async addGroupMember(group, accountCoId, role) {
		return await groups.addGroupMember(this.node, group, accountCoId, role, this)
	}

	/**
	 * Remove a member from a group
	 * @param {RawGroup} group - Group CoValue
	 * @param {string} memberId - Member ID to remove
	 * @returns {Promise<void>}
	 */
	async removeGroupMember(group, memberId) {
		return await groups.removeGroupMember(group, memberId)
	}

	/**
	 * Set a member's role in a group
	 * @param {RawGroup} group - Group CoValue
	 * @param {string} memberId - Member ID
	 * @param {string} role - New role name
	 * @returns {Promise<void>}
	 */
	async setGroupMemberRole(group, memberId, role) {
		return await groups.setGroupMemberRole(this.node, group, memberId, role)
	}

	// ============================================================================
	// Spark Operations (Group References)
	// ============================================================================

	/**
	 * Create a new Spark (CoMap that references a group)
	 * Creates a child group owned by °Maia spark's group, then creates Spark CoMap
	 * @param {string} name - Spark name
	 * @returns {Promise<Object>} Created spark with co-id
	 */
	async createSpark(name) {
		if (!this.account) {
			throw new Error('[CoJSONBackend] Account required for createSpark')
		}

		// Normalize: trim and ensure ° prefix (deduplicate if user already added °)
		const trimmed = typeof name === 'string' ? name.trim() : ''
		const normalizedName = trimmed && !trimmed.startsWith('°') ? `°${trimmed}` : trimmed

		const maiaGuardian = await this.getMaiaGroup()
		if (!maiaGuardian) {
			throw new Error('[CoJSONBackend] °Maia spark group not found')
		}

		const { createChildGroup } = await import('../groups/create.js')
		const childGroup = createChildGroup(this.node, maiaGuardian, { name: normalizedName })

		const sparkSchemaCoId = await resolve(this, '°Maia/schema/data/spark', { returnType: 'coId' })
		const capabilitiesSchemaCoId = await resolve(this, '°Maia/schema/os/capabilities', {
			returnType: 'coId',
		})
		const osSchemaCoId = await resolve(this, '°Maia/schema/os/os-registry', { returnType: 'coId' })
		const vibesSchemaCoId = await resolve(this, '°Maia/schema/os/vibes-registry', {
			returnType: 'coId',
		})
		if (!sparkSchemaCoId || !capabilitiesSchemaCoId || !osSchemaCoId || !vibesSchemaCoId) {
			throw new Error('[CoJSONBackend] Spark scaffold schemas not found')
		}

		const ctx = { node: this.node, account: this.account, guardian: childGroup }
		const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js')

		const { coValue: capabilities } = await createCoValueForSpark(ctx, null, {
			schema: capabilitiesSchemaCoId,
			cotype: 'comap',
			data: { guardian: childGroup.id },
			dbEngine: this.dbEngine,
		})
		const { coValue: os } = await createCoValueForSpark(ctx, null, {
			schema: osSchemaCoId,
			cotype: 'comap',
			data: { capabilities: capabilities.id },
			dbEngine: this.dbEngine,
		})
		const { coValue: vibes } = await createCoValueForSpark(ctx, null, {
			schema: vibesSchemaCoId,
			cotype: 'comap',
			data: {},
			dbEngine: this.dbEngine,
		})
		const { coValue: sparkCoMap } = await createCoValueForSpark(ctx, null, {
			schema: sparkSchemaCoId,
			cotype: 'comap',
			data: { name: normalizedName, os: os.id, vibes: vibes.id },
			dbEngine: this.dbEngine,
		})

		return {
			id: sparkCoMap.id,
			name: normalizedName,
			guardian: childGroup.id,
		}
	}

	/**
	 * Read Spark(s)
	 * @param {string} [id] - Specific spark co-id
	 * @param {string} [schema] - Schema co-id (optional)
	 * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) with spark data
	 */
	async readSpark(id, schema = null) {
		if (id) {
			// Single spark read
			return await this.read(null, id)
		}

		// Collection read - read from account.registries.sparks or indexed colist
		const sparkSchema = schema || '°Maia/schema/data/spark'
		const sparkSchemaCoId = await resolve(this, sparkSchema, { returnType: 'coId' })
		if (!sparkSchemaCoId) {
			throw new Error(`[CoJSONBackend] Spark schema not found: ${sparkSchema}`)
		}

		// Try reading from indexed colist first (reuses indexed data)
		return await this.read(sparkSchemaCoId)
	}

	/**
	 * Update Spark
	 * @param {string} id - Spark co-id
	 * @param {Object} data - Update data (name only; group is resolved via os.capabilities.guardian)
	 * @returns {Promise<Object>} Updated spark
	 */
	async updateSpark(id, data) {
		const { group, ...allowed } = data || {}
		if (typeof allowed.name === 'string') {
			const trimmed = allowed.name.trim()
			allowed.name = trimmed && !trimmed.startsWith('°') ? `°${trimmed}` : trimmed
		}
		const schemaCoId = await resolve(this, { fromCoValue: id }, { returnType: 'coId' })
		return await this.update(schemaCoId, id, allowed)
	}

	/**
	 * Delete Spark
	 * Removes spark and deletes Spark CoMap (registry updated via POST /register flow)
	 * @param {string} id - Spark co-id
	 * @returns {Promise<Object>} Deletion result
	 */
	async deleteSpark(id) {
		const schemaCoId = await resolve(this, { fromCoValue: id }, { returnType: 'coId' })

		// Delete Spark CoMap (removes from index automatically via storage hooks)
		await this.delete(schemaCoId, id)

		return { success: true, id }
	}

	// ============================================================================
	// DBAdapter Interface Implementation
	// ============================================================================

	/**
	 * Read data from database - directly translates to CoJSON raw operations
	 * @param {string} schema - Schema co-id (co_z...) or special exceptions:
	 *   - '@group' - For groups (no $schema, use ruleset.type === 'group')
	 *   - '@account' - For accounts (no $schema, use headerMeta.type === 'account')
	 *   - '@metaSchema' - For meta schema
	 * @param {string} [key] - Specific key (co-id) for single item
	 * @param {string[]} [keys] - Array of co-ids for batch reads
	 * @param {Object} [filter] - Filter criteria for collection queries
	 * @param {Object} [options] - Options for deep resolution
	 * @param {boolean} [options.deepResolve=true] - Enable/disable deep resolution (default: true)
	 * @param {number} [options.maxDepth=10] - Maximum depth for recursive resolution (default: 10)
	 * @param {number} [options.timeoutMs=5000] - Timeout for waiting for nested CoValues (default: 5000)
	 * @param {Object} [options.resolveReferences] - Configuration for resolving CoValue references (e.g., { fields: ['source', 'target'] })
	 * @param {Object} [options.map] - Map transformation config (e.g., { sender: '$$source.role', recipient: '$$target.role' })
	 * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) that hold current value and notify on updates
	 */
	async read(schema, key, keys, filter, options = {}) {
		const {
			deepResolve = true,
			maxDepth = 15, // TODO: temporarily scaled up from 10 for °Maia spark detail deep resolution
			timeoutMs = 5000,
			resolveReferences = null,
			map = null,
			onChange = null,
		} = options

		const readOptions = { deepResolve, maxDepth, timeoutMs, resolveReferences, map, onChange }

		// Batch read (multiple keys)
		if (keys && Array.isArray(keys)) {
			const stores = await Promise.all(
				keys.map((coId) => universalRead(this, coId, schema, null, schema, readOptions)),
			)
			return stores
		}

		// Single item read
		if (key) {
			return await universalRead(this, key, schema, null, schema, readOptions)
		}

		// Collection read (by schema) or all CoValues (if schema is null/undefined)
		if (!schema) {
			return await universalRead(this, null, null, filter, null, readOptions)
		}

		return await universalRead(this, null, schema, filter, null, readOptions)
	}

	/**
	 * Create new record - directly creates CoValue using CoJSON raw methods
	 * @param {string} schema - Schema co-id (co_z...) for data collections
	 * @param {Object} data - Data to create
	 * @param {Object} [options] - Optional settings
	 * @param {string} [options.spark='°Maia'] - Spark name for context (e.g. '°Maia', '@Maia')
	 * @returns {Promise<Object>} Created record with generated co-id
	 */
	async create(schema, data, options = {}) {
		return await crudCreate.create(this, schema, data, options)
	}

	/**
	 * Update existing record - directly updates CoValue using CoJSON raw methods
	 * @param {string} schema - Schema co-id (co_z...)
	 * @param {string} id - Record co-id to update
	 * @param {Object} data - Data to update
	 * @returns {Promise<Object>} Updated record
	 */
	async update(schema, id, data) {
		return await crudUpdate.update(this, schema, id, data)
	}

	/**
	 * Delete record - hard delete using CoJSON native operations
	 * Removes item from CoList (hard delete) and clears CoMap content
	 * @param {string} schema - Schema co-id (co_z...)
	 * @param {string} id - Record co-id to delete
	 * @returns {Promise<boolean>} true if deleted successfully
	 */
	async delete(schema, id) {
		return await crudDelete.deleteRecord(this, schema, id)
	}

	/**
	 * Get raw record from database (without normalization)
	 * Used for validation - returns stored data as-is (with $schema metadata, without id)
	 * @param {string} id - Record co-id
	 * @returns {Promise<Object|null>} Raw stored record or null if not found
	 */
	async getRawRecord(id) {
		const coValueCore = this.getCoValue(id)
		if (!coValueCore || !this.isAvailable(coValueCore)) {
			return null
		}

		const content = this.getCurrentContent(coValueCore)
		const header = this.getHeader(coValueCore)
		const headerMeta = header?.meta || null
		const schema = headerMeta?.$schema || null

		// Return raw data WITHOUT id (id is the key, not stored)
		// Include $schema for validation
		if (content?.get && typeof content.get === 'function') {
			// CoMap: extract properties without id
			const raw = {
				$schema: schema, // Metadata for querying/validation
			}

			// Handle both CoMap objects (with .keys() method) and plain objects
			const keys =
				content.keys && typeof content.keys === 'function' ? content.keys() : Object.keys(content)
			for (const key of keys) {
				raw[key] = content.get && typeof content.get === 'function' ? content.get(key) : content[key]
			}

			return raw
		}

		// For CoLists, return array without id
		if (content?.toJSON) {
			try {
				return content.toJSON()
			} catch (_e) {
				return null
			}
		}

		return null
	}

	/**
	 * Seed database with configs, schemas, and initial data
	 * @param {Object} configs - Config registry {vibe, styles, actors, views, contexts, states, interfaces}
	 * @param {Object} schemas - Schema definitions
	 * @param {Object} data - Initial application data {todos: [], ...}
	 * @param {Object} [options] - Options (forceFreshSeed: bypass co-value checks, always bootstrap)
	 * @returns {Promise<Object>} Summary of what was seeded
	 */
	async seed(configs, schemas, data, options = {}) {
		if (!this.account) {
			throw new Error('[CoJSONBackend] Account required for seed')
		}

		// Pass backend instance so dbEngine is available for schema validation during seeding
		return await seed(this.account, this.node, configs, schemas, data || {}, this, options)
	}

	/**
	 * Ensure spark.os (registries.sparks[°Maia].os) is loaded and ready for schema-dependent operations
	 *
	 * Progressive loading: spark.os is NOT required for account loading itself
	 * It's only needed for schema resolution, which can happen progressively as spark.os becomes available
	 *
	 * This function is called non-blocking during boot - MaiaOS boots immediately without waiting
	 * Schema resolution will return null until spark.os is ready, then progressively start working
	 *
	 * @param {Object} [options] - Options
	 * @param {number} [options.timeoutMs=10000] - Timeout for waiting for spark.os to be ready
	 * @returns {Promise<boolean>} True if spark.os is ready, false if failed
	 */
	async ensureAccountOsReady(options = {}) {
		const { timeoutMs = 10000 } = options

		if (!this.account) {
			if (process.env.DEBUG) return false
		}

		const osId = await groups.getSparkOsId(this, '°Maia')
		if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
			if (process.env.DEBUG) return false
		}

		const osStore = await universalRead(this, osId, null, null, null, {
			deepResolve: false,
			timeoutMs,
		})
		try {
			await waitForStoreReady(osStore, osId, timeoutMs)
		} catch (_error) {
			if (process.env.DEBUG) return false
		}

		const osData = osStore.value
		if (!osData || osData.error) {
			if (process.env.DEBUG) return false
		}

		let schematasId = osData.schematas
		if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
			// Get spark.os CoValueCore to update it
			const osCore = this.getCoValue(osId)
			if (!osCore || !osCore.isAvailable()) {
				if (process.env.DEBUG) return false
			}

			const osContent = this.getCurrentContent(osCore)
			if (!osContent || typeof osContent.set !== 'function') {
				if (process.env.DEBUG) return false
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
				dbEngine: this.dbEngine,
			})
			osContent.set('schematas', schematasCoMap.id)
			schematasId = schematasCoMap.id

			// Reload osData to get updated schematasId
			const osStore2 = await universalRead(this, osId, null, null, null, {
				deepResolve: false,
				timeoutMs: 2000,
			})
			try {
				await waitForStoreReady(osStore2, osId, 2000)
				const osData2 = osStore2.value
				if (osData2 && !osData2.error) {
					schematasId = osData2.schematas || schematasId
				}
			} catch (_error) {
				// Continue with schematasId we created
			}
		}

		if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
			if (process.env.DEBUG) return false
		}

		const schematasStore = await universalRead(this, schematasId, null, null, null, {
			deepResolve: false,
			timeoutMs,
		})
		try {
			await waitForStoreReady(schematasStore, schematasId, timeoutMs)
		} catch (_error) {
			if (process.env.DEBUG) return false
		}

		const schematasData = schematasStore.value
		if (!schematasData || schematasData.error) {
			if (process.env.DEBUG) return false
		}

		return true
	}
}
