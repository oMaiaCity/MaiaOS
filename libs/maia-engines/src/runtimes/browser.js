/**
 * Runtime (browser) - Manages actor lifecycles, inbox watching, getActorConfig
 *
 * Loads ALL config from CoJSON DB dynamically (avens, dependencies, actor configs).
 * No hardcoded .maia configs — runtime reads account → spark.avens → aven deps → actor refs.
 * For each dependency: when inbox has unprocessed messages, spawns headless actor.
 */

import { collectInboxMessageCoIds, findNewSuccessFromTarget } from '@MaiaOS/db'

function deriveInboxRef(actorId) {
	if (!actorId || typeof actorId !== 'string') return null
	if (actorId.includes('/actor/') && !actorId.startsWith('°Maia/actor/')) {
		return actorId.replace('/actor/', '/inbox/')
	}
	if (actorId.includes('/')) return `${actorId}/inbox`
	return null
}

export class Runtime {
	constructor(dataEngine, actorEngine, runtimeType, opts = {}) {
		this.dataEngine = dataEngine
		this.actorEngine = actorEngine
		this.runtimeType = runtimeType
		this._getCapabilityToken = opts.getCapabilityToken ?? null
		this._processingByInbox = new Map()
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

	off(event, callback) {
		const set = this._listeners.get(event)
		if (!set) return
		set.delete(callback)
		if (set.size === 0) this._listeners.delete(event)
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
	 * @param {string|null} vibeKey - Optional vibe key for tracking
	 * @returns {Promise<Object>} Created actor
	 */
	async createActorForView(config, container, vibeKey = null) {
		const actor = await this.actorEngine.createActor(config, container, vibeKey)
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
	 * Destroy all actors for a vibe key (e.g. on vibe switch).
	 * @param {string} key - Vibe key
	 */
	destroyActorsForVibe(key) {
		this.actorEngine.destroyActorsForVibe(key)
		// Emit per-actor would require iterating; bulk emit for now
		this._emit('actorDestroyed', { vibeKey: key, reason: 'vibeSwitch' })
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
	 * Process inbox for actor: read unprocessed messages, spawn if needed, process.
	 * Sole executor path — InboxEngine delegates here; holds lock.
	 */
	async processInboxForActor(inboxCoId, actorId, actorConfig) {
		if (this._processingByInbox.get(inboxCoId)) return
		this._processingByInbox.set(inboxCoId, true)
		try {
			const { messages } = this.actorEngine
				? await this.actorEngine.getUnprocessedMessages(inboxCoId, actorId)
				: { messages: [] }
			const count = messages.length

			if (this.actorEngine?.actors?.has(actorId)) {
				if (count > 0) await this.actorEngine.processEvents(actorId, messages)
				return
			}

			if (count === 0) return

			const actor = await this.actorEngine?.spawnActor?.(actorConfig, { skipInboxSubscription: true })
			if (actor) {
				this._emit('actorSpawned', { actorId, config: actorConfig, source: 'inbox' })
				await this.actorEngine.processEvents(actorId, messages)
			}
		} finally {
			this._processingByInbox.delete(inboxCoId)
		}
	}

	/** Ensure headless actor is spawned when target has config but is not running. */
	async ensureActorSpawned(targetActorConfig, _inboxCoId) {
		const actorId = targetActorConfig.$id || targetActorConfig.id
		if (!actorId || this.actorEngine.actors.has(actorId)) return
		try {
			const spawned = await this.actorEngine.spawnActor(targetActorConfig)
			if (spawned) {
				this._emit('actorSpawned', { actorId, config: targetActorConfig, source: 'inbox' })
				await this.actorEngine.processEvents(actorId)
			}
		} catch (_e) {
			// Store subscription will trigger processing when CoStream updates
		}
	}

	/**
	 * Collect OpenAI-format tools from actor interface schemas.
	 * Enumerates avens' dependency actors, loads each config + interface schema, maps properties to tool definitions.
	 * @returns {Promise<Array>} OpenAI tools array { type: 'function', function: { name, description, parameters } }
	 */
	async collectTools() {
		if (!this.dataEngine?.peer) return []
		const { actorRefs } = await this._getVibesAndDependenciesFromDb()
		const tools = []
		const actorSchemaCoId = await this.dataEngine.peer.resolve('°Maia/factory/actor', {
			returnType: 'coId',
		})
		const metaSchemaCoId = await this.dataEngine.peer.resolve('°Maia/factory/meta', {
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
				factory: metaSchemaCoId,
				key: interfaceCoId,
			})
			const schema = ifaceStore?.value
			if (!schema?.properties || typeof schema.properties !== 'object') continue
			for (const [eventType, eventFactory] of Object.entries(schema.properties)) {
				if (eventType.startsWith('@') || eventType.startsWith('$')) continue
				const { properties = {}, required = [], ...rest } = eventFactory
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
						description: eventFactory.description ?? schema.description ?? '',
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

		const callerInboxRef = callerActor?.config?.inbox ?? deriveInboxRef(callerId)
		let callerInboxCoId = callerInboxRef
		if (callerInboxCoId && !callerInboxCoId.startsWith('co_z') && this.dataEngine?.peer) {
			callerInboxCoId = await this.dataEngine.peer.resolve(callerInboxRef, { returnType: 'coId' })
		}

		const peer = this.dataEngine?.peer
		const beforeCallerIds =
			callerInboxCoId?.startsWith('co_z') && peer
				? collectInboxMessageCoIds(peer, callerInboxCoId)
				: null

		await this.actorEngine.deliverEvent(callerId, targetActorCoId, eventType, actorPayload || {})
		await this.ensureActorSpawned(targetConfig, inboxCoId)
		await this.actorEngine.processEvents(targetActorCoId)

		if (!callerInboxCoId?.startsWith?.('co_z') || !peer || !beforeCallerIds) {
			this._emit('toolExecuted', { toolName: eventType, fullName: toolName, ok: true })
			return { ok: true, delivered: true }
		}

		const successReply = await findNewSuccessFromTarget(
			peer,
			callerInboxCoId,
			targetActorCoId,
			beforeCallerIds,
		)
		if (successReply) {
			await this.actorEngine.processEvents(callerId)
			const out = successReply.payload !== undefined ? successReply.payload : {}
			this._emit('toolExecuted', { toolName: eventType, fullName: toolName, ok: true })
			return out
		}

		const { messages } = (await this.actorEngine?.getUnprocessedMessages?.(
			callerInboxCoId,
			callerId,
		)) ?? { messages: [] }
		const successMsg = messages.find((m) => m.type === 'SUCCESS' && m.source === targetActorCoId)
		if (successMsg?.payload !== undefined) {
			await this.actorEngine.processEvents(callerId)
			this._emit('toolExecuted', { toolName: eventType, fullName: toolName, ok: true })
			return successMsg.payload
		}
		await this.actorEngine.processEvents(callerId)
		this._emit('toolExecuted', {
			toolName: eventType,
			fullName: toolName,
			ok: false,
			error: 'Target did not acknowledge (no SUCCESS)',
		})
		return { ok: false, error: 'Target did not acknowledge (no SUCCESS)' }
	}

	/**
	 * Create UCAN-like capability token for protected API calls (e.g. /llm/chat).
	 * Delegates to Loader when provided at construction.
	 * @param {Object} opts - e.g. { cmd: '/llm/chat', args: {} }
	 * @returns {Promise<string>} JWT-style Bearer token
	 */
	async getCapabilityToken(opts = {}) {
		if (typeof this._getCapabilityToken !== 'function') {
			throw new Error('getCapabilityToken not available (Loader not wired)')
		}
		return this._getCapabilityToken(opts)
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
			const factoryCoId = await this.dataEngine.peer.resolve(
				{ fromCoValue: actorCoId },
				{ returnType: 'coId' },
			)
			if (!factoryCoId) return null
			const store = await this.dataEngine.execute({
				op: 'read',
				factory: factoryCoId,
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
	 * Load vibes and union of their dependencies from DB (account.registries.sparks[°Maia].os.vibes).
	 * @returns {Promise<{actorRefs: string[]}>} Deduped actor refs to watch
	 */
	async _getVibesAndDependenciesFromDb() {
		const peer = this.dataEngine?.peer
		const account = peer?.account
		if (!account?.id) return { actorRefs: [] }
		try {
			const accountStore = await this.dataEngine.execute({
				op: 'read',
				factory: '@account',
				key: account.id,
			})
			const accountData = accountStore?.value
			const registriesId = accountData?.registries
			if (!registriesId?.startsWith?.('co_z')) return { actorRefs: [] }
			const registriesStore = await this.dataEngine.execute({
				op: 'read',
				factory: null,
				key: registriesId,
			})
			const sparksId = registriesStore?.value?.sparks
			if (!sparksId?.startsWith?.('co_z')) return { actorRefs: [] }
			const sparksStore = await this.dataEngine.execute({
				op: 'read',
				factory: sparksId,
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
				factory: null,
				key: sparkCoId,
			})
			const osId = sparkStore?.value?.os
			if (!osId?.startsWith?.('co_z')) return { actorRefs: [] }
			const osStore = await this.dataEngine.execute({
				op: 'read',
				factory: null,
				key: osId,
			})
			const vibesId = osStore?.value?.vibes
			if (!vibesId?.startsWith?.('co_z')) return { actorRefs: [] }
			const vibesStore = await this.dataEngine.execute({
				op: 'read',
				factory: vibesId,
				key: vibesId,
			})
			const vibesData = vibesStore?.value
			if (!vibesData || vibesData.error) return { actorRefs: [] }
			const vibeKeys = Object.keys(vibesData || {}).filter(
				(k) =>
					k !== 'id' &&
					k !== '$schema' &&
					k !== '$factory' &&
					k !== 'type' &&
					typeof vibesData[k] === 'string' &&
					vibesData[k].startsWith('co_'),
			)
			const actorRefs = new Set()
			for (const key of vibeKeys) {
				const vibeCoId = vibesData[key]
				try {
					const vibeStore = await this.dataEngine.execute({
						op: 'read',
						factory: null,
						key: vibeCoId,
					})
					const vibe = vibeStore?.value
					if (!vibe) continue
					if (!Array.isArray(vibe.runtime) || !vibe.runtime.includes(this.runtimeType)) continue
					const deps = vibe.dependencies
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
	 * Delegates to InboxEngine.watchInbox (unified $stores-based processing).
	 * Used by start() and by ActorEngine.destroyActor (unmounted view actors).
	 * @param {string} inboxCoId - Resolved inbox CoStream co-id
	 * @param {string} actorId - Actor ID ($id for actors map, processEvents)
	 * @param {Object} actorConfig - Full actor config (for spawnActor)
	 */
	watchInbox(inboxCoId, actorId, actorConfig) {
		const unsub = this.actorEngine?.watchInbox(inboxCoId, actorId, actorConfig)
		return unsub ?? (() => {})
	}

	/**
	 * Start inbox watchers for actors in this runtime's config.
	 * Loads agents + dependencies from DB — no hardcoded config.
	 */
	async start() {
		if (!this.dataEngine || this._started) return
		this._started = true

		const { actorRefs } = await this._getVibesAndDependenciesFromDb()
		if (!actorRefs?.length) return

		const watchedIds = []
		const verboseRuntime =
			typeof localStorage !== 'undefined' && localStorage.getItem('MAIA_DEBUG_RUNTIME') === '1'

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
			if (verboseRuntime) {
				this._log('[Runtime] start: watching inbox', { actorCoId, inboxCoId })
			}
			this.watchInbox(inboxCoId, actorId, actorConfig)
			watchedIds.push(actorCoId)
		}

		if (watchedIds.length && this._isDebug()) {
			const max = 8
			const head = watchedIds.slice(0, max).map((id) => id.slice(0, 14))
			const more = watchedIds.length > max ? ` (+${watchedIds.length - max} more)` : ''
			console.log(
				`[Runtime] start: watching ${watchedIds.length} inbox(es): ${head.join(', ')}${more}`,
			)
		}
	}
}
