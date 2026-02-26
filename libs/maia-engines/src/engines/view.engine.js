import { validateViewDef } from '@MaiaOS/schemata'
import { containsExpressions, resolveExpressions } from '@MaiaOS/schemata/expression-resolver'
import { extractDOMValues } from '@MaiaOS/schemata/payload-resolver'
import { readStore } from '../utils/store-reader.js'
import { RENDER_STATES } from './actor.engine.js'

function sanitizeAttribute(value) {
	if (value === null || value === undefined) return ''
	return String(value)
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
		.replace(/\//g, '&#x2F;')
}

function containsDangerousHTML(str) {
	if (typeof str !== 'string') return false
	return [
		/<script/i,
		/javascript:/i,
		/on\w+\s*=/i,
		/<iframe/i,
		/<object/i,
		/<embed/i,
		/<link/i,
		/<meta/i,
		/<style/i,
	].some((pattern) => pattern.test(str))
}

const BOOLEAN_ATTRS = new Set([
	'disabled',
	'readonly',
	'checked',
	'selected',
	'autofocus',
	'required',
	'multiple',
])

function setAttr(element, name, value) {
	if (value === undefined || value === null) return
	if (BOOLEAN_ATTRS.has(name.toLowerCase())) {
		const bool = Boolean(value)
		element[name] = bool
		if (bool) element.setAttribute(name, '')
		else element.removeAttribute(name)
	} else {
		let s = typeof value === 'boolean' ? String(value) : String(value)
		if (containsDangerousHTML(s)) s = sanitizeAttribute(s)
		element.setAttribute(name, s)
	}
}

export class ViewEngine {
	constructor(evaluator, actorOps, moduleRegistry) {
		this.evaluator = evaluator
		this.actorOps = actorOps // Injected by Loader; ActorEngine implements ActorOps
		this.moduleRegistry = moduleRegistry
		this.dataEngine = null
		this.styleEngine = null
		this.actorInputCounters = new Map()
		this._scrollToBottomPrev = new Map()
		this._scrollMutationObservers = new Map()
	}

	_makeStyleRerenderSubscribe(actorId) {
		return async () => {
			const actor = this.actorOps?.getActor?.(actorId)
			if (actor && this.styleEngine) {
				try {
					actor.shadowRoot.adoptedStyleSheets = await this.styleEngine.getStyleSheets(
						actor.config,
						actor.id,
					)
					if (actor._renderState === RENDER_STATES.READY) {
						actor._renderState = RENDER_STATES.UPDATING
						this.actorOps?._scheduleRerender?.(actorId)
					}
				} catch {}
			}
		}
	}

	/**
	 * Load view-related configs (view, context, style, brand). Returns viewDef, context, subscriptions.
	 * @param {Object} actorConfig - Actor config
	 * @param {string} actorId - Actor ID
	 * @returns {Promise<{viewDef, context, contextCoId, contextSchemaCoId, configUnsubscribes}>}
	 */
	async loadViewConfigs(actorConfig, actorId) {
		if (!actorConfig.view) throw new Error(`[ViewEngine] Actor config must have 'view' property`)
		const configUnsubscribes = []

		const viewStore2 = await readStore(this.dataEngine, actorConfig.view)
		if (!viewStore2) throw new Error(`[ViewEngine] Failed to load view CoValue ${actorConfig.view}`)
		const viewDef = viewStore2.value
		validateViewDef(viewDef)
		configUnsubscribes.push(
			viewStore2.subscribe(
				(updatedView) => {
					validateViewDef(updatedView)
					const actor = this.actorOps?.getActor?.(actorId)
					if (actor) {
						actor.viewDef = updatedView
						if (actor._renderState === RENDER_STATES.READY) {
							actor._renderState = RENDER_STATES.UPDATING
							this.actorOps?._scheduleRerender?.(actorId)
						}
					}
				},
				{ skipInitial: true },
			),
		)

		let context = null,
			contextCoId = null,
			contextSchemaCoId = null
		if (actorConfig.context) {
			let contextCoIdVal = actorConfig.context
			if (typeof contextCoIdVal !== 'string') {
				throw new Error(
					`[ViewEngine] Actor config context must be string (co-id or ref), got: ${typeof contextCoIdVal}`,
				)
			}
			if (!contextCoIdVal.startsWith('co_z') && this.dataEngine?.peer) {
				const resolved = await this.dataEngine.peer.resolve(contextCoIdVal, { returnType: 'coId' })
				if (resolved && typeof resolved === 'string' && resolved.startsWith('co_z')) {
					contextCoIdVal = resolved
				}
			}
			if (!contextCoIdVal.startsWith('co_z')) {
				throw new Error(
					`[ViewEngine] Actor config context must be co-id (or resolve to co-id). Got: ${actorConfig.context}. Run with PEER_FRESH_SEED=true to re-seed.`,
				)
			}
			const contextStore = await readStore(this.dataEngine, contextCoIdVal)
			if (!contextStore) throw new Error(`[ViewEngine] Failed to load context ${contextCoIdVal}`)
			contextSchemaCoId = await this.dataEngine.peer.resolve(
				{ fromCoValue: contextCoIdVal },
				{ returnType: 'coId' },
			)
			context = contextStore
			contextCoId = contextCoIdVal
		}

		if (actorConfig.style) {
			try {
				const styleStore = await readStore(this.dataEngine, actorConfig.style)
				if (styleStore) {
					configUnsubscribes.push(
						styleStore.subscribe(this._makeStyleRerenderSubscribe(actorId), {
							skipInitial: true,
						}),
					)
				}
			} catch {}
		}
		if (actorConfig.brand) {
			try {
				const brandStore = await readStore(this.dataEngine, actorConfig.brand)
				if (brandStore) {
					configUnsubscribes.push(
						brandStore.subscribe(this._makeStyleRerenderSubscribe(actorId), {
							skipInitial: true,
						}),
					)
				}
			} catch {}
		}
		return { viewDef, context, contextCoId, contextSchemaCoId, configUnsubscribes }
	}

	/**
	 * Attach view to actor: load configs, shadowRoot, styleSheets, render.
	 * @param {Object} actor - Actor instance
	 * @param {HTMLElement} containerElement - Container element
	 * @param {Object} actorConfig - Actor config
	 * @param {string|null} agentKey - Optional agent key
	 * @param {() => Promise<void>} [onBeforeRender] - Callback before render (e.g. state init)
	 */
	async attachViewToActor(actor, containerElement, actorConfig, agentKey, onBeforeRender) {
		const actorId = actor.id
		const { viewDef, context, contextCoId, contextSchemaCoId, configUnsubscribes } =
			await this.loadViewConfigs(actorConfig, actorId)

		actor.shadowRoot = containerElement.attachShadow({ mode: 'open' })
		actor.context = context
		actor.contextCoId = contextCoId
		actor.contextSchemaCoId = contextSchemaCoId
		actor.viewDef = viewDef
		actor.agentKey = agentKey
		actor.containerElement = containerElement
		actor._renderState = RENDER_STATES.INITIALIZING
		for (const unsub of configUnsubscribes) actor._configUnsubscribes.push(unsub)

		if (actor.context?.subscribe) {
			let lastContextValue = JSON.stringify(actor.context.value || {})
			actor._contextUnsubscribe = actor.context.subscribe(
				(newValue) => {
					const currentContextValue = JSON.stringify(newValue || {})
					const contextChanged = currentContextValue !== lastContextValue
					lastContextValue = currentContextValue
					if (actor._renderState === RENDER_STATES.READY && contextChanged) {
						actor._renderState = RENDER_STATES.UPDATING
						this.actorOps?._scheduleRerender?.(actorId)
					}
				},
				{ skipInitial: true },
			)
		}

		if (onBeforeRender) await onBeforeRender()
		actor._renderState = RENDER_STATES.RENDERING
		const styleSheets = await this.styleEngine.getStyleSheets(actorConfig, actorId)
		await this.render(viewDef, actor.context, actor.shadowRoot, styleSheets, actorId)
		actor._renderState = RENDER_STATES.READY
		if (actor._needsPostInitRerender) {
			delete actor._needsPostInitRerender
			this.actorOps?._scheduleRerender?.(actorId)
		}
	}

	async render(viewDef, context, shadowRoot, styleSheets, actorId) {
		// $stores Architecture: Backend unified store handles reactivity automatically
		// No manual subscriptions needed - backend handles everything via subscriptionCache

		// Reset input counter for this actor at start of render
		// This ensures inputs get consistent IDs across re-renders (same position = same ID)
		this.actorInputCounters.set(actorId, 0)
		this._pendingScrollToBottom = []
		// Disconnect MutationObservers from previous render (element is about to be replaced)
		const prevObservers = this._scrollMutationObservers.get(actorId)
		if (prevObservers) {
			for (const { observer } of prevObservers) observer.disconnect()
			this._scrollMutationObservers.delete(actorId)
		}

		// CRITICAL: Clear shadow root on re-render (prevents duplicates)
		// This ensures that when rerender is triggered by context subscription, old DOM is cleared first
		// Combined with batching system, this prevents doubled rendering
		shadowRoot.innerHTML = ''

		// Attach stylesheets to shadow root FIRST (before rendering)
		// This ensures styles are available when elements are created
		shadowRoot.adoptedStyleSheets = styleSheets

		// Store actor ID for event handling
		this.currentActorId = actorId

		const viewNode = viewDef.content || viewDef
		// $stores Architecture: Context is ReactiveStore with merged query results from backend
		if (!context) {
			return
		}
		const contextForRender = context.value || {}
		const element = await this.renderNode(viewNode, { context: contextForRender }, actorId)

		if (element) {
			element.dataset.actorId = actorId
			shadowRoot.appendChild(element)
			this._processScrollToBottom(actorId)
		}
	}

	_processScrollToBottom(actorId) {
		if (!this._pendingScrollToBottom?.length) return
		const scrollToEl = (el) => {
			if (el.isConnected) el.scrollTop = el.scrollHeight
		}
		for (const { element, exprKey, currentLen } of this._pendingScrollToBottom) {
			const mapKey = `${actorId}:${exprKey}`
			this._scrollToBottomPrev.set(mapKey, currentLen)

			// IMMEDIATE scroll: DOM is complete; reading scrollHeight forces layout. Prevents split-second "flash at top" before paint.
			scrollToEl(element)

			// MutationObserver: scroll when children are added (new messages via incremental updates)
			const observer = new MutationObserver(() => {
				scrollToEl(element)
			})
			observer.observe(element, { childList: true, subtree: true })
			if (!this._scrollMutationObservers.has(actorId)) this._scrollMutationObservers.set(actorId, [])
			this._scrollMutationObservers.get(actorId).push({ observer, element })

			// Fallbacks for async layout (images, fonts): rAF + short setTimeout
			requestAnimationFrame(() => scrollToEl(element))
			setTimeout(() => scrollToEl(element), 50)
		}
		this._pendingScrollToBottom = []
	}

	async renderNode(node, data, actorId) {
		if (!node) return null

		const tag = node.tag || 'div'
		const element = document.createElement(tag)

		await this._applyNodeAttributes(element, node, data, actorId)

		if (node.$each) {
			element.innerHTML = ''
			const fragment = await this.renderEach(node.$each, data, actorId)
			element.appendChild(fragment)
		}

		if (node.$on) {
			this.attachEvents(element, node.$on, data, actorId)
		}

		if (node.$slot) {
			await this._renderSlot(node, data, element, actorId)
			return element
		}

		if (node.slot) {
			throw new Error('[ViewEngine] Old "slot" syntax is no longer supported. Use "$slot" instead.')
		}

		// Don't render children if $each is present (children would overwrite $each content)
		if (!node.$each) {
			await this._renderNodeChildren(element, node, data, actorId)
		}

		if (node.scrollToBottomOn && typeof node.scrollToBottomOn === 'string') {
			const exprKey = node.scrollToBottomOn.replace(/^\$/, '')
			let currentLen = 0
			try {
				const val = await this.evaluator.evaluate(node.scrollToBottomOn, data)
				currentLen = Array.isArray(val) ? val.length : val != null ? 1 : 0
			} catch (_e) {}
			this._pendingScrollToBottom.push({ element, exprKey, currentLen })
		}

		return element
	}

	async _applyNodeAttributes(element, node, data, actorId) {
		if (node.class) {
			const classValue = await this.evaluator.evaluate(node.class, data)
			if (classValue) {
				element.className = classValue
			}
		}

		if (node.attrs) {
			for (const [attrName, attrValue] of Object.entries(node.attrs)) {
				if (attrName === 'data') {
					await this._resolveDataAttributes(attrValue, data, element)
				} else {
					const resolved = await this.evaluator.evaluate(attrValue, data)
					setAttr(element, attrName, resolved)
				}
			}
		}

		if (node.value !== undefined) {
			const resolvedValue = await this.evaluator.evaluate(node.value, data)
			if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
				const newValue = resolvedValue || ''
				// CRITICAL: Don't overwrite input value if user is currently typing (element has focus)
				// This prevents race conditions where rerenders reset user input mid-typing
				const isFocused = document.activeElement === element
				if (!isFocused) {
					if (element.tagName === 'INPUT') element.value = newValue
					else element.textContent = newValue
				}
				if (!this.actorInputCounters.has(actorId)) this.actorInputCounters.set(actorId, 0)
				const inputIndex = this.actorInputCounters.get(actorId)
				this.actorInputCounters.set(actorId, inputIndex + 1)
				element.setAttribute('data-actor-input', `${actorId}_input_${inputIndex}`)
			}
		}

		if (node.text !== undefined) {
			const textValue = await this.evaluator.evaluate(node.text, data)
			// Format objects/arrays as JSON strings for display
			if (textValue && typeof textValue === 'object') {
				// Special handling for resolved actor objects (has @label and id)
				if (textValue['@label'] && textValue.id && textValue.id.startsWith('co_z')) {
					const truncatedId = `${textValue.id.substring(0, 15)}...`
					element.textContent = `${textValue['@label']} (${truncatedId})`
				} else {
					try {
						element.textContent = JSON.stringify(textValue, null, 2)
					} catch (_e) {
						element.textContent = String(textValue)
					}
				}
			} else {
				let displayText = String(textValue || '')
				// Format co-ids: truncate to first 15 characters
				if (displayText.startsWith('co_z') && displayText.length > 15) {
					displayText = `${displayText.substring(0, 15)}...`
				}
				element.textContent = displayText
			}
		}
	}

	async _renderNodeChildren(element, node, data, actorId) {
		if (node.children && Array.isArray(node.children)) {
			for (const child of node.children) {
				const childElement = await this.renderNode(child, data, actorId)
				if (childElement) {
					element.appendChild(childElement)
				}
			}
		}
	}

	async _resolveDataAttrValue(spec, data) {
		if (typeof spec === 'string' && spec.includes('.$$')) {
			const [contextKey, itemKey] = spec.split('.')
			const contextObj = await this.evaluator.evaluate(contextKey, data)
			const itemId = await this.evaluator.evaluate(itemKey, data)
			if (contextObj && typeof contextObj === 'object' && itemId) {
				return contextObj[itemId]
			}
			return undefined
		}
		return this.evaluator.evaluate(spec, data)
	}

	async _resolveDataAttributes(dataSpec, data, element) {
		const entries =
			typeof dataSpec === 'string'
				? [
						[
							dataSpec.includes('.$$')
								? dataSpec.split('.')[0].slice(1)
								: dataSpec.startsWith('$$')
									? dataSpec.slice(2)
									: dataSpec.slice(1),
							dataSpec,
						],
					]
				: Object.entries(dataSpec ?? {})

		for (const [key, spec] of entries) {
			const value = await this._resolveDataAttrValue(spec, data)
			if (value !== null && value !== undefined) {
				element.setAttribute(`data-${this._toKebabCase(key)}`, String(value))
			}
		}
	}

	_toKebabCase(str) {
		return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
	}

	async _renderSlot(node, data, wrapperElement, actorId) {
		const slotKey = node.$slot
		if (!slotKey || !slotKey.startsWith('$')) {
			return
		}
		const contextKey = slotKey.slice(1)

		const contextValue = data.context || {}
		const slotValue = contextValue[contextKey]

		if (!slotValue) {
			return
		}

		let namekey
		if (typeof slotValue === 'string' && slotValue.startsWith('@')) {
			namekey = slotValue.slice(1)
		} else {
			wrapperElement.textContent = String(slotValue)
			return
		}

		const actor = this.actorOps?.getActor?.(actorId)

		if (!actor) {
			return
		}

		let childActor = actor.children?.[namekey]

		if (!childActor) {
			childActor = await this.actorOps?._createChildActorIfNeeded?.(
				actor,
				namekey,
				actor.agentKey ?? null,
			)
			if (!childActor) return
		}

		if (childActor.containerElement) {
			// Only destroy children that were previously in THIS slot (same wrapper)
			// Keeps sibling actors in other slots (e.g. paper + messages in chat)
			if (actor?.children) {
				for (const [key, child] of Object.entries(actor.children)) {
					if (key === namekey) continue
					if (child.viewDef && child.containerElement?.parentNode === wrapperElement) {
						this.runtime?.destroyActor?.(child.id) ?? this.actorOps?.destroyActor?.(child.id)
						delete actor.children[key]
					}
				}
			}

			// Only rerender child if its state is READY (initial render complete)
			if (childActor._renderState === RENDER_STATES.READY && this.actorOps) {
				childActor._renderState = RENDER_STATES.UPDATING
				this.actorOps._scheduleRerender?.(childActor.id)
			}

			if (childActor.containerElement.parentNode !== wrapperElement) {
				if (childActor.containerElement.parentNode) {
					childActor.containerElement.parentNode.removeChild(childActor.containerElement)
				}
				wrapperElement.innerHTML = ''
				wrapperElement.appendChild(childActor.containerElement)
			}
		}
	}

	async renderEach(eachDef, data, actorId) {
		const fragment = document.createDocumentFragment()
		const items = await this.evaluator.evaluate(eachDef.items, data)

		// $stores Architecture: Progressive loading - render immediately with current data (even if empty/undefined)
		// ReactiveStore updates will trigger rerenders automatically as data loads
		if (!items || !Array.isArray(items) || items.length === 0) {
			return fragment // Return empty fragment - will update reactively when data loads
		}

		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			const itemData = {
				context: data.context,
				item,
				index: i,
			}

			const itemElement = await this.renderNode(eachDef.template, itemData, actorId)
			if (itemElement) {
				fragment.appendChild(itemElement)
			}
		}

		return fragment
	}

	attachEvents(element, events, data, actorId) {
		for (const [eventName, eventDef] of Object.entries(events)) {
			element.addEventListener(eventName, async (e) => {
				try {
					await this._handleEvent(e, eventDef, data, element, actorId)
				} catch (error) {
					if (typeof window !== 'undefined' && (import.meta?.env?.DEV ?? false)) {
						console.error('[ViewEngine] Event handler error:', eventDef?.send || eventName, error)
					}
				}
			})
		}
	}

	async _handleEvent(e, eventDef, data, element, actorId) {
		const eventName = eventDef.send
		let payload = eventDef.payload || {}

		if (e.type === 'dragover' || e.type === 'drop' || e.type === 'dragenter') {
			e.preventDefault()
			if (e.type === 'dragover') {
				e.dataTransfer.dropEffect = 'move'
			}
		}

		if (eventName === 'STOP_PROPAGATION') {
			e.stopPropagation()
			return
		}

		if (eventDef.key && e.key !== eventDef.key) {
			return
		}

		const UPDATE_INPUT_TYPES = ['UPDATE_INPUT', 'UPDATE_AGENT_INPUT']
		const isUpdateInputType = UPDATE_INPUT_TYPES.includes(eventName)

		// Prevent keydown Enter from also triggering button click (double CREATE_BUTTON, double chat sends)
		// Fixes double processing in Todos, Chat, and any input+button form
		if (e.type === 'keydown' && e.key === 'Enter' && !isUpdateInputType) {
			e.preventDefault()
			e.stopPropagation()
		}

		if (eventName === 'UPDATE_INPUT' && e.type === 'input') {
			return
		}

		// Message types that sync context from DOM - do NOT clear inputs (would overwrite user typing)
		if (this.actorOps) {
			const actor = this.actorOps.getActor?.(actorId)
			if (actor?.machine || actor?.process) {
				payload = extractDOMValues(payload, element)

				// $stores Architecture: Read CURRENT context from actor.context.value (backend unified store)
				const currentContext = actor.context.value

				const expressionData = {
					context: currentContext,
					item: data.item || {},
					result: null, // $$result not available in view events (only in state machine actions after tool execution)
				}
				payload = await resolveExpressions(payload, this.evaluator, expressionData)

				// CRITICAL: Validate payload is fully resolved before sending to inbox
				// In distributed systems, only resolved clean JS objects/JSON can be persisted to CoJSON
				if (containsExpressions(payload)) {
					throw new Error(
						`[ViewEngine] Payload contains unresolved expressions. Views must resolve all expressions before sending to inbox. Payload: ${JSON.stringify(payload).substring(0, 200)}`,
					)
				}

				// Runtime schema validation (from actor's interface) - skip send if payload invalid
				const payloadValid = await this.actorOps.validateEventPayloadForSend?.(
					actorId,
					eventName,
					payload,
				)
				if (!payloadValid) return

				// CLEAN ARCHITECTURE: For update-input types on blur, only send if DOM value differs from CURRENT context
				// This prevents repopulation after state machine explicitly clears the field
				// State machine is single source of truth - if context already matches DOM, no update needed
				if (isUpdateInputType && e.type === 'blur' && payload && typeof payload === 'object') {
					// Check if all payload fields match their corresponding CURRENT context values
					let allMatch = true
					for (const [key, value] of Object.entries(payload)) {
						const contextValue = currentContext[key]
						if (value !== contextValue) {
							allMatch = false
							break
						}
					}
					// If all values match, don't send UPDATE_INPUT (prevents repopulation after explicit clears)
					if (allMatch) {
						return // No change, don't send event
					}
				}

				await this.actorOps?.deliverEvent?.(actorId, actorId, eventName, payload)

				// AUTO-CLEAR INPUTS: After form submission (any event except update-input types), clear all input fields
				// This ensures forms reset after submission without manual clearing workarounds
				// UPDATE_INPUT, UPDATE_AGENT_INPUT etc. update context from DOM - do NOT clear (would overwrite user typing)
				if (!isUpdateInputType) {
					this._clearInputFields(element, actorId)
				}
			} else if (typeof window !== 'undefined' && (import.meta?.env?.DEV ?? false) && eventDef?.send) {
				const hasActor = !!actor
				const hasMachine = !!actor?.machine
				const hasProcess = !!actor?.process
				console.warn('[ViewEngine] Event not delivered - actor missing machine/process:', {
					event: eventDef.send,
					actorId,
					hasActor,
					hasMachine,
					hasProcess,
				})
			}
		}
	}

	/**
	 * Clear all input and textarea fields in the form containing the element
	 * If no form found, clears inputs in the actor's shadow root
	 * @param {HTMLElement} element - The element that triggered the event
	 * @param {string} actorId - The actor ID
	 * @private
	 */
	_clearInputFields(element, actorId) {
		// Find the closest form element, or fall back to actor's shadow root
		let container = element.closest('form')
		if (!container && this.actorOps) {
			const actor = this.actorOps.getActor?.(actorId)
			if (actor?.shadowRoot) {
				container = actor.shadowRoot
			}
		}

		if (!container) return

		// Clear all input and textarea fields within the container
		const inputs = container.querySelectorAll('input, textarea')
		inputs.forEach((input) => {
			// Only clear if input has data-actor-input attribute (managed by view engine)
			if (input.hasAttribute('data-actor-input')) {
				if (input.tagName === 'INPUT') {
					input.value = ''
				} else if (input.tagName === 'TEXTAREA') {
					input.value = ''
				}
			}
		})
	}

	cleanupActor(actorId) {
		const observers = this._scrollMutationObservers.get(actorId)
		if (observers) {
			for (const { observer } of observers) observer.disconnect()
			this._scrollMutationObservers.delete(actorId)
		}
		for (const k of this._scrollToBottomPrev.keys()) {
			if (k.startsWith(`${actorId}:`)) this._scrollToBottomPrev.delete(k)
		}
	}
}
