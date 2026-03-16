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
 * destroyActor, destroyActorsForVibe, destroyActorsForContainer for teardown.
 */

import { normalizeCoValueData } from '@MaiaOS/db'
import { containsExpressions } from '@MaiaOS/schemata/expression-resolver'
import { validateAgainstSchema } from '@MaiaOS/schemata/validation.helper'
import { deriveInboxRef } from '../utils/inbox-convention.js'
import {
	sanitizePayloadForValidation,
	stripInfrastructureKeysForValidation,
} from '../utils/payload-sanitizer.js'
import { perfChatStart, perfChatStep } from '../utils/perf-chat.js'
import { perfPipelineStep } from '../utils/perf-pipeline.js'
import {
	loadContextStore,
	resolveSchemaFromCoValue,
	resolveToCoId,
} from '../utils/resolve-helpers.js'
import { readStore } from '../utils/store-reader.js'
import { traceInbox } from '../utils/trace.js'
import { getUploadProgressUpdates } from '../utils/upload-progress.js'
import { isContentEditableActive } from '../utils/utils.js'

const INBOX_DEBOUNCE_MS = 0

/** System events accepted by all actors implicitly */
const SYSTEM_EVENTS = new Set(['SUCCESS', 'ERROR'])

// Render state machine - prevents race conditions by ensuring renders only happen when state allows
export const RENDER_STATES = {
	INITIALIZING: 'initializing', // Setting up subscriptions, loading initial data
	RENDERING: 'rendering', // Currently rendering (prevents nested renders)
	READY: 'ready', // Initial render complete, ready for updates
	UPDATING: 'updating', // Data changed, queued for rerender
}

export class ActorEngine {
	constructor(styleEngine, viewEngine, processEngine) {
		this.styleEngine = styleEngine
		this.viewEngine = viewEngine
		this.processEngine = processEngine
		this.actors = new Map()
		this.dataEngine = null
		this.os = null
		this._containerActors = new Map()
		this._vibeActors = new Map()
		// ViewEngine/StateEngine receive ActorOps via Loader - no circular ref from here

		// Svelte-style rerender batching (microtask queue)
		this.pendingRerenders = new Set() // Track actors needing rerender
		this.batchTimer = null // Track if microtask is scheduled

		this.runtime = null
		this._uploadProgressLastReport = new Map()
	}

	/**
	 * Update actor context. Writes to CoValue and eagerly merges into context store
	 * so UI rerenders immediately (CoValue propagation to store may lag).
	 */
	async updateContextCoValue(actor, updates) {
		const sanitizedUpdates = {}
		for (const [key, value] of Object.entries(updates)) {
			sanitizedUpdates[key] = value === undefined ? null : value
		}
		// Eager merge FIRST: local store always reflects the update for immediate rerender
		if (actor.context && typeof actor.context._set === 'function') {
			const merged = { ...(actor.context.value || {}), ...sanitizedUpdates }
			actor.context._set(merged)
			if (typeof actor.context._resolveQueries === 'function') {
				await actor.context._resolveQueries(sanitizedUpdates)
			}
		}
		// Persist to CoValue (skip if no CoValue backing)
		if (actor.contextCoId && this.dataEngine) {
			const contextSchemaCoId =
				actor.contextSchemaCoId ||
				(await resolveSchemaFromCoValue(this.dataEngine?.peer, actor.contextCoId))
			await this.dataEngine.execute({
				op: 'update',
				schema: contextSchemaCoId,
				id: actor.contextCoId,
				data: sanitizedUpdates,
			})
		}
		this._scheduleRerender(actor.id)
	}

	/**
	 * Report upload progress to actor context. Called by ViewEngine's onProgress during BlobEngine upload.
	 * Unified pipeline: bytes → storing → done.
	 * @param {string} actorId - Actor to show progress (has context with uploadStatus, etc.)
	 * @param {number} loadedBytes - Bytes uploaded so far
	 * @param {number} totalBytes - Total bytes to upload
	 * @param {'reading'|'bytes'|'storing'|'done'} [phase] - Pipeline phase
	 */
	reportUploadProgress(actorId, loadedBytes, totalBytes, phase) {
		const actor = this.actors.get(actorId)
		if (!actor?.contextCoId || !this.dataEngine) return
		const PROGRESS_THROTTLE_MS = 150
		const now = Date.now()
		if (phase !== 'reading' && phase !== 'storing' && phase !== 'done' && loadedBytes < totalBytes) {
			const last = this._uploadProgressLastReport.get(actorId) ?? 0
			if (now - last < PROGRESS_THROTTLE_MS) return
			this._uploadProgressLastReport.set(actorId, now)
		} else if (phase === 'done') {
			this._uploadProgressLastReport.delete(actorId)
		} else if (loadedBytes >= totalBytes && phase !== 'storing') {
			this._uploadProgressLastReport.delete(actorId)
		}
		const updates = getUploadProgressUpdates(loadedBytes, totalBytes, phase)
		this.updateContextCoValue(actor, updates).catch(() => {})
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
	 * @param {string} [vibeKey] - Optional vibe key for tracking child actors
	 * @returns {Promise<Object|null>} The child actor instance, or null if not found/created
	 * @private
	 */
	async _createChildActorIfNeeded(actor, namekey, _vibeKey = null) {
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
			const childActor = await this.createActor(
				childActorConfig,
				childContainer,
				_vibeKey,
				actor,
				namekey,
			)
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

	async createActor(
		actorConfig,
		containerElement,
		vibeKey = null,
		parentActor = null,
		namekey = null,
	) {
		const actorId = actorConfig.$id || actorConfig.id
		if (this.actors.has(actorId)) {
			return vibeKey
				? await this.reuseActor(actorId, containerElement, vibeKey)
				: this.actors.get(actorId)
		}
		// Inbox by convention: derive when missing so config always has inbox set
		let inboxRef = actorConfig.inbox ?? deriveInboxRef(actorConfig.$id || actorConfig.id)
		if (inboxRef) {
			const resolved = await resolveToCoId(this.dataEngine?.peer, inboxRef)
			if (resolved) inboxRef = resolved
		}
		if (!inboxRef)
			throw new Error(`[ActorEngine] Actor config must have inbox (or derivable from $id): ${actorId}`)
		actorConfig.inbox = inboxRef
		if (!actorConfig.process)
			throw new Error(`[ActorEngine] Actor config must have process: ${actorId}`)
		const actor = await this.spawnActor(actorConfig)

		// Container/aven registration (ActorEngine)
		if (containerElement) {
			if (!this._containerActors.has(containerElement))
				this._containerActors.set(containerElement, new Set())
			this._containerActors.get(containerElement).add(actorId)
		}
		if (vibeKey) this.registerActorForVibe(actorId, vibeKey)

		// View/DOM: delegate to ViewEngine
		const onBeforeRender = () => this._initializeActorState(actor, actorConfig)
		await this.viewEngine.attachViewToActor(
			actor,
			containerElement,
			actorConfig,
			vibeKey,
			onBeforeRender,
			parentActor,
			namekey,
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
		// Skip rerender when any contenteditable has focus — prevents blur on each keystroke
		// (Must check globally: parent rerender would destroy child's contenteditable)
		if (isContentEditableActive()) {
			actor._renderState = RENDER_STATES.READY
			return
		}
		actor._renderState = RENDER_STATES.RENDERING
		const styleSheets = await this.styleEngine.getStyleSheets(actor.config, actorId)
		await this.viewEngine.render(
			actor.viewDef,
			actor.context,
			actor.shadowRoot,
			styleSheets,
			actorId,
			{
				dataEngine: this.dataEngine,
			},
		)
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
	 * Register an actor with an aven key for reuse tracking
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
		// Without this, colist + per-item subscriptions leak when switching avens (detach keeps actors, but destroy must clean)
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
		for (const [vibeKey, vibeActorIds] of this._vibeActors.entries()) {
			if (vibeActorIds.has(actorId)) {
				vibeActorIds.delete(actorId)
				if (vibeActorIds.size === 0) this._vibeActors.delete(vibeKey)
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
	 * Attach inbox watcher. Shared by spawnActor and view actors.
	 * @param {string} actorId - Actor ID
	 * @param {string} inboxCoId - Inbox CoStream co-id
	 * @param {Object} actorConfig - Actor config (for spawn if needed)
	 * @param {Array} configUnsubscribes - Array to push unsubscribe function to
	 * @private
	 */
	_attachInboxSubscription(actorId, inboxCoId, actorConfig, configUnsubscribes) {
		if (!configUnsubscribes) return
		const unsub = this.watchInbox(inboxCoId, actorId, actorConfig)
		configUnsubscribes.push(unsub)
	}

	async _resolveInboxForTarget(targetId) {
		if (typeof targetId !== 'string') {
			throw new Error(`[ActorEngine] targetId must be string, got: ${targetId}`)
		}
		const resolvedTargetId = await resolveToCoId(this.dataEngine?.peer, targetId)
		if (!resolvedTargetId) {
			throw new Error(`[ActorEngine] targetId must be co-id (or resolve to co-id), got: ${targetId}`)
		}
		targetId = resolvedTargetId
		const actor = this.actors.get(targetId)
		if (actor?.inboxCoId) {
			return { inboxCoId: actor.inboxCoId, targetActorConfig: null, resolvedTargetId: targetId }
		}
		const actorStore = await readStore(this.dataEngine, targetId)
		if (!actorStore) throw new Error(`[ActorEngine] Failed to read actor config: ${targetId}`)
		const targetActorConfig = actorStore?.value
		let inboxCoId =
			targetActorConfig?.inbox ??
			deriveInboxRef(targetActorConfig?.$id || targetActorConfig?.id || targetId)
		if (inboxCoId && typeof inboxCoId === 'string') {
			inboxCoId = (await resolveToCoId(this.dataEngine?.peer, inboxCoId)) ?? inboxCoId
		}
		if (!inboxCoId || typeof inboxCoId !== 'string' || !inboxCoId.startsWith('co_z')) {
			throw new Error(
				`[ActorEngine] Actor config inbox must be co-id (or derivable from $id): ${targetId}`,
			)
		}
		return { inboxCoId, targetActorConfig, resolvedTargetId: targetId }
	}

	async _pushMessage(inboxCoId, message) {
		const sourceCoId = message.source
		const targetCoId = message.target
		if (sourceCoId && (typeof sourceCoId !== 'string' || !sourceCoId.startsWith('co_z'))) {
			throw new Error(`[ActorEngine] source must be co-id, got: ${sourceCoId}`)
		}
		if (targetCoId && (typeof targetCoId !== 'string' || !targetCoId.startsWith('co_z'))) {
			throw new Error(`[ActorEngine] target must be co-id, got: ${targetCoId}`)
		}
		const payload = message.payload || {}
		if (payload?.file instanceof File || payload?.fileBase64) {
			throw new Error(
				'[ActorEngine] Binary not allowed in inbox. Use DataEngine uploadToCoBinary first. Payload must contain co-id (avatar), not file/fileBase64.',
			)
		}
		const messageData = {
			type: message.type,
			payload,
			source: sourceCoId,
			target: targetCoId,
			processed: false,
		}
		await this.dataEngine.peer.createAndPushMessage(inboxCoId, messageData)
	}

	_validateEventType(actor, messageType) {
		if (SYSTEM_EVENTS.has(messageType)) return true
		const schema = actor.interfaceSchema
		if (!schema?.properties || typeof schema.properties !== 'object') return false
		return messageType in schema.properties
	}

	_getPayloadSchemaFromActor(actor, messageType) {
		if (!actor.interfaceSchema?.properties) return null
		return actor.interfaceSchema.properties[messageType] ?? null
	}

	async _validateEventPayload(messageTypeSchema, payload, messageType) {
		if (!messageTypeSchema) {
			return { valid: false, errors: [`Message type schema is required for ${messageType}`] }
		}
		try {
			const { groupInfo, cotype, indexing, ...schemaForValidation } = messageTypeSchema
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

	async validateMessage(actor, message) {
		if (!this._validateEventType(actor, message.type)) return { valid: false }
		if (SYSTEM_EVENTS.has(message.type)) {
			if (message.type === 'ERROR') {
				const errors = message.payload?.errors
				if (!Array.isArray(errors)) return { valid: false }
			}
			const payloadPlain = {
				...(message.payload && typeof message.payload === 'object'
					? JSON.parse(JSON.stringify(message.payload))
					: message.payload || {}),
				...(message._coId ? { idempotencyKey: message._coId } : {}),
			}
			return { valid: true, payloadPlain }
		}
		const payloadSchema = this._getPayloadSchemaFromActor(actor, message.type)
		if (!payloadSchema) return { valid: false }
		let payload = message.payload || {}
		if (
			message.type === 'DB_OP' &&
			(Array.isArray(payload) || !payload || typeof payload !== 'object' || !('op' in payload))
		) {
			return { valid: false }
		}
		if (payload && typeof payload === 'object') {
			payload = sanitizePayloadForValidation(normalizeCoValueData(payload))
		}
		const payloadForValidation = stripInfrastructureKeysForValidation(payload)
		const validation = await this._validateEventPayload(
			payloadSchema,
			payloadForValidation,
			message.type,
		)
		if (!validation.valid) return { valid: false }
		const payloadPlain = {
			...(payload && typeof payload === 'object'
				? JSON.parse(JSON.stringify(payload))
				: payload || {}),
			...(message._coId ? { idempotencyKey: message._coId } : {}),
		}
		return { valid: true, payloadPlain }
	}

	async getUnprocessedMessages(inboxCoId, actorId) {
		const result = await this.dataEngine?.execute?.({
			op: 'processInbox',
			actorId,
			inboxCoId,
		})
		return { messages: result?.messages ?? [] }
	}

	async validatePayloadForActor(actorId, eventType, payload) {
		const r = await this.validatePayloadForActorWithDetails(actorId, eventType, payload)
		return r.valid
	}

	async validatePayloadForActorWithDetails(actorId, eventType, payload) {
		const actor = this.getActor(actorId)
		if (!actor) return { valid: true, errors: null }
		const schema = this._getPayloadSchemaFromActor(actor, eventType)
		if (!schema) return { valid: true, errors: null }
		const result = await this._validateEventPayload(schema, payload || {}, eventType)
		return { valid: result.valid, errors: result.errors }
	}

	async processUnprocessedMessages(inboxCoId, actorId, actorConfig) {
		if (!this.runtime?.processInboxForActor) return
		await this.runtime.processInboxForActor(inboxCoId, actorId, actorConfig)
	}

	watchInbox(inboxCoId, actorId, actorConfig) {
		if (!this.dataEngine || !actorConfig?.inbox) return () => {}
		if (typeof actorId !== 'string' || !actorId.startsWith('co_z')) {
			throw new Error(`[ActorEngine] watchInbox: actorId must be co-id, got: ${actorId}`)
		}
		if (typeof inboxCoId !== 'string' || !inboxCoId.startsWith('co_z')) {
			throw new Error(`[ActorEngine] watchInbox: inboxCoId must be co-id, got: ${inboxCoId}`)
		}
		const process = () => this.processUnprocessedMessages(inboxCoId, actorId, actorConfig)
		let debounceTimeout = null
		const scheduleProcess = () => {
			if (debounceTimeout) clearTimeout(debounceTimeout)
			debounceTimeout = setTimeout(() => {
				debounceTimeout = null
				process()
			}, INBOX_DEBOUNCE_MS)
		}
		let unsub = () => {}
		const resolveAndSubscribe = async () => {
			const schemaCoId = await resolveSchemaFromCoValue(this.dataEngine?.peer, inboxCoId)
			const inboxStore = schemaCoId
				? await this.dataEngine
						?.execute?.({ op: 'read', schema: schemaCoId, key: inboxCoId })
						.catch(() => null)
				: null
			if (!inboxStore?.subscribe) {
				scheduleProcess()
				return
			}
			const inboxUnsub = inboxStore.subscribe(scheduleProcess)
			scheduleProcess()
			unsub = () => {
				if (debounceTimeout) clearTimeout(debounceTimeout)
				inboxUnsub?.()
			}
		}
		resolveAndSubscribe()
		return () => unsub()
	}

	async deliver(targetId, message) {
		const isChatSend =
			message?.type === 'SEND_MESSAGE' && message?.payload != null && 'inputText' in message.payload
		if (isChatSend) perfChatStart(`deliver SEND_MESSAGE → ${String(targetId).slice(0, 24)}...`)
		perfPipelineStep('inbox:deliver:start', { type: message?.type, targetId: targetId?.slice(0, 20) })
		traceInbox(message?.source, targetId, message?.type)
		if (!this.dataEngine?.peer) {
			throw new Error(
				'[ActorEngine] Cannot push to inbox: dataEngine or peer not set. Ensure MaiaOS is booted before deliverEvent.',
			)
		}
		let resolved
		try {
			resolved = await this._resolveInboxForTarget(targetId)
		} catch (err) {
			throw new Error(`[ActorEngine] cannot resolve target to inbox. ${err?.message || err}`)
		}
		perfPipelineStep('inbox:resolveInbox')
		const { inboxCoId, targetActorConfig } = resolved
		const messageWithTarget = { ...message, target: resolved.resolvedTargetId }
		if (isChatSend) perfChatStep('_pushMessage (createAndPushMessage)')
		await this._pushMessage(inboxCoId, messageWithTarget)
		perfPipelineStep('inbox:pushMessage')
		if (isChatSend) perfChatStep('_pushMessage done')
		if (targetActorConfig && this.runtime) {
			if (isChatSend) perfChatStep('ensureActorSpawned (targetActorConfig)')
			await this.runtime.ensureActorSpawned(targetActorConfig, inboxCoId)
			if (isChatSend) perfChatStep('ensureActorSpawned done')
		}
		if (this.actors?.has(resolved.resolvedTargetId)) {
			await this.processEvents(resolved.resolvedTargetId)
		}
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

		const inboxRef = actorConfig.inbox ?? deriveInboxRef(actorConfig.$id || actorConfig.id)
		if (!inboxRef || !actorConfig.process || typeof inboxRef !== 'string') return null
		const inboxCoId = await resolveToCoId(this.dataEngine?.peer, inboxRef)
		if (!inboxCoId) return null
		const processRef = actorConfig.process
		if (typeof processRef !== 'string') {
			throw new Error(`[ActorEngine] spawnActor: process must be string, got: ${typeof processRef}`)
		}
		const configCoId = await resolveToCoId(this.dataEngine?.peer, processRef)
		if (!configCoId) {
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
		if (interfaceRef && typeof interfaceRef === 'string') {
			const interfaceCoId = await resolveToCoId(this.dataEngine?.peer, interfaceRef)
			if (interfaceCoId) {
				const ifaceStore = await readStore(this.dataEngine, interfaceCoId)
				if (ifaceStore?.value) interfaceSchema = ifaceStore.value
			}
		}

		const configUnsubscribes = []
		let executableFunction = null
		let wasmConfig = actorConfig.wasm
		if (typeof wasmConfig === 'string') {
			const wasmCoId = await resolveToCoId(this.dataEngine?.peer, wasmConfig)
			if (wasmCoId) {
				const wasmStore = await readStore(this.dataEngine, wasmCoId)
				wasmConfig = wasmStore?.value ?? null
			}
		}
		if (wasmConfig?.lang === 'js' && wasmConfig?.code) {
			const codeRef = wasmConfig.code
			if (typeof codeRef === 'string' && codeRef.startsWith('co_z')) {
				const codeStore = await readStore(this.dataEngine, codeRef)
				const codeData = codeStore?.value
				const items = codeData?.items ?? []
				const code = Array.isArray(items)
					? items.join('')
					: typeof codeData === 'string'
						? codeData
						: ''
				if (typeof code === 'string' && code.length > 0) {
					const { executeInSandbox } = await import('../utils/quickjs-executor.js')
					executableFunction = {
						execute: async (actor, payload) => {
							const actorView = {
								id: actor.id,
								contextSchemaCoId: actor.contextSchemaCoId ?? null,
								contextCoId: actor.contextCoId ?? null,
							}
							return executeInSandbox(code, actorView, payload)
						},
					}
					if (codeStore?.subscribe) {
						const rebuildExecutable = () => {
							const actor = this.actors.get(actorId)
							if (!actor) return
							const data = codeStore?.value
							const items = data?.items ?? []
							const newCode = Array.isArray(items) ? items.join('') : typeof data === 'string' ? data : ''
							if (newCode) {
								actor.executableFunction = {
									execute: async (a, p) => {
										const actorView = {
											id: a.id,
											contextSchemaCoId: a.contextSchemaCoId ?? null,
											contextCoId: a.contextCoId ?? null,
										}
										return executeInSandbox(newCode, actorView, p)
									},
								}
							}
						}
						configUnsubscribes.push(codeStore.subscribe(rebuildExecutable, { skipInitial: true }))
					}
				}
			} else if (typeof codeRef === 'string' && codeRef.length > 0) {
				const { executeInSandbox } = await import('../utils/quickjs-executor.js')
				executableFunction = {
					execute: async (actor, payload) => {
						const actorView = {
							id: actor.id,
							contextSchemaCoId: actor.contextSchemaCoId ?? null,
							contextCoId: actor.contextCoId ?? null,
						}
						return executeInSandbox(codeRef, actorView, payload)
					},
				}
			}
		}
		if (!executableFunction) {
			const { getActor } = await import('@MaiaOS/actors')
			const label = actorConfig['@label']
			const namespacePath = typeof label === 'string' ? label.replace(/^@/, '') : null
			const actorModule = namespacePath ? getActor(namespacePath) : null
			executableFunction = actorModule?.function ?? null
		}

		const minimalContext = { value: {}, subscribe: () => () => {} }

		// Load context for headless actors (paper, todos, etc.) so execute() has notes/todos
		let contextStore = minimalContext
		let contextCoId = null
		let contextSchemaCoId = null
		const contextRef = actorConfig.context
		if (contextRef && typeof contextRef === 'string') {
			const loaded = await loadContextStore(this.dataEngine, contextRef, {
				waitForStoreReadyMs: 3000,
			})
			if (loaded.store) {
				contextStore = loaded.store
				contextCoId = loaded.coId
				contextSchemaCoId = loaded.schemaCoId
				if (loaded.store._unsubscribe) {
					configUnsubscribes.push(() => loaded.store._unsubscribe())
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
			vibeKey: null,
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
			this._attachInboxSubscription(actorId, inboxCoId, actorConfig, configUnsubscribes)
		}
		this.actors.set(actorId, actor)
		return actor
	}

	/**
	 * Destroy all actors for a given container
	 * Used when unloading an aven to clean up all actors associated with that container
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
	 * Destroy all actors for an aven (complete cleanup)
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
		await this.deliver(targetId, message)
	}

	async validateEventPayloadForSend(actorId, eventType, payload) {
		return this.validatePayloadForActor(actorId, eventType, payload)
	}

	/** Returns { valid, errors } for detailed logging when validation fails */
	async validateEventPayloadForSendWithDetails(actorId, eventType, payload) {
		return this.validatePayloadForActorWithDetails(actorId, eventType, payload)
	}

	async processEvents(actorId, preloadedMessages = null) {
		const actor = this.actors.get(actorId)
		if (!actor || !actor.inboxCoId || !this.dataEngine || actor._isProcessing) return
		actor._isProcessing = true
		let hadUnhandledMessages = false
		try {
			const messages =
				Array.isArray(preloadedMessages) && preloadedMessages.length > 0
					? preloadedMessages
					: (
							await this.dataEngine.execute({
								op: 'processInbox',
								actorId,
								inboxCoId: actor.inboxCoId,
							})
						).messages || []
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
					const validated = await this.validateMessage(actor, message)
					if (!validated.valid) {
						if (
							typeof window !== 'undefined' &&
							(window.location?.hostname === 'localhost' || import.meta?.env?.DEV)
						) {
							console.warn('[ActorEngine] Message validation failed (skipped):', {
								actorId: actorId?.slice(0, 24),
								messageType: message.type,
								payloadKeys: message.payload ? Object.keys(message.payload) : [],
							})
						}
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
			const shouldRetry =
				hadUnhandledMessages ||
				(await this.getUnprocessedMessages(actor.inboxCoId, actorId)
					.then((r) => (r.messages?.length ?? 0) > 0)
					.catch(() => false))
			if (shouldRetry) {
				setTimeout(() => this.processEvents(actorId), 0)
			}
		}
	}
}
