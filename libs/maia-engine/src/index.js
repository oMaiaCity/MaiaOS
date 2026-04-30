/**
 * @MaiaOS/engine — engines + MaiaOS boot (merged from @MaiaOS/engines + @MaiaOS/loader)
 *
 * DataEngine: maia.do({ op, schema, key, filter, ... })
 * Engines: Actor, View, Style, Process
 * ReactiveStore: use peer.createReactiveStore() or get from @MaiaOS/db
 */

import { ensureCoValueLoaded, resolve, resolveReactive } from '@MaiaOS/db'
import { validateAgainstFactoryOrThrow } from '@MaiaOS/validation/validation.helper'
import { ActorEngine } from './actor/index.js'
import { Runtime } from './browser-runtime.js'
import { DataEngine } from './data/index.js'
import { Evaluator as MaiaScriptEvaluator } from './evaluator.js'
import { Registry as ModuleRegistry, registerBuiltinModules } from './modules-registry.js'
import { ProcessEngine } from './process/index.js'
import { StyleEngine } from './style/index.js'
import { ViewEngine } from './view/index.js'

// Peer setup, sync state, backend for operations
export {
	accountHasCapabilityOnPeer,
	CAP_GRANT_TTL_SECONDS,
	ensureCoValueLoaded,
	ensureIdentity,
	ensureProfileForNewAccount,
	findFirst,
	generateRegistryName,
	getCapabilityGrantIndexColistCoId,
	getCoListId,
	getFactory,
	getFactoryIndexColistId,
	listAccountIdsFromIdentityIndex,
	loadCapabilitiesGrants,
	MaiaDB,
	ReactiveStore,
	removeGroupMember,
	resolve,
	resolveAccountCoIdsToProfiles,
	resolveGroupCoIdsToCapabilityNames,
	SYSTEM_SPARK_REGISTRY_KEY,
	setupSyncPeers,
	subscribeSyncState,
	updateSyncState,
	validateInvite,
	waitForStoreReady,
} from '@MaiaOS/db'
export {
	bootstrapGuardianSteps,
	bootstrapIdentitySteps,
	createFlowContext,
	identitySelfAvenStep,
	runSteps,
	syncServerInfraSteps,
} from '@MaiaOS/flows'
export {
	applyMaiaLoggingFromEnv,
	bootstrapNodeLogging,
	createLogger,
	createOpsLogger,
	createPerfTracer,
	debugLog,
	debugWarn,
	installDefaultTransport,
	OPS_PREFIX,
	resolveMaiaLoggingEnv,
} from '@MaiaOS/logs'
export { agentIDToDidKey, verifyInvocationToken } from '@MaiaOS/maia-ucan'
export {
	BOOTSTRAP_PHASES,
	BootstrapError,
	bootstrapAccountHandshake,
	getBootstrapPhase,
	getSyncHttpBaseUrl,
	resetBootstrapPhase,
	setBootstrapPhase,
	subscribeBootstrapPhase,
} from '@MaiaOS/peer'
export {
	ensureAccount,
	generateAgentCredentials,
	isPRFSupported,
	signIn,
} from '@MaiaOS/self'
export {
	STORAGE_INSPECTOR_DEFAULT_TABLE_PAGE,
	STORAGE_INSPECTOR_MAX_TABLE_PAGE,
} from '@MaiaOS/storage'
export { ACTOR_NANOID_TO_EXECUTABLE_KEY } from '@MaiaOS/universe'
export { maiaIdentity } from '@MaiaOS/validation/identity-from-maia-path.js'
export {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
	isPermissionError,
	isSuccessResult,
} from '@MaiaOS/validation/operation-result'
export { createWebSocketPeer } from 'cojson-transport-ws'
export { ActorEngine } from './actor/index.js'
export { Runtime } from './browser-runtime.js'
export { createCoJSONAPI } from './cojson-factory.js'
export { DataEngine } from './data/index.js'
export { Evaluator as MaiaScriptEvaluator } from './evaluator.js'
export {
	Registry as ModuleRegistry,
	registerBuiltinModules,
} from './modules-registry.js'
export { ProcessEngine } from './process/index.js'
export {
	isQueryLoadingFieldKey,
	QUERY_LOADING_SUFFIX,
	shouldShowQueryLoadingSkeleton,
} from './query-loading.js'
export { StyleEngine } from './style/index.js'
export { ViewEngine } from './view/index.js'

/**
 * MaiaOS runtime kernel — single entry for boot and engine orchestration.
 */
export class MaiaOS {
	constructor() {
		this.moduleRegistry = null
		this.evaluator = null
		this.processEngine = null
		this.styleEngine = null
		this.viewEngine = null
		this.actorEngine = null
		this.subscriptionEngine = null
		this.dataEngine = null

		this._node = null
		this._account = null

		this._syncDomain = null
	}

	get id() {
		if (!this._node || !this._account) {
			return null
		}
		return {
			maiaId: this._account,
			node: this._node,
		}
	}

	async getCapabilityToken(opts = {}) {
		const { cmd, args = {} } = opts
		if (!cmd || typeof cmd !== 'string') throw new Error('cmd required')
		if (!this._agentSecret) throw new Error('Agent secret not available (sign in required)')
		const accountID = this._account?.id ?? this._account?.$jazz?.id
		if (!accountID?.startsWith('co_z')) throw new Error('Account not ready')
		const { createInvocationToken } = await import('@MaiaOS/maia-ucan')
		return createInvocationToken(this._agentSecret, accountID, { cmd, args })
	}

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

	static async boot(config = {}) {
		const os = new MaiaOS()

		if (config.syncDomain) {
			os._syncDomain = config.syncDomain
		}

		if (config.node && config.account) {
			os._node = config.node
			os._account = config.account
		}
		if (config.agentSecret) {
			os._agentSecret = config.agentSecret
		}

		await MaiaOS._initializeDatabase(os, config)

		const { resolveFactoryDefFromPeer } = await import('@MaiaOS/db')
		const { setFactoryResolver } = await import('@MaiaOS/validation/validation.helper')
		setFactoryResolver({
			resolveFactory: (factoryKey) =>
				resolveFactoryDefFromPeer(os.dataEngine.peer, factoryKey, { returnType: 'factory' }),
		})

		MaiaOS._initializeEngines(os, config)

		await MaiaOS._loadModules(os, config)

		const runtimeType = config.runtimeType || 'browser'
		const runtime = new Runtime(os.dataEngine, os.actorEngine, runtimeType, {
			getCapabilityToken: (opts) => os.getCapabilityToken(opts),
		})
		os.actorEngine.runtime = runtime
		os.viewEngine.runtime = runtime
		os.runtime = runtime
		await runtime.start()

		return os
	}

	static async _initializeDatabase(os, config = {}) {
		const evaluator = new MaiaScriptEvaluator()
		const dbOptions = {
			evaluator,
			getSyncBaseUrl: config.getSyncBaseUrl ?? null,
		}

		if (config.peer) {
			os.dataEngine = new DataEngine(config.peer, dbOptions)
			if (typeof config.peer.resolveSystemSparkCoId === 'function') {
				await config.peer.resolveSystemSparkCoId()
			}
			await os.dataEngine.resolveSystemFactories()
			return config.peer
		}

		if (config.node && config.account) {
			const { MaiaDB } = await import('@MaiaOS/db')
			const maiaDB = new MaiaDB({ node: config.node, account: config.account }, {})
			os.dataEngine = new DataEngine(maiaDB, dbOptions)
			maiaDB.dbEngine = os.dataEngine
			await maiaDB.resolveSystemSparkCoId()
			await os.dataEngine.resolveSystemFactories()
			return maiaDB
		}

		throw new Error(
			'MaiaOS.boot() requires either a peer or node+account. ' +
				'Provide either: { peer } or { node, account }',
		)
	}

	static _initializeEngines(os, config) {
		os.moduleRegistry = new ModuleRegistry()

		os.evaluator = new MaiaScriptEvaluator(os.moduleRegistry, { dataEngine: os.dataEngine })

		os.moduleRegistry._dataEngine = os.dataEngine
		os.processEngine = new ProcessEngine(os.evaluator)
		os.styleEngine = new StyleEngine()
		if (config.isDevelopment || import.meta.env?.DEV) {
			os.styleEngine.clearCache()
		}
		os.viewEngine = new ViewEngine(os.evaluator, null, os.moduleRegistry)

		os.actorEngine = new ActorEngine(os.styleEngine, os.viewEngine, os.processEngine)

		os.actorEngine.dataEngine = os.dataEngine
		os.viewEngine.dataEngine = os.dataEngine
		os.viewEngine.styleEngine = os.styleEngine
		os.styleEngine.dataEngine = os.dataEngine
		os.processEngine.dataEngine = os.dataEngine
		os.processEngine.actorOps = os.actorEngine

		os.actorEngine.os = os

		os.viewEngine.actorOps = os.actorEngine
	}

	static async _loadModules(os, config) {
		const modules = config.modules || ['db', 'core']
		await registerBuiltinModules(os.moduleRegistry, modules)
	}

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

	async loadVibe(vibeCoId, container, actorTrackingCoId) {
		if (typeof vibeCoId !== 'string' || !vibeCoId.startsWith('co_z')) {
			throw new Error(`[MaiaOS] loadVibe requires vibe CoMap co-id (co_z...), got: ${vibeCoId}`)
		}
		const track = actorTrackingCoId ?? vibeCoId
		return await this.loadVibeFromDatabase(vibeCoId, container, track)
	}

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

		const actorSchemaStore = resolveReactive(
			this.dataEngine.peer,
			{ fromCoValue: actorCoId },
			{ returnType: 'coId' },
		)

		let unsubscribe
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
					return
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

		if (vibeCoIdForActors?.startsWith('co_z')) {
			this.runtime.destroyActorsForVibe(vibeCoIdForActors)
		}

		const actorConfig = actorStore.value
		const processCoId =
			typeof actorConfig?.process === 'string' && actorConfig.process.startsWith('co_z')
				? actorConfig.process
				: null
		if (processCoId) {
			try {
				await ensureCoValueLoaded(this.dataEngine.peer, processCoId, {
					waitForAvailable: true,
					timeoutMs: 30000,
				})
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				throw new Error(
					`[MaiaOS] Actor process CoValue did not load from sync in time (${processCoId}). ` +
						`Check network and sync. ${msg}`,
				)
			}
		}

		const actor = await this.runtime.createActorForView(actorConfig, container, vibeCoIdForActors)

		return { vibe, actor }
	}

	getActor(actorId) {
		return this.actorEngine.getActor(actorId)
	}

	deliverEvent(senderId, targetId, type, payload) {
		return this.actorEngine.deliverEvent(senderId, targetId, type, payload)
	}

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

	getSyncDomain() {
		return this._syncDomain
	}

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
