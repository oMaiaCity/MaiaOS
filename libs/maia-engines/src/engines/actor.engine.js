/**
 * ActorEngine - Orchestrates actors, views, styles, and actions
 * Handles: Actor lifecycle, action registry, context updates, message passing, reactive data
 * Generic and universal - no domain-specific logic
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
	constructor(styleEngine, viewEngine, moduleRegistry, toolEngine, stateEngine = null) {
		this.styleEngine = styleEngine
		this.viewEngine = viewEngine
		this.registry = moduleRegistry
		this.toolEngine = toolEngine
		this.stateEngine = stateEngine
		this.actors = new Map()
		this.dataEngine = null
		this.os = null
		this._containerActors = new Map()
		this._vibeActors = new Map()
		this.viewEngine.setActorEngine(this)

		// Svelte-style rerender batching (microtask queue)
		this.pendingRerenders = new Set() // Track actors needing rerender
		this.batchTimer = null // Track if microtask is scheduled
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

	_makeStyleRerenderSubscribe(actorId) {
		return async () => {
			const actor = this.actors.get(actorId)
			if (actor && this.styleEngine) {
				try {
					actor.shadowRoot.adoptedStyleSheets = await this.styleEngine.getStyleSheets(
						actor.config,
						actor.id,
					)
					if (actor._renderState === RENDER_STATES.READY) {
						actor._renderState = RENDER_STATES.UPDATING
						this._scheduleRerender(actorId)
					}
				} catch {}
			}
		}
	}

	async _loadActorConfigs(actorConfig) {
		if (!actorConfig.view) throw new Error(`[ActorEngine] Actor config must have 'view' property`)

		const actorId = actorConfig.id || 'temp'
		const configUnsubscribes = []

		const viewStore2 = await this._readStore(actorConfig.view)
		if (!viewStore2) {
			throw new Error(`[ActorEngine] Failed to load view CoValue ${actorConfig.view}`)
		}
		const viewDef = viewStore2.value

		// Subscribe for reactivity (rerender on view changes) - must unsubscribe on destroy
		const viewUnsub = viewStore2.subscribe(
			(updatedView) => {
				const actor = this.actors.get(actorId)
				if (actor) {
					actor.viewDef = updatedView
					if (actor._renderState === RENDER_STATES.READY) {
						actor._renderState = RENDER_STATES.UPDATING
						this._scheduleRerender(actor.id)
					}
				}
			},
			{ skipInitial: true },
		)
		configUnsubscribes.push(viewUnsub)

		// Parallelize loading of context, style, brand, and inbox configs
		const loadPromises = []

		// Context loading - use universal API directly
		let contextPromise = null
		if (actorConfig.context) {
			contextPromise = (async () => {
				let actualContextCoId = actorConfig.context
				if (typeof actualContextCoId === 'string' && !actualContextCoId.startsWith('co_z')) {
					const resolved = await this.dataEngine.execute({
						op: 'resolve',
						humanReadableKey: actualContextCoId,
					})
					if (resolved?.startsWith('co_z')) actualContextCoId = resolved
					else
						throw new Error(`[ActorEngine] Failed to resolve context reference "${actualContextCoId}"`)
				}
				const contextStore = await this._readStore(actualContextCoId)
				if (!contextStore) throw new Error(`[ActorEngine] Failed to load context ${actualContextCoId}`)
				const contextSchemaCoId = await this.dataEngine.peer.resolve(
					{ fromCoValue: actualContextCoId },
					{ returnType: 'coId' },
				)
				return {
					context: contextStore,
					contextCoId: actualContextCoId,
					contextSchemaCoId,
					store: contextStore,
				}
			})()
			loadPromises.push(contextPromise)
		}

		// Style and brand schema resolution + loading (can be parallelized)
		let stylePromise = null
		let brandPromise = null
		if (actorConfig.style) {
			stylePromise = (async () => {
				try {
					const styleStore = await this._readStore(actorConfig.style)
					if (!styleStore) return null
					configUnsubscribes.push(
						styleStore.subscribe(this._makeStyleRerenderSubscribe(actorId), { skipInitial: true }),
					)
					return styleStore
				} catch {
					return null
				}
			})()
			loadPromises.push(stylePromise)
		}

		if (actorConfig.brand) {
			brandPromise = (async () => {
				try {
					const brandStore = await this._readStore(actorConfig.brand)
					if (!brandStore) return null
					configUnsubscribes.push(
						brandStore.subscribe(this._makeStyleRerenderSubscribe(actorId), { skipInitial: true }),
					)
					return brandStore
				} catch {
					return null
				}
			})()
			loadPromises.push(brandPromise)
		}

		let inboxPromise = null
		if (actorConfig.inbox) {
			inboxPromise = (async () => {
				const inboxStore = await this._readStore(actorConfig.inbox)
				if (!inboxStore) return null
				let debounceTimeout = null
				const inboxUnsub = inboxStore.subscribe((updatedCostream) => {
					if (!this.actors.has(actorId) || !updatedCostream?.items) return
					if (debounceTimeout) clearTimeout(debounceTimeout)
					debounceTimeout = setTimeout(() => {
						debounceTimeout = null
						this.processMessages(actorId)
					}, 50)
				})
				configUnsubscribes.push(() => {
					if (debounceTimeout) {
						clearTimeout(debounceTimeout)
						debounceTimeout = null
					}
					inboxUnsub()
				})
				return inboxStore
			})()
			loadPromises.push(inboxPromise)
		}

		// Wait for all configs to load in parallel
		await Promise.all(loadPromises)

		// Process results
		let context = null,
			contextCoId = null,
			contextSchemaCoId = null
		if (contextPromise) {
			const result = await contextPromise
			// $stores Architecture: Backend unified store handles query merging automatically
			context = result.store // ReactiveStore with merged query results
			contextCoId = result.contextCoId
			contextSchemaCoId = result.contextSchemaCoId
		}

		let inbox = null,
			inboxCoId = null
		if (inboxPromise) {
			inboxCoId = actorConfig.inbox
			inbox = await inboxPromise
		}

		return { viewDef, context, contextCoId, contextSchemaCoId, inbox, inboxCoId, configUnsubscribes }
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
	 * Determine if an actor is a service actor (orchestrator) vs UI actor (presentation)
	 * Service actors: type "service" OR role ends with /vibe (except @creator/vibe) OR have minimal view (only $slot)
	 * UI actors: Have full view (render actual UI components)
	 * @param {Object} actorConfig - Actor configuration
	 * @param {Object} viewDef - View definition (optional, will be loaded if not provided)
	 * @returns {Promise<boolean>} True if service actor, false if UI actor
	 * @private
	 */
	async _isServiceActor(actorConfig, viewDef = null) {
		if (!actorConfig.view) return true
		if (actorConfig.type === 'service') return true
		const role = actorConfig.role
		if (typeof role === 'string' && role.endsWith('/vibe') && role !== '@creator/vibe') return true
		if (!viewDef) {
			try {
				const viewStore = await this._readStore(actorConfig.view)
				if (!viewStore) return false
				viewDef = viewStore.value
			} catch {
				return false
			}
		}
		const rootNode = viewDef.content || viewDef.root || viewDef
		if (!rootNode) return true
		if (rootNode.$slot && !rootNode.children) return true
		if (rootNode.children?.every((child) => child.$slot || child.children?.every((c) => c.$slot)))
			return true
		return !(
			rootNode.tag &&
			(rootNode.text ||
				rootNode.value ||
				rootNode.$on ||
				rootNode.children?.some((child) => child.tag && (child.text || child.value || child.$on)))
		)
	}

	/**
	 * Create a child actor lazily if it doesn't exist yet
	 * Only creates the child actor when it's actually needed (referenced by context.currentView)
	 * @param {Object} actor - Parent actor instance
	 * @param {string} namekey - Child actor namekey (e.g., "list", "kanban")
	 * @param {string} [vibeKey] - Optional vibe key for tracking child actors
	 * @returns {Promise<Object|null>} The child actor instance, or null if not found/created
	 * @private
	 */
	async _createChildActorIfNeeded(actor, namekey, vibeKey = null) {
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
			const childActor = await this.createActor(childActorConfig, childContainer, vibeKey)
			childActor.namekey = namekey
			actor.children[namekey] = childActor
			return childActor
		} catch (_error) {
			return null
		}
	}

	async createActor(actorConfig, containerElement, vibeKey = null) {
		const actorId = actorConfig.$id || actorConfig.id
		if (this.actors.has(actorId)) {
			return vibeKey
				? await this.reuseActor(actorId, containerElement, vibeKey)
				: this.actors.get(actorId)
		}
		const shadowRoot = containerElement.attachShadow({ mode: 'open' })
		const styleSheets = await this.styleEngine.getStyleSheets(actorConfig, actorId)
		const { viewDef, context, contextCoId, contextSchemaCoId, inbox, inboxCoId, configUnsubscribes } =
			await this._loadActorConfigs(actorConfig)
		const actorType = (await this._isServiceActor(actorConfig, viewDef)) ? 'service' : 'ui'
		const actor = {
			id: actorId,
			config: actorConfig,
			shadowRoot,
			context,
			contextCoId,
			contextSchemaCoId,
			containerElement,
			actorEngine: this,
			viewDef,
			actorType,
			vibeKey,
			inbox,
			inboxCoId,
			messageTypes: actorConfig.messageTypes || null, // REQUIRED: Message types this actor accepts
			_renderState: RENDER_STATES.INITIALIZING, // Start in INITIALIZING state
			children: {},
			_configUnsubscribes: configUnsubscribes || [],
		}

		this.actors.set(actorId, actor)

		// $stores Architecture: Subscribe to context changes AFTER actor is created
		// Backend unified store handles query merging, we just need to trigger rerenders on changes
		// Subscribe with skipInitial to avoid triggering rerender during initial load
		// CRITICAL: State is INITIALIZING, so subscriptions won't trigger renders yet
		if (actor.context && typeof actor.context.subscribe === 'function') {
			// Store last context value to prevent unnecessary rerenders
			// CRITICAL: Initialize with current value to ensure first change after initial render is detected
			let lastContextValue = JSON.stringify(actor.context.value || {})

			// Store unsubscribe function for cleanup when actor is destroyed
			actor._contextUnsubscribe = actor.context.subscribe(
				(newValue) => {
					// CRITICAL: Always check for changes, even if skipInitial is true
					// This ensures that when query stores update (e.g., [] -> [items]), context subscription fires
					const currentContextValue = JSON.stringify(newValue || {})
					const contextChanged = currentContextValue !== lastContextValue

					// Update lastContextValue BEFORE checking conditions to prevent double updates
					lastContextValue = currentContextValue

					// Trigger rerender when context updates (e.g., query results change from [] to [items])
					// Only rerender if state is READY (initial render complete) and context actually changed
					// State machine prevents renders during INITIALIZING or RENDERING states
					if (actor._renderState === RENDER_STATES.READY && contextChanged) {
						actor._renderState = RENDER_STATES.UPDATING
						this._scheduleRerender(actorId)
					}
				},
				{ skipInitial: true },
			)
		}

		if (containerElement) {
			if (!this._containerActors.has(containerElement)) {
				this._containerActors.set(containerElement, new Set())
			}
			this._containerActors.get(containerElement).add(actorId)
		}
		if (vibeKey) this.registerActorForVibe(actorId, vibeKey)

		// Backend unified store handles all query resolution and merging automatically
		// Views use context.value directly - backend handles reactivity via subscriptionCache
		await this._initializeActorState(actor, actorConfig)

		// Transition to RENDERING state before render
		actor._renderState = RENDER_STATES.RENDERING
		await this.viewEngine.render(viewDef, actor.context, shadowRoot, styleSheets, actorId)

		// Transition to READY state after initial render completes
		// This allows context subscriptions to trigger rerenders
		actor._renderState = RENDER_STATES.READY

		if (actor._needsPostInitRerender) {
			delete actor._needsPostInitRerender
			// Schedule rerender (will be batched with other updates)
			this._scheduleRerender(actorId)
		}
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
	 * Register an actor with a vibe key for reuse tracking
	 * @param {string} actorId - The actor ID
	 * @param {string} vibeKey - The vibe key (e.g., 'todos')
	 */
	registerActorForVibe(actorId, vibeKey) {
		if (!vibeKey) return

		if (!this._vibeActors.has(vibeKey)) {
			this._vibeActors.set(vibeKey, new Set())
		}
		this._vibeActors.get(vibeKey).add(actorId)
	}

	/**
	 * Get all actors for a vibe
	 * @param {string} vibeKey - The vibe key (e.g., 'todos')
	 * @returns {Set<string>|undefined} Set of actor IDs for the vibe
	 */
	getActorsForVibe(vibeKey) {
		return this._vibeActors.get(vibeKey)
	}

	/**
	 * Reuse an existing actor by reattaching it to a new container
	 * @param {string} actorId - The actor ID
	 * @param {HTMLElement} containerElement - The new container to attach to
	 * @param {string} vibeKey - The vibe key (e.g., 'todos')
	 * @returns {Promise<Object>} The reused actor instance
	 */
	async reuseActor(actorId, containerElement, vibeKey) {
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
		this.registerActorForVibe(actorId, vibeKey)
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
		// Without this, colist + per-item subscriptions leak when switching vibes (detach keeps actors, but destroy must clean)
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
		for (const [vibeKey, vibeActorIds] of this._vibeActors.entries()) {
			if (vibeActorIds.has(actorId)) {
				vibeActorIds.delete(actorId)
				if (vibeActorIds.size === 0) this._vibeActors.delete(vibeKey)
				break
			}
		}
		this.actors.delete(actorId)
	}

	/**
	 * Destroy all actors for a given container
	 * Used when unloading a vibe to clean up all actors associated with that container
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
	 * Destroy all actors for a vibe (complete cleanup)
	 * Used for explicit cleanup when needed (e.g., app shutdown)
	 * @param {string} vibeKey - The vibe key (e.g., 'todos')
	 */
	destroyActorsForVibe(vibeKey) {
		const actorIds = this._vibeActors.get(vibeKey)
		if (!vibeKey || !actorIds?.size) return
		for (const actorId of Array.from(actorIds)) {
			this.destroyActor(actorId)
		}
		this._vibeActors.delete(vibeKey)
	}

	/**
	 * Deliver event to target actor. Inbox-only: all events go to CoStream first.
	 * processMessages is the only caller of stateEngine.send.
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
		await this._pushToInbox(targetId, message)
		// Same-actor: trigger processMessages immediately (bypass 50ms subscription debounce)
		if (senderId === targetId) {
			const actor = this.actors.get(targetId)
			if (actor?.inboxCoId && this.dataEngine) await this.processMessages(targetId)
		}
	}

	/**
	 * Push message to target's inbox. Resolves target to inbox co-id via CoJSON. No in-memory queue.
	 * @param {string} targetId - Actor co-id (or human-readable ref)
	 * @param {Object} message - { type, payload, source, target, processed }
	 */
	async _pushToInbox(targetId, message) {
		if (!this.dataEngine?.peer) return
		let inboxCoId = null
		const actor = this.actors.get(targetId)
		if (actor?.inboxCoId) {
			inboxCoId = actor.inboxCoId
		} else {
			// Resolve targetId to inbox co-id: read actor config from CoJSON, get inbox ref, resolve to co-id
			try {
				if (!targetId.startsWith('co_z')) {
					const resolved = await this.dataEngine.execute({
						op: 'resolve',
						humanReadableKey: targetId,
					})
					if (resolved?.startsWith?.('co_z')) targetId = resolved
					else throw new Error(`[ActorEngine] Failed to resolve target: ${targetId}`)
				}
				const actorStore = await this._readStore(targetId)
				if (!actorStore) throw new Error(`[ActorEngine] Failed to read actor config: ${targetId}`)
				const inboxRef = actorStore?.value?.inbox
				if (!inboxRef) throw new Error(`[ActorEngine] Actor config has no inbox: ${targetId}`)
				const inboxRefStr = typeof inboxRef === 'string' ? inboxRef : (inboxRef?.id ?? String(inboxRef))
				if (inboxRefStr.startsWith('co_z')) {
					inboxCoId = inboxRefStr
				} else {
					inboxCoId = await this.dataEngine.execute({
						op: 'resolve',
						humanReadableKey: inboxRefStr,
					})
				}
				if (!inboxCoId?.startsWith?.('co_z')) {
					throw new Error(`[ActorEngine] Failed to resolve inbox ref: ${inboxRefStr}`)
				}
			} catch (err) {
				throw new Error(
					`[ActorEngine] _pushToInbox: cannot resolve target to inbox. ${err?.message || err}`,
				)
			}
		}
		const messageData = {
			type: message.type,
			payload: message.payload || {},
			source: message.source,
			target: targetId,
			processed: false,
		}
		await this.dataEngine.peer.createAndPushMessage(inboxCoId, messageData)
	}

	/**
	 * Validate message type against actor's message contract
	 * @param {Object} actor - Actor instance
	 * @param {string} messageType - Message type to validate
	 * @returns {boolean} True if message type is accepted, false otherwise
	 */
	_validateMessageType(actor, messageType) {
		// REQUIRED: All actors must declare messageTypes (exhaustive list - like sealed protocol)
		if (!actor.messageTypes || !Array.isArray(actor.messageTypes)) {
			return false
		}

		// Check if message type is in contract
		if (!actor.messageTypes.includes(messageType)) {
			return false
		}

		return true
	}

	/**
	 * Load message type schema from registry
	 * @param {string} messageType - Message type name (e.g., 'CREATE_BUTTON')
	 * @returns {Promise<Object|null>} Message type schema or null if not found
	 */
	async _loadMessageTypeSchema(messageType) {
		if (this.dataEngine?.peer) {
			try {
				const schemaKey = `${this.dataEngine.peer.systemSpark}/schema/message/${messageType}`
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
	async _validateMessagePayload(messageTypeSchema, payload, messageType) {
		if (!messageTypeSchema) {
			// Schema is required - this should never happen if _loadMessageTypeSchema is called first
			return { valid: false, errors: [`Message type schema is required for ${messageType}`] }
		}

		try {
			// Filter out CoJSON metadata properties that shouldn't be validated
			// These are added by the CoMap structure but aren't part of the JSON Schema
			const { groupInfo, ...schemaForValidation } = messageTypeSchema

			// Message type schema IS the payload schema - validate directly
			// Note: indexing is now registered as an AJV keyword, so no need to filter it out
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
	async validateMessagePayloadForSend(eventType, payload) {
		const schema = await this._loadMessageTypeSchema(eventType)
		if (!schema) return true
		const result = await this._validateMessagePayload(schema, payload || {}, eventType)
		return result.valid
	}

	async processMessages(actorId) {
		const actor = this.actors.get(actorId)
		if (!actor || !actor.inboxCoId || !this.dataEngine || actor._isProcessing) return
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
					// VALIDATION LAYER: Validate message before state machine
					// CRITICAL: Mark rejected messages as processed to prevent infinite retry loop
					const markRejectedAsProcessed = async () => {
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

					// Step 1: Check actor message contract
					if (!this._validateMessageType(actor, message.type)) {
						console.warn('[ActorEngine] processMessages: message type not in contract', {
							actorId,
							messageType: message.type,
							messageTypes: actor.messageTypes,
						})
						await markRejectedAsProcessed()
						continue // Skip invalid message
					}

					// Step 2: Load message type schema (REQUIRED)
					const messageTypeSchema = await this._loadMessageTypeSchema(message.type)
					if (!messageTypeSchema) {
						console.warn('[ActorEngine] processMessages: message type schema not found', {
							actorId,
							messageType: message.type,
							schemaKey: `${this.dataEngine?.peer?.systemSpark ?? '°Maia'}/schema/message/${message.type}`,
						})
						await markRejectedAsProcessed()
						continue // Reject message - schema is required
					}

					// Step 3: Validate payload against message type schema (REQUIRED)
					// Ensure payload is always an object (never undefined/null)
					const payload = message.payload || {}
					const validation = await this._validateMessagePayload(messageTypeSchema, payload, message.type)
					if (!validation.valid) {
						await markRejectedAsProcessed()
						continue
					}

					// Pass plain object to avoid reactive proxy issues; state engine expects clean JSON
					const payloadPlain = {
						...(payload && typeof payload === 'object'
							? JSON.parse(JSON.stringify(payload))
							: payload || {}),
						...(message._coId ? { idempotencyKey: message._coId } : {}),
					}

					if (!actor.machine || !this.stateEngine) return
					const handled = await this.stateEngine.send(actor.machine.id, message.type, payloadPlain)
					if (handled && message._coId) {
						try {
							await this.dataEngine.execute({
								op: 'update',
								id: message._coId,
								data: { processed: true },
							})
						} catch (_markError) {}
					}
					if (!handled) {
						hadUnhandledMessages = true
					}
				} catch (error) {
					console.error('[ActorEngine] processMessages: message handling failed', {
						actorId,
						messageType: message.type,
						error,
					})
				}
			}
		} catch (error) {
			console.error('[ActorEngine] processMessages: inbox processing failed', { actorId, error })
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
				setTimeout(() => this.processMessages(actorId), 0)
			}
		}
	}
}
