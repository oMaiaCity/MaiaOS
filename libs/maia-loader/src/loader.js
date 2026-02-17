/**
 * MaiaOS Loader
 *
 * Single entry point for the MaiaOS Operating System
 * Central source of truth for booting and managing the OS
 * Imports engines from @MaiaOS/engines and orchestrates them
 *
 * Usage:
 *   import { MaiaOS } from '@MaiaOS/loader';
 *   const maia = await MaiaOS.boot(config);
 *   maia.do({ op: 'read', schema, key, filter, ... });
 */

import { resolve, resolveReactive } from '@MaiaOS/db'
import {
	ActorEngine,
	DataEngine,
	MaiaScriptEvaluator,
	ModuleRegistry,
	ProcessEngine,
	Runtime,
	StyleEngine,
	ViewEngine,
} from '@MaiaOS/engines'
import * as aiModule from '@MaiaOS/engines/modules/ai.module.js'
import * as coreModule from '@MaiaOS/engines/modules/core.module.js'
import * as dbModule from '@MaiaOS/engines/modules/db.module.js'
import * as sparksModule from '@MaiaOS/engines/modules/sparks.module.js'
import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper'

// Store pre-loaded modules for registry
const preloadedModules = {
	db: dbModule,
	core: coreModule,
	ai: aiModule,
}

/**
 * MaiaOS - Operating System for Actor-based Applications
 */
export class MaiaOS {
	constructor() {
		this.moduleRegistry = null
		this.evaluator = null
		this.processEngine = null
		this.styleEngine = null
		this.viewEngine = null
		this.actorEngine = null
		this.subscriptionEngine = null // Subscription management engine
		this.dataEngine = null // DataEngine - maia.do({ op, schema, key, ... })

		// Peer layer (node + account) for maia-city compatibility
		this._node = null
		this._account = null

		// Sync configuration - single source of truth
		this._syncDomain = null
	}

	/**
	 * Compatibility property for maia-city and other tools
	 * Exposes node and account for peer access
	 */
	get id() {
		if (!this._node || !this._account) {
			return null
		}
		return {
			maiaId: this._account,
			node: this._node,
		}
	}

	/**
	 * MaiaPeer - P2P layer (node + account) for tools that need direct peer access
	 * @returns {{ node: LocalNode, account: RawAccount }|null}
	 */
	get peer() {
		if (this._node && this._account) {
			return { node: this._node, account: this._account }
		}
		const peer = this.dataEngine?.peer
		if (peer?.node && peer?.account) {
			return { node: peer.node, account: peer.account }
		}
		return null
	}

	/**
	 * Get all CoValues from the node (for maia-city compatibility)
	 * @returns {Array} Array of CoValue metadata
	 */
	getAllCoValues() {
		if (!this._node) {
			return []
		}

		const allCoValues = []
		const coValuesMap = this._node.coValues

		if (coValuesMap && typeof coValuesMap.entries === 'function') {
			for (const [coId, coValueCore] of coValuesMap.entries()) {
				try {
					if (!coValueCore.isAvailable()) {
						allCoValues.push({
							id: coId,
							type: 'loading',
							schema: null,
							headerMeta: null,
							keys: 'N/A',
							content: null,
							createdAt: null,
						})
						continue
					}

					const content = coValueCore.getCurrentContent()
					const header = coValueCore.verified?.header
					const headerMeta = header?.meta || null
					const schema = headerMeta?.$schema || null
					const createdAt = header?.createdAt || null

					let keysCount = 'N/A'
					if (content?.keys && typeof content.keys === 'function') {
						try {
							const keys = content.keys()
							keysCount = keys.length
						} catch (_e) {
							// Ignore
						}
					}

					const type = content?.type || 'unknown'

					let specialContent = null
					if (type === 'costream') {
						try {
							const streamData = content.toJSON()
							if (streamData instanceof Uint8Array) {
								specialContent = {
									type: 'stream',
									itemCount: 'binary',
									preview: `${streamData.length} bytes`,
								}
							} else if (streamData && typeof streamData === 'object') {
								const allItems = []
								for (const sessionKey in streamData) {
									if (Array.isArray(streamData[sessionKey])) {
										allItems.push(...streamData[sessionKey])
									}
								}
								specialContent = {
									type: 'stream',
									itemCount: allItems.length,
									preview: allItems.slice(0, 3),
								}
							}
						} catch (_e) {
							// Ignore
						}
					} else if (type === 'coplaintext') {
						try {
							specialContent = {
								type: 'plaintext',
								content: content.text || content.toString(),
							}
						} catch (_e) {
							// Ignore
						}
					}

					allCoValues.push({
						id: coId,
						type: type,
						schema: schema,
						headerMeta: headerMeta,
						keys: keysCount,
						content: specialContent || content,
						createdAt: createdAt,
					})
				} catch (error) {
					allCoValues.push({
						id: coId,
						type: 'error',
						schema: null,
						headerMeta: null,
						keys: 'N/A',
						content: null,
						createdAt: null,
						error: error.message,
					})
				}
			}
		}

		return allCoValues
	}

	/**
	 * Boot the operating system
	 * @param {Object} config - Boot configuration
	 * @param {Object} [config.node] - LocalNode instance (required if peer not provided)
	 * @param {Object} [config.account] - RawAccount instance (required if peer not provided)
	 * @param {Object} [config.peer] - Pre-initialized peer/MaiaDB (alternative to node+account)
	 * @param {string} [config.syncDomain] - Sync service domain (overrides env vars, single source of truth)
	 * @param {'human' | 'agent'} [config.mode] - Operational mode (default: detect from env vars)
	 * @returns {Promise<MaiaOS>} Booted OS instance
	 * @throws {Error} If neither peer nor node+account is provided (or agent mode credentials missing)
	 */
	static async boot(config = {}) {
		const os = new MaiaOS()

		// Booting MaiaOS

		// Detect operational mode from config or environment variables
		const mode =
			config.mode ||
			(typeof process !== 'undefined' && process.env?.MAIA_MODE) ||
			(typeof import.meta !== 'undefined' && import.meta.env?.MAIA_MODE) ||
			(typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAIA_MODE) ||
			'human' // Default to human mode

		// Store sync domain (single source of truth for sync configuration)
		// If provided, use it; otherwise will be determined from env vars when needed
		if (config.syncDomain) {
			os._syncDomain = config.syncDomain
		}

		// Handle agent mode: automatically load/create account if node/account not provided
		if (mode === 'agent' && !config.node && !config.account && !config.peer) {
			// Import agent mode functions dynamically (to avoid circular dependencies)
			const { loadOrCreateAgentAccount } = await import('@MaiaOS/self')

			// Get credentials from environment variables (AVEN_MAIA_ACCOUNT, AVEN_MAIA_SECRET)
			const accountID =
				(typeof process !== 'undefined' && process.env?.AVEN_MAIA_ACCOUNT) ||
				(typeof import.meta !== 'undefined' && import.meta.env?.AVEN_MAIA_ACCOUNT) ||
				(typeof import.meta !== 'undefined' && import.meta.env?.VITE_AVEN_MAIA_ACCOUNT)
			const agentSecret =
				(typeof process !== 'undefined' && process.env?.AVEN_MAIA_SECRET) ||
				(typeof import.meta !== 'undefined' && import.meta.env?.AVEN_MAIA_SECRET) ||
				(typeof import.meta !== 'undefined' && import.meta.env?.VITE_AVEN_MAIA_SECRET)

			if (!accountID || !agentSecret) {
				throw new Error(
					'Agent mode requires AVEN_MAIA_ACCOUNT and AVEN_MAIA_SECRET environment variables. Run `bun agent:generate` to generate credentials.',
				)
			}

			const agentResult = await loadOrCreateAgentAccount({
				accountID,
				agentSecret,
				syncDomain: config.syncDomain || null,
				createName: 'Maia Agent',
			})

			// Store node and account from agent mode
			os._node = agentResult.node
			os._account = agentResult.account
		} else {
			// Human mode or explicit node/account provided
			// Store node and account for CoJSON backend compatibility
			if (config.node && config.account) {
				os._node = config.node
				os._account = config.account
			}
			// Store agentSecret for getCapabilityToken (UCAN-like auth, in-memory only)
			if (config.agentSecret) {
				os._agentSecret = config.agentSecret
			}
		}

		// Initialize database (requires peer via node+account or pre-initialized peer)
		const peer = await MaiaOS._initializeDatabase(os, config)

		// OPTIMIZATION: Start loading spark.os (account.registries.sparks[°Maia].os) in background (non-blocking)
		// spark.os is NOT required for account loading - it's only needed for schema resolution
		// Schema resolution can happen progressively as spark.os becomes available
		// This allows MaiaOS to boot immediately without waiting 5+ seconds for spark.os to sync
		if (peer && typeof peer.ensureAccountOsReady === 'function') {
			// Start loading spark.os in background (non-blocking)
			// 15s timeout for slow sync (e.g. first load to moai.next.maia.city)
			peer
				.ensureAccountOsReady({ timeoutMs: 15000 })
				.then((accountOsReady) => {
					if (!accountOsReady) {
					}
				})
				.catch((_err) => {})
			// Don't await - let it load in background while we continue booting
		}

		// Set schema resolver for runtime validation (engines need dataEngine for schema lookups)
		const { setSchemaResolver } = await import('@MaiaOS/schemata/validation.helper')
		setSchemaResolver({ dataEngine: os.dataEngine })

		// Initialize engines
		MaiaOS._initializeEngines(os, config)

		// Load modules
		await MaiaOS._loadModules(os, config)

		// Start Runtime (inbox watching for browser agents)
		const runtimeType = config.runtimeType || 'browser'
		const runtime = new Runtime(os.dataEngine, os.actorEngine, runtimeType, {
			getCapabilityToken: (opts) => os.getCapabilityToken(opts),
		})
		os.actorEngine.runtime = runtime
		os.viewEngine.runtime = runtime
		os.runtime = runtime
		await runtime.start()

		// MaiaOS booted

		return os
	}

	/**
	 * Initialize database peer and engine
	 * Requires either a pre-initialized peer (MaiaDB) or CoJSON node+account
	 * @param {MaiaOS} os - OS instance
	 * @param {Object} config - Boot configuration
	 * @param {Object} [config.node] - LocalNode instance (required if peer not provided)
	 * @param {Object} [config.account] - RawAccount instance (required if peer not provided)
	 * @param {Object} [config.peer] - Pre-initialized peer/MaiaDB (alternative to node+account)
	 * @returns {Promise<Object>} Initialized peer (MaiaDB or provided peer)
	 * @throws {Error} If neither peer nor node+account is provided
	 */
	static async _initializeDatabase(os, config = {}) {
		// Create minimal evaluator for DataEngine (expression evaluation in updates)
		const evaluator = new MaiaScriptEvaluator()
		const dbOptions = {
			evaluator,
			getMoaiBaseUrl: config.getMoaiBaseUrl ?? null,
		}

		// If peer is provided, use it
		if (config.peer) {
			os.dataEngine = new DataEngine(config.peer, dbOptions)
			return config.peer
		}

		// If node and account are provided, create MaiaDB peer
		if (config.node && config.account) {
			const { MaiaDB } = await import('@MaiaOS/db')
			const maiaDB = new MaiaDB(
				{ node: config.node, account: config.account },
				{ systemSpark: '°Maia' },
			)
			os.dataEngine = new DataEngine(maiaDB, dbOptions)
			maiaDB.dbEngine = os.dataEngine
			return maiaDB
		}

		// No peer provided - throw error
		throw new Error(
			'MaiaOS.boot() requires either a peer or node+account. ' +
				'Provide either: { peer } or { node, account }',
		)
	}

	/**
	 * Initialize all engines and wire dependencies
	 * @param {MaiaOS} os - OS instance
	 * @param {Object} config - Boot configuration
	 */
	static _initializeEngines(os, config) {
		// Initialize module registry
		os.moduleRegistry = new ModuleRegistry()

		// Initialize engines
		// CRITICAL: Pass dataEngine to evaluator for runtime schema validation (no fallbacks)
		os.evaluator = new MaiaScriptEvaluator(os.moduleRegistry, { dataEngine: os.dataEngine })
		os.toolEngine = new ToolEngine(os.moduleRegistry)

		// Store engines in registry for module access
		os.moduleRegistry._toolEngine = os.toolEngine
		os.moduleRegistry._dataEngine = os.dataEngine

		os.processEngine = new ProcessEngine(os.evaluator)
		os.styleEngine = new StyleEngine()
		// Clear cache on boot in development only
		if (config.isDevelopment || import.meta.env?.DEV) {
			os.styleEngine.clearCache()
		}
		os.viewEngine = new ViewEngine(os.evaluator, null, os.moduleRegistry)

		// InboxEngine: validation + delivery (injected into ActorEngine)
		os.inboxEngine = new InboxEngine(os.dataEngine)
		os.actorEngine = new ActorEngine(os.styleEngine, os.viewEngine, os.processEngine, os.inboxEngine)
		os.inboxEngine.actorEngine = os.actorEngine

		// SubscriptionEngine eliminated - all subscriptions handled via direct read() + ReactiveStore

		// Pass DataEngine to engines (for internal config loading)
		os.actorEngine.dataEngine = os.dataEngine
		os.viewEngine.dataEngine = os.dataEngine
		os.styleEngine.dataEngine = os.dataEngine
		os.stateEngine.dataEngine = os.dataEngine

		// Store reference to MaiaOS in actorEngine (for @db tool access)
		os.actorEngine.os = os

		// Pass ActorOps and BlobEngine to ViewEngine (Loader wires; no circular ref)
		os.viewEngine.actorOps = os.actorEngine
		os.viewEngine.blobEngine = os.blobEngine
	}

	/**
	 * Load modules
	 * @param {MaiaOS} os - OS instance
	 * @param {Object} config - Boot configuration
	 */
	static async _loadModules(os, config) {
		// Load modules (default: db, core)
		const modules = config.modules || ['db', 'core']

		for (const moduleName of modules) {
			try {
				// Check if module is pre-loaded (for bundled standalone kernel)
				if (preloadedModules[moduleName]) {
					const module = preloadedModules[moduleName]
					// Register the pre-loaded module directly
					if (module.default && typeof module.default.register === 'function') {
						await module.default.register(os.moduleRegistry)
					} else if (typeof module.register === 'function') {
						await module.register(os.moduleRegistry)
					}
				} else {
					// Fallback to dynamic import (for development)
					await os.moduleRegistry.loadModule(moduleName)
				}
			} catch (_error) {}
		}
	}

	/**
	 * Create an actor
	 * @param {string} actorPath - Path to actor.maia file
	 * @param {HTMLElement} container - Container element
	 * @returns {Promise<Object>} Created actor
	 */
	async createActor(actorPath, container) {
		// Use universal API directly - no wrapper needed
		let actorConfig
		if (typeof actorPath === 'object' && actorPath !== null) {
			// Already have config object - just use it
			actorConfig = actorPath
		} else if (typeof actorPath === 'string') {
			// Resolve path to co-id at edge (runtime uses co-ids only)
			let actorCoId = actorPath
			if (!actorPath.startsWith('co_z')) {
				actorCoId = await this.actorEngine.dataEngine.execute({
					op: 'resolve',
					humanReadableKey: actorPath,
					spark: '°Maia',
					returnType: 'coId',
				})
				if (!actorCoId?.startsWith?.('co_z')) {
					throw new Error(`[MaiaOS] createActor: failed to resolve actor path: ${actorPath}`)
				}
			}
			const actorSchemaCoId = await resolve(
				this.actorEngine.dataEngine.peer,
				{ fromCoValue: actorPath },
				{ returnType: 'coId' },
			)
			const store = await this.actorEngine.dataEngine.execute({
				op: 'read',
				schema: actorSchemaCoId,
				key: actorCoId,
			})
			actorConfig = store.value
		} else {
			throw new Error(
				`[MaiaOS] createActor expects co-id (co_z...), path string, or config object, got: ${typeof actorPath}`,
			)
		}
		const actor = await this.runtime.createActorForView(actorConfig, container)
		return actor
	}

	/**
	 * Load an aven by key or co-id from account/database (no arbitrary URL loading)
	 * @param {string} avenKeyOrCoId - Aven key (e.g., "todos") or co-id (co_z...) to lookup from account
	 * @param {HTMLElement} container - Container element
	 * @param {string} [spark='°Maia'] - Spark name when using key lookup
	 * @returns {Promise<{aven: Object, actor: Object}>} Aven metadata and actor instance
	 */
	async loadAven(avenKeyOrCoId, container, spark = '°Maia') {
		return await this.loadAvenFromAccount(avenKeyOrCoId, container, spark)
	}

	/**
	 * Load an aven from registries.sparks[spark].avens or directly by co-id
	 * Supports: (1) aven key (e.g., "todos") - lookup via spark.avens map, (2) co-id (co_z...) - direct load from database
	 * SECURITY: No arbitrary URL loading - avens load only from CoJSON database (account-scoped)
	 * @param {string} avenKeyOrCoId - Aven key in spark's avens (e.g., "todos") or aven co-id (co_z...)
	 * @param {HTMLElement} container - Container element
	 * @param {string} [spark='°Maia'] - Spark name (used only when avenKeyOrCoId is a key, not a co-id)
	 * @returns {Promise<{aven: Object, actor: Object}>} Aven metadata and actor instance
	 */
	async loadVibeFromAccount(vibeKeyOrCoId, container, spark = '°Maia') {
		if (!this.dataEngine || !this._account) {
			throw new Error('[Loader] Cannot load vibe from account - dataEngine or account not available')
		}

		// Co-id: load directly from database (skip spark.avens lookup)
		if (typeof avenKeyOrCoId === 'string' && avenKeyOrCoId.startsWith('co_z')) {
			return await this.loadAvenFromDatabase(avenKeyOrCoId, container, null)
		}

		const account = this._account

		// Step 1: Read account CoMap
		const accountStore = await this.dataEngine.execute({
			op: 'read',
			schema: '@account',
			key: account.id,
		})

		const accountData = accountStore.value
		if (!accountData) {
			throw new Error('[Kernel] Failed to read account CoMap')
		}

		// Step 2: Get account.registries.sparks CoMap co-id
		const registriesId = accountData.registries
		if (!registriesId || typeof registriesId !== 'string' || !registriesId.startsWith('co_')) {
			throw new Error(
				`[Kernel] account.registries not found. Link account via sync or ensure bootstrap has run. Account data: ${JSON.stringify({ id: accountData.id, hasRegistries: !!accountData.registries })}`,
			)
		}

		const registriesStore = await this.dataEngine.execute({
			op: 'read',
			schema: null,
			key: registriesId,
		})
		const registriesData = registriesStore.value
		if (!registriesData || registriesData.error) {
			throw new Error(
				`[Kernel] account.registries not available: ${registriesData?.error || 'Unknown error'}`,
			)
		}
		// registriesData is flat from extractCoValueData
		const sparksId = registriesData.sparks
		if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_')) {
			throw new Error(`[Kernel] registries.sparks not found`)
		}

		// Step 3: Read registries.sparks CoMap
		const sparksStore = await this.dataEngine.execute({
			op: 'read',
			schema: sparksId,
			key: sparksId,
		})

		const sparksData = sparksStore.value
		if (!sparksData || sparksData.error) {
			throw new Error(
				`[Kernel] registries.sparks not available: ${sparksData?.error || 'Unknown error'}`,
			)
		}
		// sparksData is flat from extractCoValueData

		// Step 4: Get spark CoMap co-id from sparks[spark]
		const sparkCoIdRaw = sparksData[spark]
		const sparkCoId =
			typeof sparkCoIdRaw === 'string' && sparkCoIdRaw.startsWith('co_') ? sparkCoIdRaw : null
		if (!sparkCoId) {
			const availableSparks = Object.keys(sparksData).filter(
				(k) =>
					k !== 'id' &&
					k !== '$schema' &&
					k !== 'type' &&
					typeof sparksData[k] === 'string' &&
					sparksData[k].startsWith('co_'),
			)
			throw new Error(
				`[Kernel] Spark "${spark}" not found in registries.sparks. Available: ${availableSparks.join(', ') || 'none'}`,
			)
		}

		// Step 5: Read spark CoMap to get spark.vibes (by co-id)
		const sparkStore = await this.dataEngine.execute({
			op: 'read',
			schema: null,
			key: sparkCoId,
		})

		const sparkData = sparkStore.value
		if (!sparkData || sparkData.error) {
			throw new Error(
				`[Kernel] Spark "${spark}" not available: ${sparkData?.error || 'Unknown error'}`,
			)
		}
		// sparkData is flat from extractCoValueData

		const avensId = sparkData.avens
		if (!avensId || typeof avensId !== 'string' || !avensId.startsWith('co_')) {
			throw new Error(`[Kernel] Spark "${spark}" has no avens registry. Ensure seeding has run.`)
		}

		// Step 6: Read spark.vibes CoMap
		const vibesStore = await this.dataEngine.execute({
			op: 'read',
			schema: avensId,
			key: avensId,
		})

		const avensData = avensStore.value
		if (!avensData || avensData.error) {
			throw new Error(
				`[Kernel] Spark "${spark}" avens not available: ${avensData?.error || 'Unknown error'}`,
			)
		}
		// avensData is flat from extractCoValueData

		const avenCoId = avensData[avenKeyOrCoId]
		if (!avenCoId || typeof avenCoId !== 'string' || !avenCoId.startsWith('co_')) {
			const availableAvens = Object.keys(avensData).filter(
				(k) =>
					k !== 'id' &&
					k !== '$schema' &&
					k !== 'type' &&
					typeof avensData[k] === 'string' &&
					avensData[k].startsWith('co_'),
			)
			throw new Error(
				`[Kernel] Aven '${avenKeyOrCoId}' not found in ${spark}.avens. Available: ${availableAvens.join(', ') || 'none'}`,
			)
		}

		return await this.loadAvenFromDatabase(avenCoId, container, avenKeyOrCoId)
	}

	/**
	 * Load a vibe from database (maia.do)
	 * @param {string} vibeId - Vibe ID (co-id or human-readable like "°Maia/vibe/todos")
	 * @param {HTMLElement} container - Container element
	 * @param {string} [avenKey] - Optional aven key for actor reuse tracking (e.g., 'todos')
	 * @returns {Promise<{aven: Object, actor: Object}>} Aven metadata and actor instance
	 */
	async loadAvenFromDatabase(avenId, container, avenKey = null) {
		if (!avenId.startsWith('co_z')) {
			throw new Error(
				`[Kernel] Aven ID must be co-id at runtime: ${avenId}. This should have been resolved during seeding.`,
			)
		}
		const avenCoId = avenId

		// Load vibe CoValue first (without schema filter - read CoValue directly)
		// This allows us to extract schema co-id from headerMeta.$schema
		// Loading vibe from database

		const vibeStore = await this.dataEngine.execute({
			op: 'read',
			schema: null,
			key: avenCoId,
		})

		// Extract schema co-id from vibe's headerMeta.$schema using fromCoValue pattern
		const schemaStore = await this.dataEngine.execute({
			op: 'schema',
			fromCoValue: avenCoId,
		})
		const avenSchemaCoId = schemaStore.value?.$id || avenStore.value?.$schema

		if (!avenSchemaCoId) {
			throw new Error(
				`[Kernel] Failed to extract schema co-id from aven ${avenCoId}. Aven must have $schema in headerMeta.`,
			)
		}

		const store = avenStore
		const aven = store.value

		// Store is already loaded by peer (operations API abstraction)
		let vibe = store.value

		// Debug: Check what we got
		// Store value loaded

		if (!vibe || vibe.error) {
			// Try direct read to see what's returned
			try {
				const directStore = await this.dataEngine.execute({
					op: 'read',
					schema: null,
					key: avenCoId,
				})
			} catch (_err) {}
			throw new Error(`Aven not found in database: ${avenId} (co-id: ${avenCoId})`)
		}

		// Convert CoJSON format (properties array) to plain object if needed
		if (vibe.properties && Array.isArray(vibe.properties)) {
			// CoJSON returns objects with properties array - convert to plain object
			const plainVibe = {}
			for (const prop of vibe.properties) {
				plainVibe[prop.key] = prop.value
			}
			// Preserve metadata
			if (vibe.id) plainVibe.id = vibe.id
			if (vibe.$schema) plainVibe.$schema = vibe.$schema // Use $schema from headerMeta
			if (vibe.type) plainVibe.type = vibe.type
			vibe = plainVibe
		}

		// Validate vibe structure using schema (load from schemaStore we already have)
		const schema = schemaStore.value
		if (schema) {
			await validateAgainstSchemaOrThrow(schema, aven, 'aven')
		}

		const actorCoId = aven.actor

		if (!actorCoId) {
			throw new Error(
				`[MaiaOS] Aven ${avenId} (${avenCoId}) does not have an 'actor' property. Aven structure: ${JSON.stringify(Object.keys(aven))}`,
			)
		}

		if (!actorCoId.startsWith('co_z')) {
			throw new Error(
				`[Kernel] Actor ID must be co-id at runtime: ${actorCoId}. This should have been resolved during seeding.`,
			)
		}

		// UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema extraction
		// Returns ReactiveStore that updates when schema becomes available
		const actorSchemaStore = resolveReactive(
			this.dataEngine.peer,
			{ fromCoValue: actorCoId },
			{ returnType: 'coId' },
		)

		// Subscribe and wait for schema to resolve (reactive - uses subscriptions, not blocking waits)
		let unsubscribe // Declare before Promise to avoid temporal dead zone
		const actorSchemaCoId = await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				if (unsubscribe) unsubscribe()
				reject(
					new Error(
						`[Kernel] Timeout waiting for actor schema to resolve for ${actorCoId} after 10000ms`,
					),
				)
			}, 10000)

			unsubscribe = actorSchemaStore.subscribe((state) => {
				if (state.loading) {
					return // Still loading
				}

				clearTimeout(timeout)
				if (unsubscribe) unsubscribe()

				if (state.error || !state.schemaCoId) {
					reject(
						new Error(
							`[Kernel] Failed to extract schema co-id from actor ${actorCoId}: ${state.error || 'Schema not found'}`,
						),
					)
				} else {
					resolve(state.schemaCoId)
				}
			})
		})

		// Verify actor exists in database (using read operation with reactive store)
		const actorStore = await this.dataEngine.execute({
			op: 'read',
			schema: actorSchemaCoId,
			key: actorCoId,
		})
		const actorExists = actorStore.value
		if (!actorExists) {
			throw new Error(
				`[MaiaOS] Actor with co-id ${actorCoId} not found in database. The actor may not have been seeded correctly.`,
			)
		}

		// Destroy any existing actors for this aven (destroy-on-switch lifecycle)
		if (avenKey) {
			this.runtime.destroyActorsForAven(avenKey)
		}

		const actorConfig = actorStore.value
		const actor = await this.runtime.createActorForView(actorConfig, container, avenKey)

		// Create root actor with vibeKey for tracking
		const actor = await this.actorEngine.createActor(actorConfig, container, vibeKey)

		return { vibe, actor }
	}

	/**
	 * Get actor by ID
	 * @param {string} actorId - Actor ID
	 * @returns {Object|null} Actor instance
	 */
	getActor(actorId) {
		return this.actorEngine.getActor(actorId)
	}

	/**
	 * Deliver event to target actor (inbox-only, persisted via CoJSON)
	 * @param {string} senderId - Sender actor co-id
	 * @param {string} targetId - Target actor co-id (or human-readable; resolved via CoJSON)
	 * @param {string} type - Message type
	 * @param {Object} payload - Resolved payload (no expressions)
	 */
	deliverEvent(senderId, targetId, type, payload) {
		return this.actorEngine.deliverEvent(senderId, targetId, type, payload)
	}

	/**
	 * Execute database operation (internal use + @db tool)
	 * @param {Object} payload - Operation payload {op: 'query|create|update|delete|seed', ...}
	 * @returns {Promise<any>} Operation result; for write ops: throws on error, returns data on success (backward compat for state machines)
	 */
	async do(payload) {
		const result = await this.dataEngine.execute(payload)
		const WRITE_OPS = new Set([
			'create',
			'update',
			'delete',
			'append',
			'push',
			'seed',
			'addSparkMember',
			'removeSparkMember',
		])
		if (result && result.ok === false && WRITE_OPS.has(payload?.op)) {
			const msgs = result.errors?.map((e) => e.message).join('; ') || 'Operation failed'
			const err = new Error(`[db] ${payload.op} failed: ${msgs}`)
			err.errors = result.errors
			throw err
		}
		if (result && result.ok === true && typeof result.data !== 'undefined') {
			return result.data
		}
		return result
	}

	/**
	 * Get sync domain (single source of truth)
	 * Returns the sync domain configured during boot, or null if not set
	 * @returns {string|null} Sync domain or null
	 */
	getSyncDomain() {
		return this._syncDomain
	}

	/**
	 * Expose engines for debugging
	 */
	getEngines() {
		return {
			actorEngine: this.actorEngine,
			viewEngine: this.viewEngine,
			styleEngine: this.styleEngine,
			stateEngine: this.stateEngine,
			toolEngine: this.toolEngine,
			dataEngine: this.dataEngine,
			evaluator: this.evaluator,
			moduleRegistry: this.moduleRegistry,
		}
	}
}
