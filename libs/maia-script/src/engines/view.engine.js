import { resolveReactive, waitForReactiveResolution } from '@MaiaOS/db'
import { containsExpressions, resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js'
import { extractDOMValues } from '@MaiaOS/schemata/payload-resolver.js'
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

export class ViewEngine {
	constructor(evaluator, actorEngine, moduleRegistry) {
		this.evaluator = evaluator
		this.actorEngine = actorEngine
		this.moduleRegistry = moduleRegistry
		this.dbEngine = null
		this.actorInputCounters = new Map()
	}

	async loadView(coId) {
		// UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema extraction
		const viewSchemaStore = resolveReactive(
			this.dbEngine.backend,
			{ fromCoValue: coId },
			{ returnType: 'coId' },
		)
		const viewSchemaState = await waitForReactiveResolution(viewSchemaStore, { timeoutMs: 10000 })
		const viewSchemaCoId = viewSchemaState.schemaCoId

		if (!viewSchemaCoId) {
			throw new Error(
				`[ViewEngine] Failed to extract schema co-id from view CoValue ${coId}: ${viewSchemaState.error || 'Schema not found'}`,
			)
		}

		const _viewStore = await this.dbEngine.execute({
			op: 'read',
			schema: null,
			key: coId,
		})

		const store = await this.dbEngine.execute({
			op: 'read',
			schema: viewSchemaCoId,
			key: coId,
		})

		return store
	}

	async render(viewDef, context, shadowRoot, styleSheets, actorId) {
		// $stores Architecture: Backend unified store handles reactivity automatically
		// No manual subscriptions needed - backend handles everything via subscriptionCache

		// Reset input counter for this actor at start of render
		// This ensures inputs get consistent IDs across re-renders (same position = same ID)
		this.actorInputCounters.set(actorId, 0)

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
			// Container-type and container-name are set via CSS in component definition
			// Only set dataset for identification
			element.dataset.actorId = actorId
			shadowRoot.appendChild(element)
		} else {
		}
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

		return element
	}

	async _applyNodeAttributes(element, node, data, actorId) {
		if (node.class) {
			// CRITICAL: Reject all conditional logic in class property
			if (typeof node.class === 'object' && this._isDSLOperation(node.class)) {
				const opName = Object.keys(node.class)[0]
				throw new Error(
					`[ViewEngine] Conditional logic (${opName}) is not allowed in class property. Use state machines to compute boolean flags and reference them via context, then use data-attributes and CSS.`,
				)
			}
			// Reject ternary operators
			if (typeof node.class === 'string' && node.class.includes('?') && node.class.includes(':')) {
				throw new Error(
					'[ViewEngine] Ternary operators are not allowed in class property. Use state machines to compute values and reference them via context.',
				)
			}
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
					// CRITICAL: Reject conditional logic in regular attributes
					if (typeof attrValue === 'object' && this._isDSLOperation(attrValue)) {
						const opName = Object.keys(attrValue)[0]
						throw new Error(
							`[ViewEngine] Conditional logic (${opName}) is not allowed in attributes. Use state machines to compute values and reference them via context.`,
						)
					}
					// Reject ternary operators
					if (typeof attrValue === 'string' && attrValue.includes('?') && attrValue.includes(':')) {
						throw new Error(
							'[ViewEngine] Ternary operators are not allowed in attributes. Use state machines to compute values and reference them via context.',
						)
					}
					const resolvedValue = await this.evaluator.evaluate(attrValue, data)
					if (resolvedValue !== undefined && resolvedValue !== null) {
						// CRITICAL: Handle boolean attributes (disabled, readonly, checked, etc.) as properties, not attributes
						// setAttribute('disabled', 'false') still sets the attribute (makes it disabled)
						// We need to use the property instead: element.disabled = false
						const booleanAttributes = [
							'disabled',
							'readonly',
							'checked',
							'selected',
							'autofocus',
							'required',
							'multiple',
						]
						if (booleanAttributes.includes(attrName.toLowerCase())) {
							const boolValue = Boolean(resolvedValue)
							element[attrName] = boolValue
							// Also set/remove attribute for proper HTML representation
							if (boolValue) {
								element.setAttribute(attrName, '')
							} else {
								element.removeAttribute(attrName)
							}
						} else {
							let stringValue =
								typeof resolvedValue === 'boolean' ? String(resolvedValue) : String(resolvedValue)
							if (containsDangerousHTML(stringValue)) {
								stringValue = sanitizeAttribute(stringValue)
							}
							element.setAttribute(attrName, stringValue)
						}
					}
				}
			}
		}

		if (node.value !== undefined) {
			// CRITICAL: Reject conditional logic in value property
			if (typeof node.value === 'object' && this._isDSLOperation(node.value)) {
				const opName = Object.keys(node.value)[0]
				throw new Error(
					`[ViewEngine] Conditional logic (${opName}) is not allowed in value property. Use state machines to compute values and reference them via context.`,
				)
			}
			// Reject ternary operators
			if (typeof node.value === 'string' && node.value.includes('?') && node.value.includes(':')) {
				throw new Error(
					'[ViewEngine] Ternary operators are not allowed in value property. Use state machines to compute values and reference them via context.',
				)
			}
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
			// CRITICAL: Reject conditional logic in text property
			if (typeof node.text === 'object' && this._isDSLOperation(node.text)) {
				const opName = Object.keys(node.text)[0]
				throw new Error(
					`[ViewEngine] Conditional logic (${opName}) is not allowed in text property. Use state machines to compute values and reference them via context.`,
				)
			}
			// Reject ternary operators
			if (typeof node.text === 'string' && node.text.includes('?') && node.text.includes(':')) {
				throw new Error(
					'[ViewEngine] Ternary operators are not allowed in text property. Use state machines to compute values and reference them via context.',
				)
			}
			const textValue = await this.evaluator.evaluate(node.text, data)
			// Format objects/arrays as JSON strings for display
			if (textValue && typeof textValue === 'object') {
				// Special handling for resolved actor objects (has role and id)
				if (textValue.role && textValue.id && textValue.id.startsWith('co_z')) {
					const truncatedId = `${textValue.id.substring(0, 15)}...`
					element.textContent = `${textValue.role} (${truncatedId})`
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
				// CRITICAL: Reject all conditional logic in children
				if (child && typeof child === 'object' && this._isDSLOperation(child)) {
					const opName = Object.keys(child)[0]
					throw new Error(
						`[ViewEngine] Conditional logic (${opName}) is not allowed in view templates. Use state machines to compute boolean flags and reference them via context, then use data-attributes and CSS.`,
					)
				}
				const childElement = await this.renderNode(child, data, actorId)
				if (childElement) {
					element.appendChild(childElement)
				}
			}
		}
	}

	async _resolveDataAttributes(dataSpec, data, element) {
		if (typeof dataSpec === 'string') {
			// CRITICAL: Views are dumb templates - only allow simple context/item references
			// Reject conditional logic (expressions starting with $ that aren't simple references)
			if (this._containsConditionalLogic(dataSpec)) {
				throw new Error(
					`[ViewEngine] Conditional logic is not allowed in data attributes. Use state machines to compute boolean flags and reference them via context. Found: ${dataSpec}`,
				)
			}

			if (dataSpec.includes('.$$')) {
				const [contextKey, itemKey] = dataSpec.split('.')
				const contextObj = await this.evaluator.evaluate(contextKey, data)
				const itemId = await this.evaluator.evaluate(itemKey, data)

				if (contextObj && typeof contextObj === 'object' && itemId) {
					const value = contextObj[itemId]
					if (value !== null && value !== undefined) {
						const key = contextKey.substring(1)
						const attrName = `data-${this._toKebabCase(key)}`
						element.setAttribute(attrName, String(value))
					}
				}
			} else {
				const value = await this.evaluator.evaluate(dataSpec, data)
				if (value !== null && value !== undefined) {
					const key = dataSpec.startsWith('$$') ? dataSpec.substring(2) : dataSpec.substring(1)
					const attrName = `data-${this._toKebabCase(key)}`
					element.setAttribute(attrName, String(value))
				}
			}
		} else if (typeof dataSpec === 'object' && dataSpec !== null) {
			for (const [key, valueSpec] of Object.entries(dataSpec)) {
				// CRITICAL: Reject conditional logic in data attributes
				// $eq, $if, ternary operators, etc. are not allowed - state machines must compute flags
				if (typeof valueSpec === 'object' && valueSpec !== null) {
					if (this._isDSLOperation(valueSpec)) {
						throw new Error(
							`[ViewEngine] Conditional logic (${Object.keys(valueSpec)[0]}) is not allowed in data attributes. Use state machines to compute boolean flags and reference them via context.`,
						)
					}
				}

				// Reject ternary operators in strings
				if (typeof valueSpec === 'string' && valueSpec.includes('?') && valueSpec.includes(':')) {
					throw new Error(
						`[ViewEngine] Ternary operators are not allowed in views. Use state machines to compute values and reference them via context.`,
					)
				}

				let value

				if (typeof valueSpec === 'string' && valueSpec.includes('.$$')) {
					const [contextKey, itemKey] = valueSpec.split('.')
					const contextObj = await this.evaluator.evaluate(contextKey, data)
					const itemId = await this.evaluator.evaluate(itemKey, data)

					if (contextObj && typeof contextObj === 'object' && itemId) {
						value = contextObj[itemId]
					}
				} else {
					// Only evaluate simple context/item references - no DSL operations
					value = await this.evaluator.evaluate(valueSpec, data)
				}

				if (value !== null && value !== undefined) {
					const attrName = `data-${this._toKebabCase(key)}`
					element.setAttribute(attrName, String(value))
				}
			}
		}
	}

	/**
	 * Check if a value contains conditional logic (DSL operations or ternary operators)
	 * Views should only contain simple context/item references
	 */
	_containsConditionalLogic(value) {
		if (typeof value !== 'string') return false
		// Check for ternary operators
		if (value.includes('?') && value.includes(':')) return true
		// Check for DSL operation patterns (but allow simple $key and $$key references)
		// Simple references: $key, $$key, $context.key, $$item.key
		// Conditional logic: $if, $eq, $and, etc. (but these would be objects, not strings)
		return false // String values are simple references, objects are checked separately
	}

	/**
	 * Check if a value is a DSL operation (conditional logic)
	 */
	_isDSLOperation(value) {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return false
		const keys = Object.keys(value)
		if (keys.length === 0) return false
		// DSL operations have keys starting with $ (except simple $context, $item which are data access)
		const firstKey = keys[0]
		if (!firstKey.startsWith('$')) return false
		// Simple data access operations are allowed (but shouldn't appear in views anyway)
		// Conditional logic operations: $if, $eq, $ne, $and, $or, $not, $switch, etc.
		const conditionalOps = [
			'$if',
			'$eq',
			'$ne',
			'$and',
			'$or',
			'$not',
			'$switch',
			'$gt',
			'$lt',
			'$gte',
			'$lte',
		]
		return conditionalOps.includes(firstKey)
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

		// $stores Architecture: Context is ReactiveStore with merged query results from backend
		// data.context is already the resolved value (plain object), not a ReactiveStore
		const contextValue = data.context || {}
		const slotValue = contextValue[contextKey]

		if (!slotValue) {
			return
		}

		let namekey
		if (typeof slotValue === 'string' && slotValue.startsWith('@')) {
			namekey = slotValue.slice(1)

			// CLEAN ARCHITECTURE: Context is always ReactiveStore
			const actorsMap = contextValue['@actors']
			if (actorsMap && !actorsMap[namekey]) {
			}
		} else {
			wrapperElement.textContent = String(contextValue)
			return
		}

		const actor = this.actorEngine?.getActor(actorId)

		if (!actor) {
			return
		}

		let childActor = actor.children?.[namekey]

		if (!childActor) {
			const vibeKey = actor.vibeKey || null
			childActor = await this.actorEngine._createChildActorIfNeeded(actor, namekey, vibeKey)

			if (!childActor) {
				// Only warn if actor is READY (initial render complete)
				if (actor._renderState === RENDER_STATES.READY) {
				}
				return
			}
		}

		if (childActor.containerElement) {
			if (actor?.children) {
				for (const [key, child] of Object.entries(actor.children)) {
					if (key === namekey) continue
					if (child.actorType === 'ui') {
						this.actorEngine.destroyActor(child.id)
						delete actor.children[key]
					}
				}
			}

			// Only rerender child if its state is READY (initial render complete)
			if (childActor._renderState === RENDER_STATES.READY && this.actorEngine) {
				childActor._renderState = RENDER_STATES.UPDATING
				this.actorEngine._scheduleRerender(childActor.id)
			}

			if (childActor.containerElement.parentNode !== wrapperElement) {
				if (childActor.containerElement.parentNode) {
					childActor.containerElement.parentNode.removeChild(childActor.containerElement)
				}
				wrapperElement.innerHTML = ''
				wrapperElement.appendChild(childActor.containerElement)
			}
		} else {
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
				item: item,
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
				} catch (_error) {}
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

		// Prevent keydown Enter from also triggering button click (double CREATE_BUTTON, double chat sends)
		// Fixes double processing in Todos, Chat, and any input+button form
		const isUpdateInputType = eventName === 'UPDATE_INPUT' || eventName === 'UPDATE_AGENT_INPUT'
		if (e.type === 'keydown' && e.key === 'Enter' && !isUpdateInputType) {
			e.preventDefault()
		}

		if (eventName === 'UPDATE_INPUT' && e.type === 'input') {
			return
		}

		// Message types that sync context from DOM - do NOT clear inputs (would overwrite user typing)
		if (this.actorEngine) {
			const actor = this.actorEngine.getActor(actorId)
			if (actor?.machine) {
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

				// Guard: REMOVE_MEMBER requires memberId - skip send when missing (prevents operation failure)
				if (
					eventName === 'REMOVE_MEMBER' &&
					(!payload?.memberId || typeof payload.memberId !== 'string')
				) {
					console.warn(
						'[ViewEngine] REMOVE_MEMBER skipped: memberId required but missing from resolved payload',
						{
							payload,
							item: data.item,
						},
					)
					return
				}

				// Guard: ADD_AGENT requires agentId - skip send when empty (prevents operation failure)
				if (
					eventName === 'ADD_AGENT' &&
					(!payload?.agentId || typeof payload.agentId !== 'string' || !payload.agentId.trim())
				) {
					return
				}

				// Guard: CREATE_BUTTON requires value - skip send when empty (prevents stuck in creating, matches ADD_AGENT pattern)
				if (
					eventName === 'CREATE_BUTTON' &&
					(!payload?.value || typeof payload.value !== 'string' || !payload.value.trim())
				) {
					return
				}

				// Guard: SEND_MESSAGE requires inputText - skip send when empty (prevents stuck in chatting, matches CREATE_BUTTON pattern)
				if (
					eventName === 'SEND_MESSAGE' &&
					(!payload?.inputText || typeof payload.inputText !== 'string' || !payload.inputText.trim())
				) {
					return
				}

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

				await this.actorEngine.sendInternalEvent(actorId, eventName, payload)

				// AUTO-CLEAR INPUTS: After form submission (any event except update-input types), clear all input fields
				// This ensures forms reset after submission without manual clearing workarounds
				// UPDATE_INPUT, UPDATE_AGENT_INPUT etc. update context from DOM - do NOT clear (would overwrite user typing)
				if (!isUpdateInputType) {
					this._clearInputFields(element, actorId)
				}
			} else {
			}
		} else {
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
		if (!container && this.actorEngine) {
			const actor = this.actorEngine.getActor(actorId)
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

	setActorEngine(actorEngine) {
		this.actorEngine = actorEngine
	}

	cleanupActor(_actorId) {
		// $stores Architecture: Backend handles all subscription cleanup automatically via subscriptionCache
		// No manual cleanup needed
	}
}
