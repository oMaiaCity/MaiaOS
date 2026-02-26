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

import { waitForStoreReady } from '@MaiaOS/db'
import { containsExpressions } from '@MaiaOS/schemata/expression-resolver'
import { deriveInboxRef } from '../utils/inbox-convention.js'
import { readStore } from '../utils/store-reader.js'

// Render state machine - prevents race conditions by ensuring renders only happen when state allows
export const RENDER_STATES = {
	INITIALIZING: 'initializing', // Setting up subscriptions, loading initial data
	RENDERING: 'rendering', // Currently rendering (prevents nested renders)
	READY: 'ready', // Initial render complete, ready for updates
	UPDATING: 'updating', // Data changed, queued for rerender
}

export class ActorEngine {
	constructor(styleEngine, viewEngine, processEngine, inboxEngine = null) {
		this.styleEngine = styleEngine
		this.viewEngine = viewEngine
		this.processEngine = processEngine
		this.inboxEngine = inboxEngine
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

	/** @private */
	async _initializeActorState(actor, actorConfig) {
		if (this.processEngine && actorConfig.process && !actor.process) {
			const processStore = await readStore(this.dataEngine, actorConfig.process)
			if (!processStore) {
				throw new Error(
					`[ActorEngine] Failed to load process for actor ${actor.id}: process co-id ${actorConfig.process} returned null. ` +
						`Run with PEER_FRESH_SEED=true to re-seed configs.`,
				)
			}
			const processDef = processStore.value
			if (!processDef?.handlers) {
				throw new Error(
					`[ActorEngine] Process for actor ${actor.id} has no handlers. Process co-id: ${actorConfig.process}`,
				)
			}
			actor.process = await this.processEngine.createProcess(processDef, actor)
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
			const store = await readStore(this.dataEngine, childActorCoId)
			if (!store) {
				throw new Error(`[ActorEngine] Failed to load child actor CoValue ${childActorCoId}`)
			}
			const childActorConfig = store.value
			if (childActorConfig.$id !== childActorCoId) childActorConfig.$id = childActorCoId
			const childContainer = document.createElement('div')
			childContainer.style.display = 'contents'
			childContainer.dataset.namekey = namekey
			childContainer.dataset.childActorId = childActorCoId
			const childActor = await this.createActor(childActorConfig, childContainer, agentKey)
			childActor.namekey = namekey
			actor.children[namekey] = childActor
			return childActor
		} catch (error) {
			console.error('[ActorEngine] _createChildActorIfNeeded FAILED:', {
				namekey,
				childActorCoId,
				error: error.message,
			})
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
		// Inbox by convention: derive when missing so config always has inbox set
		let inboxRef = actorConfig.inbox ?? deriveInboxRef(actorConfig.$id || actorConfig.id)
		if (inboxRef && !inboxRef.startsWith('co_z') && this.dataEngine?.peer) {
			const resolved = await this.dataEngine.peer.resolve(inboxRef, { returnType: 'coId' })
			if (resolved && typeof resolved === 'string' && resolved.startsWith('co_z')) inboxRef = resolved
		}
		if (!inboxRef)
			throw new Error(`[ActorEngine] Actor config must have inbox (or derivable from $id): ${actorId}`)
		actorConfig.inbox = inboxRef
		if (!actorConfig.process)
			throw new Error(`[ActorEngine] Actor config must have process: ${actorId}`)
		const actor = await this.spawnActor(actorConfig)

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
		if (actor.shadowRoot) actor.shadowRoot.innerHTML = ''
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
		if (actor.process && this.processEngine) this.processEngine.destroyProcess(actor.process.id)
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
		if (!this.dataEngine) return null
		const actorId = actorConfig.$id || actorConfig.id
		if (!actorId || typeof actorId !== 'string' || !actorId.startsWith('co_z')) {
			throw new Error(`[ActorEngine] spawnActor: actorConfig.$id must be co-id, got: ${actorId}`)
		}
		if (this.actors.has(actorId)) return this.actors.get(actorId)

		let inboxRef = actorConfig.inbox ?? deriveInboxRef(actorConfig.$id || actorConfig.id)
		if (!inboxRef || !actorConfig.process) return null
		if (typeof inboxRef !== 'string') return null
		if (!inboxRef.startsWith('co_z') && this.dataEngine?.peer) {
			const resolved = await this.dataEngine.peer.resolve(inboxRef, { returnType: 'coId' })
			if (resolved && typeof resolved === 'string' && resolved.startsWith('co_z')) inboxRef = resolved
		}
		if (!inboxRef.startsWith('co_z')) return null
		const inboxCoId = inboxRef
		const processRef = actorConfig.process

		let configCoId = processRef
		if (typeof configCoId !== 'string') {
			throw new Error(`[ActorEngine] spawnActor: process must be string, got: ${typeof configCoId}`)
		}
		if (!configCoId.startsWith('co_z') && this.dataEngine?.peer) {
			const resolved = await this.dataEngine.peer.resolve(configCoId, { returnType: 'coId' })
			if (resolved && typeof resolved === 'string' && resolved.startsWith('co_z')) {
				configCoId = resolved
			}
		}
		if (!configCoId.startsWith('co_z')) {
			throw new Error(
				`[ActorEngine] spawnActor: process must be co-id (or resolve to co-id). Got: ${processRef}. Run PEER_FRESH_SEED=true to seed configs with co-ids.`,
			)
		}
		const configStore = await readStore(this.dataEngine, configCoId)
		if (!configStore) return null

		const configDef = configStore.value
		const hasProcess = processRef && configDef?.handlers
		if (!hasProcess) return null

		// Resolve interface schema (co-id ref) for validation
		let interfaceSchema = null
		const interfaceRef = actorConfig.interface
		if (interfaceRef && typeof interfaceRef === 'string' && this.dataEngine?.peer) {
			let interfaceCoId = interfaceRef
			if (!interfaceCoId.startsWith('co_z')) {
				const resolved = await this.dataEngine.peer.resolve(interfaceRef, { returnType: 'coId' })
				if (resolved && typeof resolved === 'string' && resolved.startsWith('co_z')) {
					interfaceCoId = resolved
				}
			}
			if (interfaceCoId.startsWith('co_z')) {
				const ifaceStore = await readStore(this.dataEngine, interfaceCoId)
				if (ifaceStore?.value) {
					interfaceSchema = ifaceStore.value
				}
			}
		}

		const { getActor } = await import('@MaiaOS/actors')
		const label = actorConfig['@label']
		const namespacePath = typeof label === 'string' ? label.replace(/^@/, '') : null
		const actorModule = namespacePath ? getActor(namespacePath) : null
		const executableFunction = actorModule?.function ?? null

		const minimalContext = { value: {}, subscribe: () => () => {} }
		const configUnsubscribes = []

		// Load context for headless actors (paper, todos, etc.) so execute() has notes/todos
		let contextStore = minimalContext
		let contextCoId = null
		let contextSchemaCoId = null
		const contextRef = actorConfig.context
		if (contextRef && typeof contextRef === 'string' && this.dataEngine?.peer) {
			const resolvedContextCoId = contextRef.startsWith('co_z')
				? contextRef
				: await this.dataEngine.peer.resolve(contextRef, { returnType: 'coId' })
			if (resolvedContextCoId?.startsWith?.('co_z')) {
				const store = await readStore(this.dataEngine, resolvedContextCoId)
				if (store) {
					await waitForStoreReady(store, resolvedContextCoId, 3000).catch(() => {})
					contextStore = store
					contextCoId = resolvedContextCoId
					contextSchemaCoId =
						(await this.dataEngine.peer.resolve(
							{ fromCoValue: resolvedContextCoId },
							{ returnType: 'coId' },
						)) ?? null
					if (store._unsubscribe) {
						configUnsubscribes.push(() => store._unsubscribe())
					}
				}
			}
		}

		const actor = {
			id: actorId,
			config: { ...actorConfig, $id: actorId },
			shadowRoot: null,
			context: contextStore,
			contextCoId,
			contextSchemaCoId,
			containerElement: null,
			actorOps: this, // ActorEngine implements ActorOps interface
			viewDef: null,
			agentKey: null,
			inbox: null,
			inboxCoId,
			interface: actorConfig.interface || null,
			interfaceSchema,
			executableFunction,
			_renderState: 'ready',
			children: {},
			_configUnsubscribes: configUnsubscribes,
		}

		if (hasProcess && this.processEngine) {
			actor.process = await this.processEngine.createProcess(configDef, actor)
		}
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
		if (!this.inboxEngine) {
			throw new Error('[ActorEngine] InboxEngine not set. Ensure Loader booted with InboxEngine.')
		}
		await this.inboxEngine.deliver(targetId, message)
	}

	async validateEventPayloadForSend(actorId, eventType, payload) {
		if (!this.inboxEngine) return true
		return this.inboxEngine.validatePayloadForActor(actorId, eventType, payload)
	}

	async processEvents(actorId) {
		const actor = this.actors.get(actorId)
		if (!actor || !actor.inboxCoId || !this.dataEngine || !this.inboxEngine || actor._isProcessing)
			return
		actor._isProcessing = true
		let hadUnhandledMessages = false
		try {
			const result = await this.dataEngine.execute({
				op: 'processInbox',
				actorId,
				inboxCoId: actor.inboxCoId,
			})
			const messages = result.messages || []
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
					const validated = await this.inboxEngine.validateMessage(actor, message)
					if (!validated.valid) {
						await markProcessed()
						continue
					}
					if (message.source) actor._lastEventSource = message.source
					if (actor.process && this.processEngine) {
						const payloadWithSource = {
							...validated.payloadPlain,
							...(message.source ? { source: message.source } : {}),
						}
						const handled = await this.processEngine.send(
							actor.process.id,
							message.type,
							payloadWithSource,
						)
						await markProcessed()
						if (!handled) hadUnhandledMessages = true
					} else {
						console.warn('[ActorEngine] Message skipped - no process:', {
							actorId,
							messageType: message.type,
						})
					}
				} catch (error) {
					console.error('[ActorEngine] processEvents error for message:', {
						actorId,
						type: message.type,
						error: error.message,
						stack: error.stack,
					})
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
			}
		} catch (error) {
			console.error('[ActorEngine] processEvents outer error:', { actorId, error: error.message })
		} finally {
			actor._isProcessing = false
			// Retry when: (1) unhandled messages (no transition), or (2) more messages arrived during our run.
			// processInbox reads persisted processed flag; update invalidates cache so next read sees it.
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
