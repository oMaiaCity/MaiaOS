/**
 * MaiaOS runtime kernel
 *
 * Single entry point for booting and managing the OS.
 *
 * Usage:
 *   import { MaiaOS } from '@MaiaOS/runtime';
 *   const maia = await MaiaOS.boot(config);
 *   maia.do({ op: 'read', schema, key, filter, ... });
 */

import { resolve, resolveReactive } from '@MaiaOS/db'
import { validateAgainstFactoryOrThrow } from '@MaiaOS/validation/validation.helper'
import { ActorEngine } from './engines/actor.engine.js'
import { DataEngine } from './engines/data.engine.js'
import { ProcessEngine } from './engines/process.engine.js'
import { StyleEngine } from './engines/style.engine.js'
import { ViewEngine } from './engines/view.engine.js'
import { Registry as ModuleRegistry, registerBuiltinModules } from './modules/registry.js'
import { Runtime } from './runtimes/browser.js'
import { Evaluator as MaiaScriptEvaluator } from './utils/evaluator.js'

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
	 * Create UCAN-like capability token for protected API calls
	 * @param {Object} opts
	 * @param {string} opts.cmd - e.g. "/test-ucan"
	 * @param {Object} [opts.args={}]
	 * @returns {Promise<string>} JWT-style token (Bearer)
	 * @throws {Error} If not signed in or agentSecret not available
	 */
	async getCapabilityToken(opts = {}) {
		const { cmd, args = {} } = opts
		if (!cmd || typeof cmd !== 'string') throw new Error('cmd required')
		if (!this._agentSecret) throw new Error('Agent secret not available (sign in required)')
		const accountID = this._account?.id ?? this._account?.$jazz?.id
		if (!accountID?.startsWith('co_z')) throw new Error('Account not ready')
		const { createInvocationToken } = await import('@MaiaOS/maia-ucan')
		return createInvocationToken(this._agentSecret, accountID, { cmd, args })
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
							factory: null,
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
					const schema = headerMeta?.$factory || null
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
					}

					allCoValues.push({
						id: coId,
						type: type,
						factory: schema,
						headerMeta: headerMeta,
						keys: keysCount,
						content: specialContent || content,
						createdAt: createdAt,
					})
				} catch (error) {
					allCoValues.push({
						id: coId,
						type: 'error',
						factory: null,
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
		await MaiaOS._initializeDatabase(os, config)

		// Set schema resolver for runtime validation (engines need dataEngine for schema lookups)
		const { setFactoryResolver } = await import('@MaiaOS/validation/validation.helper')
		setFactoryResolver({ dataEngine: os.dataEngine })

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
			getSyncBaseUrl: config.getSyncBaseUrl ?? null,
		}

		// If peer is provided, use it
		if (config.peer) {
			os.dataEngine = new DataEngine(config.peer, dbOptions)
			if (typeof config.peer.resolveSystemSparkCoId === 'function') {
				await config.peer.resolveSystemSparkCoId()
			}
			await os.dataEngine.resolveSystemFactories()
			return config.peer
		}

		// If node and account are provided, create MaiaDB peer
		if (config.node && config.account) {
			const { MaiaDB } = await import('@MaiaOS/db')
			const maiaDB = new MaiaDB({ node: config.node, account: config.account }, {})
			os.dataEngine = new DataEngine(maiaDB, dbOptions)
			maiaDB.dbEngine = os.dataEngine
			await maiaDB.resolveSystemSparkCoId()
			await os.dataEngine.resolveSystemFactories()
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

		// Store engines in registry for module access
		os.moduleRegistry._dataEngine = os.dataEngine
		os.processEngine = new ProcessEngine(os.evaluator)
		os.styleEngine = new StyleEngine()
		// Clear cache on boot in development only
		if (config.isDevelopment || import.meta.env?.DEV) {
			os.styleEngine.clearCache()
		}
		os.viewEngine = new ViewEngine(os.evaluator, null, os.moduleRegistry)

		os.actorEngine = new ActorEngine(os.styleEngine, os.viewEngine, os.processEngine)

		// Pass DataEngine to engines (for internal config loading)
		os.actorEngine.dataEngine = os.dataEngine
		os.viewEngine.dataEngine = os.dataEngine
		os.viewEngine.styleEngine = os.styleEngine
		os.styleEngine.dataEngine = os.dataEngine
		os.processEngine.dataEngine = os.dataEngine
		os.processEngine.actorOps = os.actorEngine

		// Store reference to MaiaOS in actorEngine (for @db tool access)
		os.actorEngine.os = os

		// Pass ActorOps to ViewEngine (Loader wires; no circular ref)
		os.viewEngine.actorOps = os.actorEngine
	}

	/**
	 * Load modules
	 * @param {MaiaOS} os - OS instance
	 * @param {Object} config - Boot configuration
	 */
	static async _loadModules(os, config) {
		const modules = config.modules || ['db', 'core']
		await registerBuiltinModules(os.moduleRegistry, modules)
	}

	/**
	 * Create an actor
	 * @param {string} actorPath - Path to actor.maia file
	 * @param {HTMLElement} container - Container element
	 * @returns {Promise<Object>} Created actor
	 */
	async createActor(actorPath, container) {
		let actorConfig
		if (typeof actorPath === 'object' && actorPath !== null) {
			actorConfig = actorPath
		} else if (typeof actorPath === 'string') {
			if (!actorPath.startsWith('co_z')) {
				throw new Error(`[MaiaOS] createActor: actor co-id (co_z...) required, got: ${actorPath}`)
			}
			const actorCoId = actorPath
			const actorSchemaCoId = await resolve(
				this.actorEngine.dataEngine.peer,
				{ fromCoValue: actorCoId },
				{ returnType: 'coId' },
			)
			const store = await this.actorEngine.dataEngine.execute({
				op: 'read',
				factory: actorSchemaCoId,
				key: actorCoId,
			})
			actorConfig = store.value
		} else {
			throw new Error(
				`[MaiaOS] createActor expects co-id (co_z...) or config object, got: ${typeof actorPath}`,
			)
		}
		const actor = await this.runtime.createActorForView(actorConfig, container)
		return actor
	}

	/**
	 * Load a vibe by vibe CoMap co-id (runtime: co_z only).
	 * @param {string} vibeCoId - Vibe CoMap co-id (co_z...)
	 * @param {HTMLElement} container - Container element
	 * @param {string} [actorTrackingCoId] - Registers spawned actors under this co-id (defaults to vibeCoId; use same value for dashboard + session chat when they share one tree)
	 * @returns {Promise<{vibe: Object, actor: Object}>}
	 */
	async loadVibe(vibeCoId, container, actorTrackingCoId) {
		if (typeof vibeCoId !== 'string' || !vibeCoId.startsWith('co_z')) {
			throw new Error(`[MaiaOS] loadVibe requires vibe CoMap co-id (co_z...), got: ${vibeCoId}`)
		}
		const track = actorTrackingCoId ?? vibeCoId
		return await this.loadVibeFromDatabase(vibeCoId, container, track)
	}

	/**
	 * Load a vibe from database (maia.do)
	 * @param {string} vibeId - Vibe ID (co-id)
	 * @param {HTMLElement} container - Container element
	 * @param {string|null} [vibeCoIdForActors] - Vibe co-id for actor reuse / destroyActorsForVibe (co_z...)
	 * @returns {Promise<{vibe: Object, actor: Object}>} Vibe metadata and actor instance
	 */
	async loadVibeFromDatabase(vibeId, container, vibeCoIdForActors = null) {
		if (!vibeId.startsWith('co_z')) {
			throw new Error(
				`[Kernel] Vibe ID must be co-id at runtime: ${vibeId}. This should have been resolved during seeding.`,
			)
		}
		const vibeCoId = vibeId

		const vibeStore = await this.dataEngine.execute({
			op: 'read',
			factory: null,
			key: vibeCoId,
		})

		const factoryStore = await this.dataEngine.execute({
			op: 'factory',
			fromCoValue: vibeCoId,
		})
		const vibeSchemaCoId = factoryStore.value?.$id || vibeStore.value?.$factory

		if (!vibeSchemaCoId) {
			throw new Error(
				`[Kernel] Failed to extract schema co-id from vibe ${vibeCoId}. Vibe must have $factory in headerMeta.`,
			)
		}

		const store = vibeStore
		const vibe = store.value

		if (!vibe || vibe.error) {
			try {
				await this.dataEngine.execute({
					op: 'read',
					factory: null,
					key: vibeCoId,
				})
			} catch (_err) {}
			throw new Error(`Vibe not found in database: ${vibeId} (co-id: ${vibeCoId})`)
		}

		const schema = factoryStore.value
		if (schema) {
			await validateAgainstFactoryOrThrow(schema, vibe, 'vibe')
		}

		const actorCoId = vibe.actor

		if (!actorCoId) {
			throw new Error(
				`[MaiaOS] Vibe ${vibeId} (${vibeCoId}) does not have an 'actor' property. Vibe structure: ${JSON.stringify(Object.keys(vibe))}`,
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

				if (state.error || !state.factoryCoId) {
					reject(
						new Error(
							`[Kernel] Failed to extract factory co-id from actor ${actorCoId}: ${state.error || 'Factory not found'}`,
						),
					)
				} else {
					resolve(state.factoryCoId)
				}
			})
		})

		// Verify actor exists in database (using read operation with reactive store)
		const actorStore = await this.dataEngine.execute({
			op: 'read',
			factory: actorSchemaCoId,
			key: actorCoId,
		})
		const actorExists = actorStore.value
		if (!actorExists) {
			throw new Error(
				`[MaiaOS] Actor with co-id ${actorCoId} not found in database. The actor may not have been seeded correctly.`,
			)
		}

		// Destroy any existing actors for this vibe (destroy-on-switch lifecycle)
		if (vibeCoIdForActors?.startsWith('co_z')) {
			this.runtime.destroyActorsForVibe(vibeCoIdForActors)
		}

		const actorConfig = actorStore.value
		const actor = await this.runtime.createActorForView(actorConfig, container, vibeCoIdForActors)

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
			processEngine: this.processEngine,
			dataEngine: this.dataEngine,
			evaluator: this.evaluator,
			moduleRegistry: this.moduleRegistry,
		}
	}
}
