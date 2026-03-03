/**
 * Runtime (browser) - Manages actor lifecycles, inbox watching, getActorConfig
 *
 * Loads ALL config from CoJSON DB dynamically (agents, dependencies, actor configs).
 * No hardcoded .maia configs — runtime reads account → spark.agents → agent deps → actor refs.
 * For each dependency: when inbox has unprocessed messages, spawns headless actor.
 */

import { deriveInboxRef } from '../utils/inbox-convention.js'

const DEBOUNCE_MS = 50

export class Runtime {
	constructor(dataEngine, actorEngine, runtimeType) {
		this.dataEngine = dataEngine
		this.actorEngine = actorEngine
		this.runtimeType = runtimeType
		this._inboxWatcherUnsubscribes = []
		this._inboxCheckers = new Map() // inboxCoId -> resolveAndSpawnIfNeeded
		this._started = false
		this._listeners = new Map() // event -> Set<callback>
	}

	_isDebug() {
		return (
			typeof window !== 'undefined' &&
			(window.location?.hostname === 'localhost' || import.meta?.env?.DEV)
		)
	}

	_log(...args) {
		if (this._isDebug()) console.log(...args)
	}

	/**
	 * Subscribe to lifecycle events. Events: actorSpawned, actorDestroyed, messageQueued.
	 * @param {string} event - Event name
	 * @param {(payload: object) => void} callback - Callback invoked with event payload
	 */
	on(event, callback) {
		if (!this._listeners.has(event)) this._listeners.set(event, new Set())
		this._listeners.get(event).add(callback)
	}

	_emit(event, payload) {
		const set = this._listeners.get(event)
		if (!set?.size) return
		for (const fn of set) {
			try {
				fn(payload)
			} catch (_e) {}
		}
	}

	/**
	 * Create actor with view attached. Delegates to actorEngine.createActor.
	 * @param {Object} config - Actor config
	 * @param {HTMLElement} container - Container element
	 * @param {string|null} agentKey - Optional agent key for tracking
	 * @returns {Promise<Object>} Created actor
	 */
	async createActorForView(config, container, agentKey = null) {
		const actor = await this.actorEngine.createActor(config, container, agentKey)
		if (actor) this._emit('actorSpawned', { actorId: actor.id, config, source: 'view' })
		return actor
	}

	/**
	 * Destroy a single actor by ID.
	 * @param {string} id - Actor ID
	 */
	destroyActor(id) {
		this.actorEngine.destroyActor(id)
		this._emit('actorDestroyed', { actorId: id, reason: 'explicit' })
	}

	/**
	 * Destroy all actors for an agent key (e.g. on agent switch).
	 * @param {string} key - Agent key
	 */
	destroyActorsForAgent(key) {
		this.actorEngine.destroyActorsForAgent(key)
		// Emit per-actor would require iterating; bulk emit for now
		this._emit('actorDestroyed', { agentKey: key, reason: 'agentSwitch' })
	}

	/**
	 * Destroy all actors for a container (e.g. on vibe unload).
	 * @param {HTMLElement} containerElement - Container element
	 */
	destroyActorsForContainer(containerElement) {
		this.actorEngine.destroyActorsForContainer(containerElement)
		this._emit('actorDestroyed', { container: containerElement, reason: 'containerUnmount' })
	}

	/**
	 * Ensure headless actor is spawned when target has config but is not running.
	 * Called from ActorEngine._pushToInbox when message is pushed to non-running target.
	 * @param {Object} targetActorConfig - Actor config from DB
	 * @param {string} inboxCoId - Resolved inbox co-id
	 */
	async ensureActorSpawned(targetActorConfig, inboxCoId) {
		const actorId = targetActorConfig.$id || targetActorConfig.id
		if (!actorId || this.actorEngine.actors.has(actorId)) return
		try {
			const spawned = await this.actorEngine.spawnActor(targetActorConfig)
			if (spawned) {
				this._emit('actorSpawned', { actorId, config: targetActorConfig, source: 'inbox' })
				await this.actorEngine.processEvents(actorId)
			}
		} catch (_e) {
			this.notifyInboxPush(inboxCoId)
		}
	}

	/**
	 * Called when a message is pushed to an inbox. Direct trigger ensures headless actors
	 * process immediately without relying on store subscription (CoStream reads may not fire).
	 */
	notifyInboxPush(inboxCoId) {
		const check = this._inboxCheckers.get(inboxCoId)
		if (check) check()
	}

	/**
	 * Collect OpenAI-format tools from actor interface schemas.
	 * Enumerates agents' dependency actors, loads each config + interface schema, maps properties to tool definitions.
	 * @returns {Promise<Array>} OpenAI tools array { type: 'function', function: { name, description, parameters } }
	 */
	async collectTools() {
		if (!this.dataEngine?.peer) return []
		const { actorRefs } = await this._getAgentsAndDependenciesFromDb()
		const tools = []
		const actorSchemaCoId = await this.dataEngine.peer.resolve('°Maia/schema/actor', {
			returnType: 'coId',
		})
		const metaSchemaCoId = await this.dataEngine.peer.resolve('°Maia/schema/meta', {
			returnType: 'coId',
		})
		if (!actorSchemaCoId || !metaSchemaCoId) return []

		for (const actorCoId of actorRefs) {
			if (typeof actorCoId !== 'string' || !actorCoId.startsWith('co_z')) continue
			const actorConfig = await this.getActorConfig(actorCoId)
			const interfaceRef = actorConfig?.interface
			if (!interfaceRef || typeof interfaceRef !== 'string') continue
			const interfaceCoId = interfaceRef.startsWith('co_z')
				? interfaceRef
				: await this.dataEngine.peer.resolve(interfaceRef, { returnType: 'coId' })
			if (!interfaceCoId?.startsWith?.('co_z')) continue
			const ifaceStore = await this.dataEngine.execute({
				op: 'read',
				schema: metaSchemaCoId,
				key: interfaceCoId,
			})
			const schema = ifaceStore?.value
			if (!schema?.properties || typeof schema.properties !== 'object') continue
			for (const [eventType, eventSchema] of Object.entries(schema.properties)) {
				if (eventType.startsWith('@') || eventType.startsWith('$')) continue
				const { properties = {}, required = [], ...rest } = eventSchema
				const parameters = {
					...rest,
					properties: {
						...properties,
						actionSummary: {
							type: 'string',
							description:
								'Brief human-readable summary of this action (1 short sentence). Generated dynamically based on what you are doing.',
						},
					},
					required: [...required, 'actionSummary'],
				}
				tools.push({
					type: 'function',
					function: {
						name: `${actorCoId}/${eventType}`,
						description: eventSchema.description ?? schema.description ?? '',
						parameters,
					},
				})
			}
		}
		return tools
	}

	/**
	 * Execute a tool call: deliver event to actor, run process, capture SUCCESS response.
	 * @param {Object} callerActor - Actor making the call (has .id, .config.inbox)
	 * @param {string} toolName - Format "actorCoId/eventType" (e.g. co_z.../CREATE_TODO)
	 * @param {Object} payload - Event payload
	 * @returns {Promise<Object>} Result from SUCCESS reply or { ok: false, error }
	 */
	async executeToolCall(callerActor, toolName, payload = {}) {
		const slash = toolName.lastIndexOf('/')
		if (slash < 0) {
			return { ok: false, error: `Invalid tool name: ${toolName}` }
		}
		const targetActorCoId = toolName.substring(0, slash)
		const eventType = toolName.substring(slash + 1)
		if (!targetActorCoId.startsWith('co_z') || !eventType) {
			return { ok: false, error: `Invalid tool name: ${toolName}` }
		}

		const { actionSummary, ...actorPayload } = payload
		// actionSummary is system-injected, stripped before delivery to actor

		const callerId = callerActor?.id || callerActor?.config?.$id
		if (!callerId || !callerId.startsWith('co_z')) {
			return { ok: false, error: 'Caller actor must have co-id' }
		}

		const targetConfig = await this.getActorConfig(targetActorCoId)
		if (!targetConfig?.inbox) {
			return { ok: false, error: `Target actor not found: ${targetActorCoId}` }
		}

		let inboxCoId = targetConfig.inbox
		if (!inboxCoId.startsWith('co_z') && this.dataEngine?.peer) {
			inboxCoId = await this.dataEngine.peer.resolve(inboxCoId, { returnType: 'coId' })
		}
		if (!inboxCoId?.startsWith?.('co_z')) {
			return { ok: false, error: 'Could not resolve target inbox' }
		}

		await this.actorEngine.deliverEvent(callerId, targetActorCoId, eventType, actorPayload || {})
		await this.ensureActorSpawned(targetConfig, inboxCoId)
		await this.actorEngine.processEvents(targetActorCoId)

		const callerInboxRef = callerActor?.config?.inbox ?? deriveInboxRef(callerId)
		let callerInboxCoId = callerInboxRef
		if (callerInboxCoId && !callerInboxCoId.startsWith('co_z') && this.dataEngine?.peer) {
			callerInboxCoId = await this.dataEngine.peer.resolve(callerInboxRef, { returnType: 'coId' })
		}
		if (!callerInboxCoId?.startsWith?.('co_z')) {
			return { ok: true, delivered: true }
		}

		const result = await this.dataEngine.execute({
			op: 'processInbox',
			actorId: callerId,
			inboxCoId: callerInboxCoId,
		})
		const messages = result?.messages ?? []
		const successMsg = messages.find((m) => m.type === 'SUCCESS' && m.source === targetActorCoId)
		if (successMsg?.payload) {
			await this.actorEngine.processEvents(callerId)
			return successMsg.payload
		}
		await this.actorEngine.processEvents(callerId)
		return { ok: true, delivered: true }
	}

	/**
	 * Load actor config from CoJSON DB by co-id.
	 * @param {string} actorCoId - Actor co-id (co_z...)
	 * @returns {Promise<Object|null>} Actor config with inbox, state, etc.
	 */
	async getActorConfig(actorCoId) {
		if (!this.dataEngine?.peer) return null
		if (typeof actorCoId !== 'string' || !actorCoId.startsWith('co_z')) {
			throw new Error(`[Runtime] getActorConfig: actorCoId must be co-id, got: ${actorCoId}`)
		}
		try {
			const schemaCoId = await this.dataEngine.peer.resolve(
				{ fromCoValue: actorCoId },
				{ returnType: 'coId' },
			)
			if (!schemaCoId) return null
			const store = await this.dataEngine.execute({
				op: 'read',
				schema: schemaCoId,
				key: actorCoId,
			})
			const config = store?.value
			if (!config || config.error) return null
			return { ...config, $id: config.$id || config.id || actorCoId }
		} catch (_e) {
			return null
		}
	}

	/**
	 * Load agents and union of their dependencies from DB (account.registries.sparks[°Maia].agents).
	 * @returns {Promise<{actorRefs: string[]}>} Deduped actor refs to watch
	 */
	async _getAgentsAndDependenciesFromDb() {
		const peer = this.dataEngine?.peer
		const account = peer?.account
		if (!account?.id) return { actorRefs: [] }
		try {
			const accountStore = await this.dataEngine.execute({
				op: 'read',
				schema: '@account',
				key: account.id,
			})
			const accountData = accountStore?.value
			const registriesId = accountData?.registries
			if (!registriesId?.startsWith?.('co_z')) return { actorRefs: [] }
			const registriesStore = await this.dataEngine.execute({
				op: 'read',
				schema: null,
				key: registriesId,
			})
			const sparksId = registriesStore?.value?.sparks
			if (!sparksId?.startsWith?.('co_z')) return { actorRefs: [] }
			const sparksStore = await this.dataEngine.execute({
				op: 'read',
				schema: sparksId,
				key: sparksId,
			})
			const sparksData = sparksStore?.value
			const sparkCoId =
				sparksData?.['°Maia'] ||
				sparksData?.Maia ||
				Object.values(sparksData || {}).find((v) => typeof v === 'string' && v.startsWith('co_z'))
			if (!sparkCoId?.startsWith?.('co_z')) return { actorRefs: [] }
			const sparkStore = await this.dataEngine.execute({
				op: 'read',
				schema: null,
				key: sparkCoId,
			})
			const agentsId = sparkStore?.value?.agents
			if (!agentsId?.startsWith?.('co_z')) return { actorRefs: [] }
			const agentsStore = await this.dataEngine.execute({
				op: 'read',
				schema: agentsId,
				key: agentsId,
			})
			const agentsData = agentsStore?.value
			if (!agentsData || agentsData.error) return { actorRefs: [] }
			const agentKeys = Object.keys(agentsData || {}).filter(
				(k) =>
					k !== 'id' &&
					k !== '$schema' &&
					k !== 'type' &&
					typeof agentsData[k] === 'string' &&
					agentsData[k].startsWith('co_'),
			)
			const actorRefs = new Set()
			for (const key of agentKeys) {
				const agentCoId = agentsData[key]
				try {
					const agentStore = await this.dataEngine.execute({
						op: 'read',
						schema: null,
						key: agentCoId,
					})
					const deps = agentStore?.value?.dependencies
					if (Array.isArray(deps)) for (const ref of deps) actorRefs.add(ref)
				} catch (_e) {}
			}
			return { actorRefs: [...actorRefs] }
		} catch (_e) {
			return { actorRefs: [] }
		}
	}

	/**
	 * Watch an inbox for lifecycle: when unprocessed messages exist, spawn headless actor.
	 * Actor watches and processes its own inbox (same as view-attached actors via _attachInboxSubscription).
	 * Used by start() and by ActorEngine.destroyActor (unmounted view actors).
	 * @param {string} inboxCoId - Resolved inbox CoStream co-id
	 * @param {string} actorId - Actor ID ($id for actors map, processEvents)
	 * @param {Object} actorConfig - Full actor config (for spawnActor)
	 */
	watchInbox(inboxCoId, actorId, actorConfig) {
		if (!this.dataEngine || !actorConfig?.inbox) return
		if (typeof actorId !== 'string' || !actorId.startsWith('co_z')) {
			throw new Error(`[Runtime] watchInbox: actorId must be co-id, got: ${actorId}`)
		}
		if (typeof inboxCoId !== 'string' || !inboxCoId.startsWith('co_z')) {
			throw new Error(`[Runtime] watchInbox: inboxCoId must be co-id, got: ${inboxCoId}`)
		}

		const resolveAndSpawnIfNeeded = async () => {
			const result = await this.dataEngine.execute({
				op: 'processInbox',
				actorId,
				inboxCoId,
			})
			const count = result?.messages?.length ?? 0

			if (this.actorEngine.actors.has(actorId)) {
				// Actor exists: process new messages (e.g. SUCCESS from AI reply)
				if (count > 0) await this.actorEngine.processEvents(actorId)
				return
			}

			if (count === 0) return

			const actor = await this.actorEngine.spawnActor(actorConfig)
			if (actor) {
				this._emit('actorSpawned', { actorId, config: actorConfig, source: 'inbox' })
				await this.actorEngine.processEvents(actorId)
			}
		}

		// Register immediately so notifyInboxPush works before resolveAndSubscribe completes
		this._inboxCheckers.set(inboxCoId, () => resolveAndSpawnIfNeeded())

		const resolveAndSubscribe = async () => {
			const schemaCoId = await this.dataEngine?.peer?.resolve?.(
				{ fromCoValue: inboxCoId },
				{ returnType: 'coId' },
			)
			const inboxStore = schemaCoId
				? await this.dataEngine
						?.execute({ op: 'read', schema: schemaCoId, key: inboxCoId })
						.catch(() => null)
				: null
			if (!inboxStore?.subscribe) {
				// Keep checker – notifyInboxPush will still work
				return
			}

			let debounceTimeout = null
			const onInboxChange = () => {
				if (debounceTimeout) clearTimeout(debounceTimeout)
				debounceTimeout = setTimeout(() => {
					debounceTimeout = null
					resolveAndSpawnIfNeeded()
				}, DEBOUNCE_MS)
			}
			const unsub = inboxStore.subscribe(onInboxChange)
			setTimeout(() => resolveAndSpawnIfNeeded(), DEBOUNCE_MS)
			this._inboxWatcherUnsubscribes.push(() => {
				if (debounceTimeout) clearTimeout(debounceTimeout)
				this._inboxCheckers.delete(inboxCoId)
				unsub?.()
			})
		}
		resolveAndSubscribe()
	}

	/**
	 * Start inbox watchers for actors in this runtime's config.
	 * Loads agents + dependencies from DB — no hardcoded config.
	 */
	async start() {
		if (!this.dataEngine || this._started) return
		this._started = true

		const { actorRefs } = await this._getAgentsAndDependenciesFromDb()
		if (!actorRefs?.length) return

		for (const actorCoId of actorRefs) {
			if (typeof actorCoId !== 'string' || !actorCoId.startsWith('co_z')) {
				this._log('[Runtime] start: skipping non-co-id actorRef', { actorCoId })
				continue
			}
			const actorConfig = await this.getActorConfig(actorCoId)
			let inboxCoId =
				actorConfig?.inbox ?? deriveInboxRef(actorConfig?.$id || actorConfig?.id || actorCoId)
			if (!inboxCoId) continue
			if (typeof inboxCoId === 'string' && !inboxCoId.startsWith('co_z') && this.dataEngine?.peer) {
				const resolved = await this.dataEngine.peer.resolve(inboxCoId, { returnType: 'coId' })
				if (resolved && typeof resolved === 'string' && resolved.startsWith('co_z'))
					inboxCoId = resolved
			}
			if (typeof inboxCoId !== 'string' || !inboxCoId.startsWith('co_z')) continue
			const actorId = actorConfig.$id || actorConfig.id || actorCoId
			if (typeof actorId !== 'string' || !actorId.startsWith('co_z')) {
				throw new Error(`[Runtime] start: actor config $id must be co-id: ${actorCoId}`)
			}
			this._log('[Runtime] start: watching inbox', { actorCoId, inboxCoId })
			this.watchInbox(inboxCoId, actorId, actorConfig)
		}
	}
}
