/**
 * ActorEngine - Orchestrates actors, views, styles, and actions
 *
 * **Responsibilities:** Actor lifecycle (spawn, create, destroy), messaging (deliverEvent, inbox),
 * validation, rerender batching, child actors. View/DOM attach delegated to ViewEngine.
 *
 * **Actor shape:** { id, config, shadowRoot, context, viewDef, containerElement, inboxCoId,
 * machine, and children. View-attached actors have viewDef + containerElement; headless have null.
 *
 * **Lifecycle:** spawnActor (headless, inbox+state) | createActor (view-attached via container).
 * destroyActor, destroyActorsForAgent, destroyActorsForContainer for teardown.
 */

import { containsExpressions } from '@MaiaOS/schemata/expression-resolver'
import { validateAgainstSchema } from '@MaiaOS/schemata/validation.helper'

// Render state machine - prevents race conditions by ensuring renders only happen when state allows
export const RENDER_STATES = {
	INITIALIZING: 'initializing', // Setting up subscriptions, loading initial data
	RENDERING: 'rendering', // Currently rendering (prevents nested renders)
	READY: 'ready', // Initial render complete, ready for updates
	UPDATING: 'updating', // Data changed, queued for rerender
}

export class ActorEngine {
	constructor(styleEngine, viewEngine, stateEngine = null) {
		this.styleEngine = styleEngine
		this.viewEngine = viewEngine
		this.stateEngine = stateEngine
		this.actors = new Map()
		this.dataEngine = null
		this.os = null
		this._containerActors = new Map()
		this._agentActors = new Map()
		// ViewEngine/StateEngine receive ActorOps via Loader - no circular ref from here

		// Svelte-style rerender batching (microtask queue)
		this.pendingRerenders = new Set() // Track actors needing rerender
		this.batchTimer = null // Track if microtask is scheduled

		this.runtime = null
	}

	_isDebug() {
		return typeof window !== 'undefined' && (import.meta?.env?.DEV ?? false)
	}

	_log(...args) {
		if (this._isDebug()) console.log(...args)
	}

	_logError(...args) {
		if (this._isDebug()) console.error(...args)
	}

	async updateContextCoValue(actor, updates) {
		if (!actor.contextCoId || !this.dataEngine) return
		const contextSchemaCoId =
			actor.contextSchemaCoId ||
			(await this.dataEngine.peer.resolve({ fromCoValue: actor.contextCoId }, { returnType: 'coId' }))
		const sanitizedUpdates = {}
		for (const [key, value] of Object.entries(updates)) {
			sanitizedUpdates[key] = value === undefined ? null : value
		}
		const updateResult = await this.dataEngine.execute({
			op: 'update',
			schema: contextSchemaCoId,
			id: actor.contextCoId,
			data: sanitizedUpdates,
		})
		if (!updateResult.ok) {
			const msgs = updateResult.errors?.map((e) => e.message).join('; ') || 'Update failed'
			throw new Error(`[ActorEngine] Context update failed: ${msgs}`)
		}
	}

	async _readStore(coId) {
		const schemaCoId = await this.dataEngine.peer.resolve(
			{ fromCoValue: coId },
			{ returnType: 'coId' },
		)
		if (!schemaCoId) return null
		return this.dataEngine.execute({ op: 'read', schema: schemaCoId, key: coId })
	}

	/**
	 * Ensure actor exists. Single spawn path: spawnActor. Requires inbox+state (full actor config).
	 * @returns {Promise<Object>} Actor (existing or newly spawned)
	 * @throws {Error} If config lacks inbox or state
	 * @private
	 */
	async _ensureActor(actorConfig) {
		const actorId = actorConfig.$id || actorConfig.id
		if (this.actors.has(actorId)) return this.actors.get(actorId)
		if (!actorConfig.inbox || !actorConfig.state) {
			throw new Error(
				`[ActorEngine] Actor config must have inbox and state (full config required): ${actorId}`,
			)
		}
		return this.spawnActor(actorConfig)
	}

	/** @private */
	async _initializeActorState(actor, actorConfig) {
		if (this.stateEngine && actorConfig.state && !actor.machine) {
			try {
				const stateStore = await this._readStore(actorConfig.state)
				if (!stateStore) {
					throw new Error(`[ActorEngine] Failed to load state CoValue ${actorConfig.state}`)
				}
				const stateDef = stateStore.value
				const actorId = actor.id
				const stateUnsub = stateStore.subscribe(
					async (updatedStateDef) => {
						const currentActor = this.actors.get(actorId)
						if (currentActor && this.stateEngine) {
							try {
								if (currentActor.machine) this.stateEngine.destroyMachine(currentActor.machine.id)
								currentActor.machine = await this.stateEngine.createMachine(updatedStateDef, currentActor)
								if (currentActor._renderState === RENDER_STATES.READY) {
									currentActor._renderState = RENDER_STATES.UPDATING
									this._scheduleRerender(actorId)
								}
							} catch (_error) {}
						}
					},
					{ skipInitial: true },
				)
				if (actor._configUnsubscribes) actor._configUnsubscribes.push(stateUnsub)

				actor.machine = await this.stateEngine.createMachine(stateDef, actor)
			} catch (_error) {}
		}
	}

	/**
	 * Create a child actor lazily if it doesn't exist yet
	 * Only creates the child actor when it's actually needed (referenced by context.currentView)
	 * @param {Object} actor - Parent actor instance
	 * @param {string} namekey - Child actor namekey (e.g., "list", "kanban")
	 * @param {string} [agentKey] - Optional agent key for tracking child actors
	 * @returns {Promise<Object|null>} The child actor instance, or null if not found/created
	 * @private
	 */
	async _createChildActorIfNeeded(actor, namekey, agentKey = null) {
		if (actor.children?.[namekey]) return actor.children[namekey]
		if (!actor.children) actor.children = {}

		// $stores Architecture: actor.context IS ReactiveStore with merged query results from backend
		const contextValue = actor.context.value

		if (!contextValue['@actors']?.[namekey]) return null
		const childActorCoId = contextValue['@actors'][namekey]
		if (!childActorCoId.startsWith('co_z')) {
			throw new Error(`[ActorEngine] Child actor ID must be co-id: ${childActorCoId}`)
		}
		try {
			const store = await this._readStore(childActorCoId)
			if (!store) {
				throw new Error(`[ActorEngine] Failed to load child actor CoValue ${childActorCoId}`)
			}
			const childActorConfig = store.value
			if (childActorConfig.$id !== childActorCoId) childActorConfig.$id = childActorCoId
			const childContainer = document.createElement('div')
			childContainer.dataset.namekey = namekey
			childContainer.dataset.childActorId = childActorCoId
			const childActor = await this.createActor(childActorConfig, childContainer, agentKey)
			childActor.namekey = namekey
			actor.children[namekey] = childActor
			return childActor
		} catch (_error) {
			return null
		}
	}

	async createActor(actorConfig, containerElement, agentKey = null) {
		const actorId = actorConfig.$id || actorConfig.id
		if (this.actors.has(actorId)) {
			return agentKey
				? await this.reuseActor(actorId, containerElement, agentKey)
				: this.actors.get(actorId)
		}

		// Single spawn path: spawnActor (requires full config: inbox+state)
		const actor = await this._ensureActor(actorConfig)

		// Container/agent registration (ActorEngine)
		if (containerElement) {
			if (!this._containerActors.has(containerElement))
				this._containerActors.set(containerElement, new Set())
			this._containerActors.get(containerElement).add(actorId)
		}
		if (agentKey) this.registerActorForAgent(actorId, agentKey)

		// View/DOM: delegate to ViewEngine
		const onBeforeRender = () => this._initializeActorState(actor, actorConfig)
		await this.viewEngine.attachViewToActor(
			actor,
			containerElement,
			actorConfig,
			agentKey,
			onBeforeRender,
		)
		return actor
	}

	/**
	 * Schedule a rerender for an actor (batched via microtask queue)
	 * Following Svelte's batching pattern: multiple updates in same tick = one rerender
	 * CRITICAL: Set-based deduplication ensures each actor only rerenders once per batch
	 * This prevents doubled rendering when multiple subscriptions fire simultaneously
	 * @param {string} actorId - The actor ID to rerender
	 */
	_scheduleRerender(actorId) {
		// Guard: Don't queue rerenders for destroyed actors (prevents race when subscriptions fire after destroy)
		if (!this.actors.has(actorId)) return
		// CRITICAL: Set.add() automatically deduplicates - if actorId already in Set, it's ignored
		this.pendingRerenders.add(actorId)

		// CRITICAL: Only schedule one microtask per event loop tick
		// Multiple _scheduleRerender() calls in same tick will all be batched together
		if (!this.batchTimer) {
			this.batchTimer = queueMicrotask(async () => {
				// Clear timer BEFORE flushing to allow new batches to be scheduled
				this.batchTimer = null
				await this._flushRerenders()
			})
		}
	}

	/**
	 * Flush all pending rerenders in batch
	 * Processes all actors that need rerendering in one microtask
	 * CRITICAL: Set-based deduplication ensures each actor only rerenders once
	 * This prevents doubled rendering when multiple subscriptions fire simultaneously
	 */
	async _flushRerenders() {
		// CRITICAL: Extract actor IDs BEFORE clearing Set
		const actorIds = Array.from(this.pendingRerenders)
		this.pendingRerenders.clear()
		// Filter out destroyed actors (may have been scheduled before destroy)
		const validIds = actorIds.filter((id) => this.actors.has(id))

		await Promise.all(validIds.map((actorId) => this.rerender(actorId)))
	}

	/**
	 * Rerender an actor (private implementation - only called by _flushRerenders)
	 * @param {string} actorId - The actor ID to rerender
	 * @private
	 */
	async rerender(actorId) {
		const actor = this.actors.get(actorId)
		if (
			!actor ||
			(actor._renderState !== RENDER_STATES.UPDATING && actor._renderState !== RENDER_STATES.READY)
		)
			return
		// Headless actors (no view) have nothing to render - skip style/view
		if (!actor.viewDef) {
			actor._renderState = RENDER_STATES.READY
			return
		}
		actor._renderState = RENDER_STATES.RENDERING
		const styleSheets = await this.styleEngine.getStyleSheets(actor.config, actorId)
		await this.viewEngine.render(actor.viewDef, actor.context, actor.shadowRoot, styleSheets, actorId)
		actor._renderState = RENDER_STATES.READY
	}

	/**
	 * Get actor by ID
	 * @param {string} actorId - The actor ID
	 * @returns {Object|undefined} The actor instance
	 */
	getActor(actorId) {
		return this.actors.get(actorId)
	}

	/**
	 * Register an actor with an agent key for reuse tracking
	 * @param {string} actorId - The actor ID
	 * @param {string} agentKey - The agent key (e.g., 'todos')
	 */
	registerActorForAgent(actorId, agentKey) {
		if (!agentKey) return

		if (!this._agentActors.has(agentKey)) {
			this._agentActors.set(agentKey, new Set())
		}
		this._agentActors.get(agentKey).add(actorId)
	}

	/**
	 * Get all actors for an agent
	 * @param {string} agentKey - The agent key (e.g., 'todos')
	 * @returns {Set<string>|undefined} Set of actor IDs for the agent
	 */
	getActorsForAgent(agentKey) {
		return this._agentActors.get(agentKey)
	}

	/**
	 * Reuse an existing actor by reattaching it to a new container
	 * @param {string} actorId - The actor ID
	 * @param {HTMLElement} containerElement - The new container to attach to
	 * @param {string} agentKey - The agent key (e.g., 'todos')
	 * @returns {Promise<Object>} The reused actor instance
	 */
	async reuseActor(actorId, containerElement, agentKey) {
		const actor = this.actors.get(actorId)
		if (!actor) throw new Error(`[ActorEngine] Cannot reuse actor ${actorId}`)
		const oldContainer = actor.containerElement
		actor.containerElement = containerElement
		if (oldContainer && this._containerActors.has(oldContainer)) {
			const oldContainerActors = this._containerActors.get(oldContainer)
			oldContainerActors.delete(actorId)
			if (oldContainerActors.size === 0) this._containerActors.delete(oldContainer)
		}
		if (containerElement) {
			if (!this._containerActors.has(containerElement))
				this._containerActors.set(containerElement, new Set())
			this._containerActors.get(containerElement).add(actorId)
		}
		this.registerActorForAgent(actorId, agentKey)
		if (actor.shadowRoot) {
			const oldHost = actor.shadowRoot.host
			if (oldHost && oldHost !== containerElement) {
				if (oldHost.parentNode) oldHost.parentNode.removeChild(oldHost)
				containerElement.appendChild(oldHost)
			}
		} else {
			actor.shadowRoot = containerElement.attachShadow({ mode: 'open' })
		}
		if (actor._initialRenderComplete) this._scheduleRerender(actorId)
		return actor
	}

	/**
	 * Destroy an actor
	 * @param {string} actorId - The actor ID
	 */
	destroyActor(actorId) {
		const actor = this.actors.get(actorId)
		if (!actor) return
		actor.shadowRoot.innerHTML = ''
		if (this.viewEngine) this.viewEngine.cleanupActor(actorId)

		// Clean up context subscription if it exists
		if (actor._contextUnsubscribe && typeof actor._contextUnsubscribe === 'function') {
			actor._contextUnsubscribe()
			delete actor._contextUnsubscribe
		}

		// Clean up view/style/brand/state/inbox config subscriptions (prevents rerender for destroyed actor)
		for (const unsub of actor._configUnsubscribes || []) {
			try {
				if (typeof unsub === 'function') unsub()
			} catch (_e) {
				/* ignore */
			}
		}
		delete actor._configUnsubscribes

		// CRITICAL: Call context store's _unsubscribe to release query stores, readCollection subscriptions, etc.
		// Without this, colist + per-item subscriptions leak when switching agents (detach keeps actors, but destroy must clean)
		if (actor.context?._unsubscribe && typeof actor.context._unsubscribe === 'function') {
			try {
				actor.context._unsubscribe()
			} catch (_e) {}
		}

		// $stores Architecture: Backend handles subscription cleanup automatically via subscriptionCache
		// But we also explicitly unsubscribe to ensure immediate cleanup
		if (actor.machine && this.stateEngine) this.stateEngine.destroyMachine(actor.machine.id)
		if (actor._processedMessageKeys) {
			actor._processedMessageKeys.clear()
			delete actor._processedMessageKeys
		}
		if (actor.containerElement && this._containerActors.has(actor.containerElement)) {
			const containerActors = this._containerActors.get(actor.containerElement)
			containerActors.delete(actorId)
			if (containerActors.size === 0) this._containerActors.delete(actor.containerElement)
		}
		for (const [agentKey, agentActorIds] of this._agentActors.entries()) {
			if (agentActorIds.has(actorId)) {
				agentActorIds.delete(actorId)
				if (agentActorIds.size === 0) this._agentActors.delete(agentKey)
				break
			}
		}
		// View actors: ensure watcher processes messages that arrive after unmount
		if (actor.inboxCoId && actor.containerElement && this.runtime) {
			this.runtime.watchInbox(actor.inboxCoId, actorId, actor.config)
		}
		this.actors.delete(actorId)
	}

	/**
	 * Attach inbox subscription for debounced processEvents. Shared by spawnActor and view actors.
	 * @param {string} actorId - Actor ID
	 * @param {string} inboxCoId - Inbox CoStream co-id
	 * @param {Array} configUnsubscribes - Array to push unsubscribe function to
	 * @returns {Promise<Object|null>} Inbox store or null
	 * @private
	 */
	async _attachInboxSubscription(actorId, inboxCoId, configUnsubscribes) {
		const schemaCoId = await this.dataEngine?.peer?.resolve?.(
			{ fromCoValue: inboxCoId },
			{ returnType: 'coId' },
		)
		const inboxStore = schemaCoId
			? await this.dataEngine
					?.execute({ op: 'read', schema: schemaCoId, key: inboxCoId })
					.catch(() => null)
			: null
		if (!inboxStore?.subscribe || !configUnsubscribes) return inboxStore
		let debounceTimeout = null
		const inboxUnsub = inboxStore.subscribe(() => {
			if (!this.actors.has(actorId)) return
			if (debounceTimeout) clearTimeout(debounceTimeout)
			debounceTimeout = setTimeout(() => {
				debounceTimeout = null
				this.processEvents(actorId)
			}, 50)
		})
		configUnsubscribes.push(() => {
			if (debounceTimeout) {
				clearTimeout(debounceTimeout)
				debounceTimeout = null
			}
			inboxUnsub?.()
		})
		return inboxStore
	}

	/**
	 * Spawn an actor (state + inbox + executableFunction). View may be attached later via _attachViewToActor.
	 * Used by inbox watcher when unprocessed messages exist.
	 * @param {Object} actorConfig - Actor config from DB (must have inbox, state, role)
	 * @param {Object} [options] - Options
	 * @param {boolean} [options.skipInboxSubscription] - When true, do not attach inbox subscription (watcher handles it)
	 * @returns {Promise<Object|null>} Created actor or null
	 */
	async spawnActor(actorConfig, options = {}) {
		if (!this.dataEngine || !this.stateEngine) return null
		const actorId = actorConfig.$id || actorConfig.id
		if (!actorId || typeof actorId !== 'string' || !actorId.startsWith('co_z')) {
			throw new Error(`[ActorEngine] spawnActor: actorConfig.$id must be co-id, got: ${actorId}`)
		}
		if (this.actors.has(actorId)) return this.actors.get(actorId)

		const inboxRef = actorConfig.inbox
		const stateRef = actorConfig.state
		if (!inboxRef || !stateRef) return null
		if (typeof inboxRef !== 'string' || !inboxRef.startsWith('co_z')) {
			throw new Error(`[ActorEngine] spawnActor: inbox must be co-id, got: ${inboxRef}`)
		}
		if (typeof stateRef !== 'string' || !stateRef.startsWith('co_z')) {
			throw new Error(`[ActorEngine] spawnActor: state must be co-id, got: ${stateRef}`)
		}
		const inboxCoId = inboxRef
		const stateCoId = stateRef

		const stateStore = await this._readStore(stateCoId)
		if (!stateStore) return null

		const stateDef = stateStore.value
		if (!stateDef?.states) return null

		const { getActor } = await import('@MaiaOS/actors')
		const role = actorConfig.role
		const namespacePath = typeof role === 'string' ? role.replace(/^@/, '') : null
		const actorModule = namespacePath ? getActor(namespacePath) : null
		const executableFunction = actorModule?.function ?? null

		const minimalContext = { value: {}, subscribe: () => () => {} }
		const configUnsubscribes = []

		const actor = {
			id: actorId,
			config: { ...actorConfig, $id: actorId },
			shadowRoot: null,
			context: minimalContext,
			contextCoId: null,
			contextSchemaCoId: null,
			containerElement: null,
			actorOps: this, // ActorEngine implements ActorOps interface
			viewDef: null,
			agentKey: null,
			inbox: null,
			inboxCoId,
			interface: actorConfig.interface || null,
			executableFunction,
			_renderState: 'ready',
			children: {},
			_configUnsubscribes: configUnsubscribes,
		}

		actor.machine = await this.stateEngine.createMachine(stateDef, actor)
		if (!options.skipInboxSubscription) {
			await this._attachInboxSubscription(actorId, inboxCoId, configUnsubscribes)
		}
		this.actors.set(actorId, actor)
		return actor
	}

	/**
	 * Destroy all actors for a given container
	 * Used when unloading an agent to clean up all actors associated with that container
	 * @param {HTMLElement} containerElement - The container element
	 */
	destroyActorsForContainer(containerElement) {
		const actorIds = this._containerActors.get(containerElement)
		if (!actorIds?.size) return
		for (const actorId of Array.from(actorIds)) {
			this.destroyActor(actorId)
		}
		this._containerActors.delete(containerElement)
	}

	/**
	 * Destroy all actors for an agent (complete cleanup)
	 * Used for explicit cleanup when needed (e.g., app shutdown)
	 * @param {string} agentKey - The agent key (e.g., 'todos')
	 */
	destroyActorsForAgent(agentKey) {
		const actorIds = this._agentActors.get(agentKey)
		if (!agentKey || !actorIds?.size) return
		for (const actorId of Array.from(actorIds)) {
			this.destroyActor(actorId)
		}
		this._agentActors.delete(agentKey)
	}

	/**
	 * Deliver event to target actor. Inbox-only: pushes to CoStream; inbox watcher handles spawn and process.
	 * Pure inbox-driven: no spawn, no processEvents here.
	 * @param {string} senderId - Sender actor co-id
	 * @param {string} targetId - Target actor co-id (or human-readable; resolved via CoJSON)
	 * @param {string} type - Message type
	 * @param {Object} payload - Resolved payload (no expressions)
	 */
	async deliverEvent(senderId, targetId, type, payload = {}) {
		this._log('[sendToActor] 2.deliverEvent:', { type, senderId, targetId })
		if (containsExpressions(payload)) {
			throw new Error(
				`[ActorEngine] Payload contains unresolved expressions. Payload: ${JSON.stringify(payload).substring(0, 200)}`,
			)
		}
		const payloadPlain =
			payload && typeof payload === 'object' ? JSON.parse(JSON.stringify(payload)) : payload || {}
		const message = {
			type,
			payload: payloadPlain,
			source: senderId,
			target: targetId,
			processed: false,
		}
		await this._pushToInbox(targetId, message)
	}

	/**
	 * Resolve target to inbox co-id. Returns inboxCoId and targetActorConfig (when target not running).
	 * @param {string} targetId - Actor co-id or human-readable ref
	 * @returns {Promise<{inboxCoId: string, targetActorConfig: Object|null, resolvedTargetId: string}>}
	 */
	async _resolveInboxForTarget(targetId) {
		if (typeof targetId !== 'string' || !targetId.startsWith('co_z')) {
			throw new Error(`[ActorEngine] _resolveInboxForTarget: targetId must be co-id, got: ${targetId}`)
		}
		const actor = this.actors.get(targetId)
		if (actor?.inboxCoId) {
			return { inboxCoId: actor.inboxCoId, targetActorConfig: null, resolvedTargetId: targetId }
		}
		const actorStore = await this._readStore(targetId)
		if (!actorStore) throw new Error(`[ActorEngine] Failed to read actor config: ${targetId}`)
		const targetActorConfig = actorStore?.value
		const inboxCoId = targetActorConfig?.inbox
		if (!inboxCoId || typeof inboxCoId !== 'string' || !inboxCoId.startsWith('co_z')) {
			throw new Error(`[ActorEngine] Actor config inbox must be co-id: ${targetId}`)
		}
		return { inboxCoId, targetActorConfig, resolvedTargetId: targetId }
	}

	/**
	 * Push message to inbox. Resolves source/target to co-ids for schema.
	 * @param {string} inboxCoId - Resolved inbox co-id
	 * @param {Object} message - { type, payload, source, target }
	 */
	async _pushMessage(inboxCoId, message) {
		const sourceCoId = message.source
		const targetCoId = message.target
		if (sourceCoId && (typeof sourceCoId !== 'string' || !sourceCoId.startsWith('co_z'))) {
			throw new Error(`[ActorEngine] _pushMessage: source must be co-id, got: ${sourceCoId}`)
		}
		if (targetCoId && (typeof targetCoId !== 'string' || !targetCoId.startsWith('co_z'))) {
			throw new Error(`[ActorEngine] _pushMessage: target must be co-id, got: ${targetCoId}`)
		}
		const messageData = {
			type: message.type,
			payload: message.payload || {},
			source: sourceCoId,
			target: targetCoId,
			processed: false,
		}
		this._log('[sendToActor] 3._pushToInbox: pushing to inbox', {
			type: message.type,
			inboxCoId,
			targetCoId,
			sourceCoId,
		})
		await this.dataEngine.peer.createAndPushMessage(inboxCoId, messageData)
		this._log('[sendToActor] 4._pushToInbox: createAndPushMessage done')
	}

	/**
	 * Push message to target's inbox. Resolves target, pushes message, spawns headless if needed.
	 * @param {string} targetId - Actor co-id (or human-readable ref)
	 * @param {Object} message - { type, payload, source, target, processed }
	 */
	async _pushToInbox(targetId, message) {
		if (!this.dataEngine?.peer) {
			throw new Error(
				'[ActorEngine] Cannot push to inbox: dataEngine or peer not set. Ensure MaiaOS is booted before deliverEvent.',
			)
		}
		let resolved
		try {
			resolved = await this._resolveInboxForTarget(targetId)
		} catch (err) {
			this._logError('[sendToActor] 3._pushToInbox: resolve failed', {
				targetId,
				messageType: message?.type,
				error: err?.message,
			})
			throw new Error(
				`[ActorEngine] _pushToInbox: cannot resolve target to inbox. ${err?.message || err}`,
			)
		}
		const { inboxCoId, targetActorConfig } = resolved
		const messageWithTarget = { ...message, target: resolved.resolvedTargetId }
		await this._pushMessage(inboxCoId, messageWithTarget)
		// Headless spawn: delegate to Runtime when available; else inline spawn; else notify inbox watcher
		if (targetActorConfig) {
			if (this.runtime) {
				await this.runtime.ensureActorSpawned(targetActorConfig, inboxCoId)
			} else {
				const actorId = targetActorConfig.$id || targetActorConfig.id
				if (actorId && !this.actors.has(actorId)) {
					try {
						const spawned = await this.spawnActor(targetActorConfig)
						if (spawned) await this.processEvents(actorId)
					} catch (_e) {}
				}
			}
		} else {
			// Actor exists: process immediately so messages show without waiting for inbox subscription
			const actorId = resolved.resolvedTargetId
			if (actorId && this.actors.has(actorId)) {
				await this.processEvents(actorId)
			} else {
				this.runtime?.notifyInboxPush?.(inboxCoId)
			}
		}
	}

	/**
	 * Validate message type against actor's message contract
	 * @param {Object} actor - Actor instance
	 * @param {string} messageType - Message type to validate
	 * @returns {boolean} True if message type is accepted, false otherwise
	 */
	_validateEventType(actor, messageType) {
		// REQUIRED: All actors must declare interface (exhaustive list - like sealed protocol)
		const iface = actor.interface || actor.messageTypes
		if (!iface || !Array.isArray(iface)) {
			return false
		}

		// Check if message type is in contract
		if (!iface.includes(messageType)) {
			return false
		}

		return true
	}

	/**
	 * Load message type schema from registry
	 * @param {string} messageType - Message type name (e.g., 'CREATE_BUTTON')
	 * @returns {Promise<Object|null>} Message type schema or null if not found
	 */
	async _loadEventTypeSchema(messageType) {
		if (this.dataEngine?.peer) {
			try {
				const schemaKey = `${this.dataEngine.peer.systemSpark}/schema/event/${messageType}`
				const schema = await this.dataEngine.peer.resolve(schemaKey, { returnType: 'schema' })
				if (schema) return schema
			} catch (_error) {}
		}
		return null
	}

	/**
	 * Validate message payload against message type schema
	 * Message type schema IS the payload schema (merged concept)
	 * @param {Object} messageTypeSchema - Message type schema definition (this IS the payload schema)
	 * @param {Object} payload - Message payload to validate
	 * @param {string} messageType - Message type name (for error messages)
	 * @returns {Promise<{valid: boolean, errors: Array|null}>} Validation result
	 */
	async _validateEventPayload(messageTypeSchema, payload, messageType) {
		if (!messageTypeSchema) {
			// Schema is required - this should never happen if _loadEventTypeSchema is called first
			return { valid: false, errors: [`Message type schema is required for ${messageType}`] }
		}

		try {
			// Filter out CoJSON/schema metadata that describes the message envelope, not the payload structure
			// cotype, indexing, groupInfo apply to the message CoMap itself, not the payload
			const { groupInfo, cotype, indexing, ...schemaForValidation } = messageTypeSchema

			// Message type schema IS the payload schema - validate directly
			const result = await validateAgainstSchema(
				schemaForValidation,
				payload || {},
				`message payload for ${messageType}`,
			)
			return result
		} catch (error) {
			return { valid: false, errors: [error.message] }
		}
	}

	/**
	 * Validate message payload before send (runtime schema only, from backend registry).
	 * Used by ViewEngine to skip sending invalid payloads.
	 * @param {string} eventType - Message type (e.g. 'CREATE_BUTTON', 'SEND_MESSAGE')
	 * @param {Object} payload - Resolved payload to validate
	 * @returns {Promise<boolean>} True if valid or no schema found, false otherwise
	 */
	async validateEventPayloadForSend(eventType, payload) {
		const schema = await this._loadEventTypeSchema(eventType)
		if (!schema) return true
		const result = await this._validateEventPayload(schema, payload || {}, eventType)
		return result.valid
	}

	/**
	 * Validate message: contract, schema, payload, DB_OP shape.
	 * @param {Object} actor - Actor instance
	 * @param {Object} message - Inbox message { type, payload, source, _coId }
	 * @returns {Promise<{valid: true, payloadPlain: Object}|{valid: false}>}
	 */
	async _validateMessage(actor, message) {
		// Step 1: Contract check
		if (!this._validateEventType(actor, message.type)) {
			this._log('[ActorEngine] _validateMessage: message type not in contract', {
				actorId: actor.id,
				messageType: message.type,
				interface: actor.interface || actor.messageTypes,
			})
			return { valid: false }
		}
		// Step 2: Load schema (required)
		const messageTypeSchema = await this._loadEventTypeSchema(message.type)
		if (!messageTypeSchema) {
			this._log('[ActorEngine] _validateMessage: schema not found', {
				actorId: actor.id,
				messageType: message.type,
			})
			return { valid: false }
		}
		// Step 3: Payload shape
		const payload = message.payload || {}
		if (
			message.type === 'DB_OP' &&
			(Array.isArray(payload) || !payload || typeof payload !== 'object' || !('op' in payload))
		) {
			this._log('[ActorEngine] _validateMessage: DB_OP payload invalid', {
				actorId: actor.id,
				payloadType: Array.isArray(payload) ? 'array' : typeof payload,
			})
			return { valid: false }
		}
		// Step 4: Schema validation
		const validation = await this._validateEventPayload(messageTypeSchema, payload, message.type)
		if (!validation.valid) {
			this._log('[ActorEngine] _validateMessage: payload validation failed', {
				actorId: actor.id,
				messageType: message.type,
				errors: validation.errors,
			})
			return { valid: false }
		}
		const payloadPlain = {
			...(payload && typeof payload === 'object'
				? JSON.parse(JSON.stringify(payload))
				: payload || {}),
			...(message._coId ? { idempotencyKey: message._coId } : {}),
		}
		return { valid: true, payloadPlain }
	}

	async processEvents(actorId) {
		const actor = this.actors.get(actorId)
		if (!actor || !actor.inboxCoId || !this.dataEngine || actor._isProcessing) return
		this._log('[sendToActor] 6.processEvents: starting', { actorId, inboxCoId: actor.inboxCoId })
		actor._isProcessing = true
		let hadUnhandledMessages = false
		try {
			const result = await this.dataEngine.execute({
				op: 'processInbox',
				actorId,
				inboxCoId: actor.inboxCoId,
			})
			const messages = result.messages || []
			if (messages.length > 0) {
				this._log('[sendToActor] 6.processEvents: processing', {
					actorId,
					count: messages.length,
					types: messages.map((m) => m.type),
				})
			}
			for (const message of messages) {
				if (message.type === 'INIT' || message.from === 'system') continue
				try {
					const markProcessed = async () => {
						if (message._coId) {
							try {
								await this.dataEngine.execute({
									op: 'update',
									id: message._coId,
									data: { processed: true },
								})
							} catch (_e) {}
						}
					}
					const validated = await this._validateMessage(actor, message)
					if (!validated.valid) {
						await markProcessed()
						continue
					}
					if (message.source) actor._lastEventSource = message.source
					if (!actor.machine || !this.stateEngine) return
					const handled = await this.stateEngine.send(
						actor.machine.id,
						message.type,
						validated.payloadPlain,
					)
					await markProcessed()
					if (!handled) hadUnhandledMessages = true
				} catch (error) {
					this._logError('[ActorEngine] processEvents: message handling failed', {
						actorId,
						messageType: message.type,
						error,
					})
				}
			}
		} catch (error) {
			this._logError('[ActorEngine] processEvents: inbox processing failed', { actorId, error })
		} finally {
			actor._isProcessing = false
			// Retry when: (1) unhandled messages (no transition), or (2) more messages arrived during our run
			// Root cause: second SEND_MESSAGE can arrive while we're awaiting LLM; subscription fires but guard blocks.
			// Drain inbox so messages that arrived during processing get handled.
			const shouldRetry =
				hadUnhandledMessages ||
				(await this.dataEngine
					.execute({ op: 'processInbox', actorId, inboxCoId: actor.inboxCoId })
					.then((r) => (r.messages?.length ?? 0) > 0)
					.catch(() => false))
			if (shouldRetry) {
				setTimeout(() => this.processEvents(actorId), 0)
			}
		}
	}
}
