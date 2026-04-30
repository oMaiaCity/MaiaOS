import { normalizeCoValueData, ReactiveStore } from '@MaiaOS/db'
import { loadContextStore, readStore } from '@MaiaOS/db/resolve-helpers'
import { createOpsLogger } from '@MaiaOS/logs'
import { validateViewDef } from '@MaiaOS/validation'
import { containsExpressions, resolveExpressions } from '@MaiaOS/validation/expression-resolver'
import { extractDOMValuesAsync } from '@MaiaOS/validation/payload-resolver'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { perfEnginesPipeline, traceView, traceViewDeliver } from '../utils/debug.js'
import {
	BOOLEAN_ATTRS,
	SAFE_TAGS,
	sanitizePayloadForValidation,
	URL_ATTRS,
} from '../utils/security.js'
import { isContentEditableUpdateEvent, toKebabCase } from '../utils/utils.js'
import { RENDER_STATES } from './actor.engine.js'

const viewOps = createOpsLogger('ViewEngine')

function sanitizeAttributeWhitelist(value) {
	if (value === null || value === undefined) return ''
	const s = String(value)
	// biome-ignore lint/complexity/noUselessEscapeInRegex: ] must be escaped in char class to be literal
	return s.replace(/[^\p{L}\p{N}\s.,!?_:;@#()+=\[\]~&%/-]/gu, '')
}

const cobinaryPreviewCache = new Map()

function extractDataUrl(res) {
	const dataUrl = res?.dataUrl ?? res?.data?.dataUrl ?? (res?.ok === true && res?.data?.dataUrl)
	return dataUrl ?? null
}

function loadBinaryWithRetry(dataEngine, coId, maxAttempts = 4) {
	const attempt = (n) =>
		dataEngine
			.execute({ op: 'loadBinaryAsBlob', coId })
			.then((res) => extractDataUrl(res))
			.catch((err) => {
				const msg = err?.message ?? ''
				const retryable =
					msg.includes('not found') ||
					msg.includes('not available') ||
					msg.includes('still be loading') ||
					msg.includes('no binary data') ||
					msg.includes('stream not finished') ||
					err?.name === 'NotReadableError'
				if (n < maxAttempts && retryable) {
					return new Promise((r) => setTimeout(r, 400)).then(() => attempt(n + 1))
				}
				throw err
			})
	return attempt(0)
}

function hydrateCobinaryPreviews(root, dataEngine) {
	if (!root) return
	const canLoadBinary = typeof dataEngine?.execute === 'function'
	const imgs = root.querySelectorAll('img[data-co-id]')
	imgs.forEach((img) => {
		const coId = img.getAttribute('data-co-id')
		if (!coId?.startsWith('co_z')) {
			return
		}
		if (!/^co_z[a-zA-Z0-9_-]+$/.test(coId)) return
		if (!canLoadBinary) return

		const attrSrc = img.getAttribute('src')
		const hasRealPreview = attrSrc && (attrSrc.startsWith('blob:') || attrSrc.startsWith('data:'))
		if (hasRealPreview) return

		const cached = cobinaryPreviewCache.get(coId)
		if (cached?.dataUrl) {
			img.src = cached.dataUrl
			return
		}
		if (cached?.loading) {
			cached.loading.then((dataUrl) => {
				const current = root.querySelector(`img[data-co-id="${CSS.escape(coId)}"]`)
				if (current && dataUrl) current.src = dataUrl
			})
			return
		}
		const loading = loadBinaryWithRetry(dataEngine, coId)
			.then((dataUrl) => {
				cobinaryPreviewCache.set(coId, { dataUrl })
				return dataUrl
			})
			.catch(() => null)
		cobinaryPreviewCache.set(coId, { loading })
		loading.then((dataUrl) => {
			const current = root.querySelector(`img[data-co-id="${CSS.escape(coId)}"]`)
			if (current && dataUrl) current.src = dataUrl
		})
	})
}

const FORM_INPUT_EVENTS = ['FORM_SUBMIT', 'UPDATE_INPUT', 'UPDATE_AGENT_INPUT', 'UPDATE_WASM_CODE']
const POPUP_OPEN_COOLING_MS = 350

function getDefaultDebounceMs(eventName, isContentEditable) {
	if (eventName === 'FORM_SUBMIT') return 100
	if (['UPDATE_INPUT_A', 'UPDATE_INPUT_B'].includes(eventName)) return 0
	if (isContentEditable) return 250
	if (FORM_INPUT_EVENTS.includes(eventName)) return 400
	return 0
}

function shouldThrottle(eventDebounce, key, debounceMs) {
	if (typeof debounceMs !== 'number' || debounceMs <= 0) return false
	const now = Date.now()
	const last = eventDebounce.get(key)
	if (last != null && now - last < debounceMs) return true
	eventDebounce.set(key, now)
	setTimeout(() => eventDebounce.delete(key), debounceMs)
	return false
}

function scheduleDebounceSend(debounceSendTimers, key, debounceMs, fn) {
	const existing = debounceSendTimers.get(key)
	if (existing?.timeoutId) clearTimeout(existing.timeoutId)
	const timeoutId = setTimeout(async () => {
		debounceSendTimers.delete(key)
		await fn()
	}, debounceMs)
	debounceSendTimers.set(key, { timeoutId })
	return () => {
		const entry = debounceSendTimers.get(key)
		if (entry?.timeoutId) clearTimeout(entry.timeoutId)
		debounceSendTimers.delete(key)
	}
}

function cancelDebounceSend(debounceSendTimers, key) {
	const existing = debounceSendTimers.get(key)
	if (existing?.timeoutId) clearTimeout(existing.timeoutId)
	debounceSendTimers.delete(key)
}

function shouldCoolFormSubmit(lastPopupOpenTime, coolingMs = POPUP_OPEN_COOLING_MS) {
	return lastPopupOpenTime > 0 && Date.now() - lastPopupOpenTime < coolingMs
}

async function renderMarkdown(rawText) {
	if (rawText == null || typeof rawText !== 'string') return ''
	const html = await marked.parse(rawText)
	return DOMPurify.sanitize(String(html))
}

function _hasContentEditableFocusIn(shadowRoot) {
	if (!shadowRoot) return false
	const active = shadowRoot.activeElement
	if (!active) return false
	if (active.shadowRoot?.activeElement) {
		return _hasContentEditableFocusIn(active.shadowRoot)
	}
	return !!active.isContentEditable
}

const UPDATE_INPUT_TYPES = [
	'UPDATE_INPUT',
	'UPDATE_INPUT_A',
	'UPDATE_INPUT_B',
	'UPDATE_AGENT_INPUT',
	'UPDATE_WASM_CODE',
]

/**
 * Extract co-id string from a value (handles CoValue objects resolved by context map).
 * Returns the co-id string or null if not a valid co-id.
 */
function toCoIdString(value) {
	if (!value) return null
	if (typeof value === 'string' && value.startsWith('co_z')) return value
	if (typeof value === 'object') {
		const id = value.id ?? value.$id ?? value.coId
		if (typeof id === 'string' && id.startsWith('co_z')) return id
	}
	return null
}

function setAttr(element, name, value) {
	if (name === 'data-co-id') {
		const coId = value != null ? toCoIdString(value) : null
		value = coId ?? ''
		// fall through to set the attribute
	} else if (value === undefined || value === null) {
		return
	}
	if (URL_ATTRS.has(name.toLowerCase())) {
		const urlStr = String(value)
		if (/^(https?:|blob:|data:image\/|mailto:|tel:|\/|#)/.test(urlStr) || !urlStr.includes(':')) {
			element.setAttribute(name, sanitizeAttributeWhitelist(urlStr))
		}
		return
	}
	if (BOOLEAN_ATTRS.has(name.toLowerCase())) {
		const bool = Boolean(value)
		element[name] = bool
		if (bool) element.setAttribute(name, '')
		else element.removeAttribute(name)
	} else {
		const s = typeof value === 'boolean' ? String(value) : sanitizeAttributeWhitelist(value)
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
		/** Debounce: eventDef.$debounce ms (schema-driven), key -> lastFireTime */
		this._eventDebounce = new Map()
		/** Debounce-send: key -> { timeoutId, element, actorId, eventDef, data } — delayed delivery with latest DOM value */
		this._debounceSendTimers = new Map()
		/** Cooling: ignore FORM_SUBMIT for this ms after OPEN_POPUP (prevents ghost clicks when overlay appears) */
		this._lastPopupOpenTime = 0
		this._popupOpenCoolingMs = POPUP_OPEN_COOLING_MS
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
	 * Create fallback context when CoValue load fails. Empty store so actor spawns (no hard failure).
	 * @returns {ReactiveStore} Store with minimal structure
	 */
	_createFallbackContext() {
		return new ReactiveStore({})
	}

	/**
	 * Load view-related configs (view, context, style, brand). Returns viewDef, context, subscriptions.
	 * Self-healing: when context CoValue fails to load, uses fallback store so actor spawns (no hard failure).
	 * When actor already has context from spawnActor for the same co-id, reuses that store (one reactive graph).
	 * @param {Object} actor - Actor instance (from spawnActor)
	 * @param {Object} actorConfig - Actor config
	 * @param {string} actorId - Actor ID
	 * @returns {Promise<{viewDef, context, contextCoId, contextFactoryCoId, configUnsubscribes}>}
	 */
	async loadViewConfigs(actor, actorConfig, actorId) {
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
			contextFactoryCoId = null
		if (actorConfig.context) {
			if (typeof actorConfig.context !== 'string') {
				throw new Error(
					`[ViewEngine] Actor config context must be string (co-id or ref), got: ${typeof actorConfig.context}`,
				)
			}
			const reuseSpawnContext =
				actor?.contextCoId === actorConfig.context &&
				typeof actor.contextCoId === 'string' &&
				actor.contextCoId.startsWith('co_z') &&
				actor.context
			if (reuseSpawnContext) {
				context = actor.context
				contextCoId = actor.contextCoId
				contextFactoryCoId = actor.contextFactoryCoId
			} else {
				const loaded = await loadContextStore(this.dataEngine, actorConfig.context, {
					ensureLoaded: { waitForAvailable: true, timeoutMs: 5000 },
					retries: 5,
				})
				if (!loaded.store) {
					context = this._createFallbackContext()
				} else {
					context = loaded.store
					contextCoId = loaded.coId
					contextFactoryCoId = loaded.factoryCoId
				}
			}
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
		return { viewDef, context, contextCoId, contextFactoryCoId, configUnsubscribes }
	}

	/**
	 * Attach view to actor: load configs, shadowRoot, styleSheets, render.
	 * @param {Object} actor - Actor instance
	 * @param {HTMLElement} containerElement - Container element
	 * @param {Object} actorConfig - Actor config
	 * @param {string|null} vibeCoId - Optional vibe CoMap co-id (co_z...)
	 * @param {() => Promise<void>} [onBeforeRender] - Callback before render (e.g. state init)
	 */
	async attachViewToActor(actor, containerElement, actorConfig, vibeCoId, onBeforeRender) {
		const actorId = actor.id
		const { viewDef, context, contextCoId, contextFactoryCoId, configUnsubscribes } =
			await this.loadViewConfigs(actor, actorConfig, actorId)

		actor.shadowRoot = containerElement.shadowRoot
			? containerElement.shadowRoot
			: containerElement.attachShadow({ mode: 'open' })
		actor.context = context
		actor.contextCoId = contextCoId
		actor.contextFactoryCoId = contextFactoryCoId
		actor.viewDef = viewDef
		actor.vibeCoId = vibeCoId
		actor.containerElement = containerElement
		actor._renderState = RENDER_STATES.INITIALIZING
		for (const unsub of configUnsubscribes) actor._configUnsubscribes.push(unsub)

		if (actor.context?.subscribe) {
			actor._contextUnsubscribe = actor.context.subscribe(
				(_newValue) => {
					if (actor._renderState === RENDER_STATES.READY) {
						if (_hasContentEditableFocusIn(actor.shadowRoot)) return
						actor._renderState = RENDER_STATES.UPDATING
						this.actorOps?._scheduleRerender?.(actorId)
					} else {
						actor._needsPostInitRerender = true
					}
				},
				{ skipInitial: true },
			)
		}

		// Do NOT clear info-card state on mount: error should persist until DISMISS or SUCCESS.
		// Clearing here caused the error to disappear on reopen even when caps were still missing.

		if (onBeforeRender) await onBeforeRender()
		actor._renderState = RENDER_STATES.RENDERING
		const styleSheets = await this.styleEngine.getStyleSheets(actorConfig, actorId)
		await this.render(viewDef, actor.context, actor.shadowRoot, styleSheets, actorId, {
			dataEngine: this.actorOps?.dataEngine,
		})
		actor._renderState = RENDER_STATES.READY
		if (actor._needsPostInitRerender) {
			delete actor._needsPostInitRerender
			this.actorOps?._scheduleRerender?.(actorId)
		}
	}

	async render(viewDef, context, shadowRoot, styleSheets, actorId, options = {}) {
		if (_hasContentEditableFocusIn(shadowRoot)) return

		this.actorInputCounters.set(actorId, 0)
		this._pendingScrollToBottom = []
		const prevObservers = this._scrollMutationObservers.get(actorId)
		if (prevObservers) {
			for (const { observer } of prevObservers) observer.disconnect()
			this._scrollMutationObservers.delete(actorId)
		}

		shadowRoot.adoptedStyleSheets = styleSheets
		this.currentActorId = actorId

		const viewNode = viewDef.content || viewDef
		if (!context) return
		const contextForRender = context.value || {}
		const dataEngine =
			options.dataEngine ??
			this.dataEngine ??
			this.actorOps?.dataEngine ??
			this.actorOps?.os?.dataEngine

		shadowRoot.innerHTML = ''
		const element = await this.renderNode(viewNode, { context: contextForRender }, actorId)
		if (element) {
			element.dataset.actorId = actorId
			shadowRoot.appendChild(element)
			this._processScrollToBottom(actorId)
			hydrateCobinaryPreviews(shadowRoot, dataEngine)
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

		const rawTag = (node.tag || 'div').toLowerCase()
		const tag = SAFE_TAGS.has(rawTag) ? rawTag : 'div'
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

		// Markdown + contenteditable: on focus, restore raw text for editing
		const formatMd = node.format === 'md' || node.format === 'markdown'
		const isContentEditable = node.attrs?.contenteditable === true
		if (node.text !== undefined && formatMd && isContentEditable) {
			element.addEventListener('focus', () => {
				const raw = element.dataset.rawMarkdown
				if (raw !== undefined) element.textContent = raw
			})
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
				element.className = sanitizeAttributeWhitelist(classValue)
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
				// Context is single source of truth. Always apply when clear (empty) or when input loses focus.
				const isFocused = document.activeElement === element
				if (newValue === '' || !isFocused) {
					element.value = newValue
				}
				if (!this.actorInputCounters.has(actorId)) this.actorInputCounters.set(actorId, 0)
				const inputIndex = this.actorInputCounters.get(actorId)
				this.actorInputCounters.set(actorId, inputIndex + 1)
				element.setAttribute('data-actor-input', `${actorId}_input_${inputIndex}`)
			}
		}

		if (node.text !== undefined) {
			// Don't overwrite contenteditable when user is typing (avoids cursor jump)
			const isContentEditable = element.isContentEditable || node.attrs?.contenteditable === true
			const isFocused = document.activeElement === element
			if (isContentEditable && isFocused) {
				// Skip — user is typing; remote sync will apply on blur
			} else {
				let textValue = await this.evaluator.evaluate(node.text, data)
				// Colist resolution may return { id, items } - join items for display
				if (
					textValue &&
					typeof textValue === 'object' &&
					!Array.isArray(textValue) &&
					'items' in textValue
				) {
					const items = textValue.items
					textValue = Array.isArray(items) ? items.join('') : ''
				}
				const formatMd = node.format === 'md' || node.format === 'markdown'
				if (formatMd && (typeof textValue === 'string' || textValue == null)) {
					const rawText = String(textValue || '')
					element.dataset.rawMarkdown = rawText
					element.innerHTML = await renderMarkdown(rawText)
				} else if (textValue && typeof textValue === 'object') {
					// Format objects/arrays as JSON strings for display
					if (textValue.$label && textValue.id?.startsWith('co_z')) {
						const truncatedId = `${textValue.id.substring(0, 15)}...`
						element.textContent = `${textValue.$label} (${truncatedId})`
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
				element.setAttribute(`data-${toKebabCase(key)}`, sanitizeAttributeWhitelist(String(value)))
			}
		}
	}

	async _renderSlot(node, data, wrapperElement, actorId) {
		const slotKey = node.$slot
		if (!slotKey?.startsWith('$')) {
			return
		}
		const contextKey = slotKey.slice(1)

		const contextValue = data.context || {}
		const slotValue = contextValue[contextKey]

		if (!slotValue) {
			return
		}

		if (typeof slotValue !== 'string' || !slotValue.startsWith('co_z')) {
			wrapperElement.textContent = String(slotValue)
			return
		}

		const actor = this.actorOps?.getActor?.(actorId)
		if (!actor) return

		let childActor = actor.children?.[slotValue]
		if (childActor && !this.actorOps?.getActor?.(childActor.id)) {
			delete actor.children[slotValue]
			childActor = null
		}
		if (!childActor) {
			childActor = await this.actorOps?._createChildActorByCoId?.(
				actor,
				slotValue,
				actor.vibeCoId ?? null,
			)
			if (!childActor) return
		}

		if (childActor.containerElement) {
			if (actor?.children) {
				for (const [key, child] of Object.entries(actor.children)) {
					if (child === childActor) continue
					if (child.viewDef && child.containerElement?.parentNode === wrapperElement) {
						this.runtime?.destroyActor?.(child.id) ?? this.actorOps?.destroyActor?.(child.id)
						delete actor.children[key]
					}
				}
			}

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
					if (
						typeof window !== 'undefined' &&
						(window.location?.hostname === 'localhost' || import.meta?.env?.DEV)
					) {
						viewOps.error('Event handler error:', eventDef?.send || eventName, error)
					}
				}
			})
		}
		// Contenteditable: paste as plain text only (no HTML/styles from source)
		if (element.isContentEditable) {
			element.addEventListener(
				'paste',
				(e) => {
					e.preventDefault()
					const plain = (e.clipboardData?.getData?.('text/plain') ?? '').trim()
					if (!plain) return
					const doc = element.ownerDocument
					const ok = doc.execCommand?.('insertText', false, plain)
					if (!ok) {
						const sel = window.getSelection()
						if (sel?.rangeCount) {
							const range = sel.getRangeAt(0)
							range.deleteContents()
							range.insertNode(doc.createTextNode(plain))
							range.collapse(false)
							sel.removeAllRanges()
							sel.addRange(range)
						} else {
							element.textContent = (element.textContent || '') + plain
						}
					}
					element.dispatchEvent(new Event('input', { bubbles: true }))
				},
				true,
			)
		}
	}

	async _handleEvent(e, eventDef, data, element, actorId) {
		const eventName = eventDef.send

		// CRITICAL: Ignore events from elements torn down during rerender (blur/focusout fire when removed)
		// Prevents FORM_SUBMIT/UPDATE_INPUT feedback loop: rerender → clear DOM → blur → deliver → process → ctx → rerender
		if (element?.isConnected === false) return

		const isContentEditable = isContentEditableUpdateEvent(eventDef)
		const debounceMs = eventDef.$debounce ?? getDefaultDebounceMs(eventName, isContentEditable)
		const debounceKey = `${actorId}:${eventName}`

		// True debounce for contenteditable input: schedule delivery, cancel on new event, send latest when timer fires
		if (isContentEditable && e.type === 'input' && typeof debounceMs === 'number' && debounceMs > 0) {
			scheduleDebounceSend(this._debounceSendTimers, debounceKey, debounceMs, async () => {
				if (element?.isConnected === false) return
				await this._deliverEventFromDOM(actorId, element, eventDef, data, eventName, false)
			})
			return
		}

		// On blur for contenteditable: clear pending debounce so we don't double-send
		if (isContentEditable && e.type === 'blur') {
			cancelDebounceSend(this._debounceSendTimers, debounceKey)
		}

		// Throttle: block rapid re-fires (contenteditable uses true debounce above, skip throttle)
		if (!isContentEditable && shouldThrottle(this._eventDebounce, debounceKey, debounceMs)) return

		// Cooling: block spurious FORM_SUBMIT when overlay just opened (ghost clicks, touch delayed events)
		if (eventName === 'OPEN_POPUP') {
			this._lastPopupOpenTime = Date.now()
		}
		if (
			eventName === 'FORM_SUBMIT' &&
			shouldCoolFormSubmit(this._lastPopupOpenTime, this._popupOpenCoolingMs)
		) {
			return
		}

		perfEnginesPipeline.start(`view:${eventName}`)
		traceView(eventName, actorId)

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

		// Prevent default on DISMISS when from button (avoids synthetic touch-click edge cases)
		if (eventName === 'DISMISS' && element?.tagName === 'BUTTON') {
			e.preventDefault()
		}

		if (eventDef.key && e.key !== eventDef.key) {
			return
		}

		// Ignore key repeat for FORM_SUBMIT (user holding Enter fires keydown repeatedly)
		if (eventName === 'FORM_SUBMIT' && e.type === 'keydown' && e.repeat) {
			return
		}

		const isUpdateInputType = UPDATE_INPUT_TYPES.includes(eventName) || isContentEditable

		// ROOT CAUSE FIX: Skip blur's UPDATE_INPUT when focus moves to a sibling element (e.g. submit button).
		// Blur → UPDATE_INPUT → ctx → rerender replaces DOM → click targets removed button → isConnected=false → FORM_SUBMIT dropped.
		// By skipping blur when clicking within same actor, the click's FORM_SUBMIT runs against a connected element.
		if (
			isUpdateInputType &&
			e.type === 'blur' &&
			e.relatedTarget &&
			element.getRootNode?.()?.contains?.(e.relatedTarget)
		) {
			return
		}

		// Prevent keydown Enter from also triggering button click (double CREATE_BUTTON, double chat sends)
		// Fixes double processing in Todos, Chat, and any input+button form
		if (e.type === 'keydown' && e.key === 'Enter' && !isUpdateInputType) {
			e.preventDefault()
			e.stopPropagation()
		}

		// Skip input events for UPDATE_INPUT (generic single-input) — only send on blur. Prevents re-render storm.
		// UPDATE_INPUT_A/B (multi-input forms) fire on each keystroke so context stays in sync; view engine skips overwrite when focused.
		const SKIP_INPUT_EVENT_NAMES = ['UPDATE_INPUT', 'UPDATE_AGENT_INPUT']
		if (SKIP_INPUT_EVENT_NAMES.includes(eventName) && e.type === 'input') {
			return
		}

		// Message types that sync context from DOM - do NOT clear inputs (would overwrite user typing)
		if (this.actorOps) {
			const actor = this.actorOps.getActor?.(actorId)
			if (actor?.machine || actor?.process) {
				await this._deliverEventFromDOM(actorId, element, eventDef, data, eventName, e.type === 'blur')
			} else if (
				typeof window !== 'undefined' &&
				(window.location?.hostname === 'localhost' || import.meta?.env?.DEV) &&
				eventDef?.send
			) {
				const hasActor = !!actor
				const hasMachine = !!actor?.machine
				const hasProcess = !!actor?.process
				viewOps.warn('Event not delivered - actor missing machine/process:', {
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
	 * Extract DOM values, resolve expressions, validate, and deliver event. Used by normal path and debounce callback.
	 * @param {string} actorId - Actor ID
	 * @param {HTMLElement} element - Event target (for DOM value extraction)
	 * @param {Object} eventDef - Event definition (send, payload)
	 * @param {Object} data - Render data (context, item)
	 * @param {string} eventName - Event type to send
	 * @param {boolean} isBlur - When true, skip send if payload matches current context (prevents repopulation)
	 * @private
	 */
	async _deliverEventFromDOM(actorId, element, eventDef, data, eventName, isBlur) {
		const actor = this.actorOps?.getActor?.(actorId)
		if (!actor?.machine && !actor?.process) return

		let payload = await extractDOMValuesAsync(eventDef.payload || {}, element)
		const currentContext = actor.context?.value ?? {}
		const expressionData = {
			context: currentContext,
			item: data?.item || {},
			result: null,
		}
		payload = await resolveExpressions(payload, this.evaluator, expressionData)

		if (containsExpressions(payload)) {
			throw new Error(
				`[ViewEngine] Payload contains unresolved expressions. Payload: ${JSON.stringify(payload).substring(0, 200)}`,
			)
		}

		const hasBinaryPayload = payload?.file instanceof File
		let payloadToValidate = payload
		if (hasBinaryPayload && this.dataEngine) {
			const eventFactory = actor?.interfaceFactory?.properties?.[eventName]
			const blobRefKey =
				(Array.isArray(eventFactory?.required) && eventFactory.required[0]) ||
				eventFactory?.$blobRefKey ||
				'avatar'
			const result = await this.dataEngine.execute({
				op: 'uploadToCoBinary',
				file: payload.file,
				mimeType: payload.mimeType,
				onProgress: (loaded, total, phase) =>
					this.actorOps?.reportUploadProgress?.(actorId, loaded, total, phase),
			})
			const data = result?.ok === true ? result.data : result
			const coId =
				data?.coId ??
				data?.id ??
				(result?.ok === true && typeof result.data === 'object' && result.data !== null
					? (result.data.coId ?? result.data.id)
					: undefined)
			if (!coId || typeof coId !== 'string') {
				viewOps.warn('Upload completed but no co-id returned:', { result, data })
				return
			}
			payloadToValidate = { [blobRefKey]: coId, mimeType: data?.mimeType ?? payload?.mimeType }
		} else if (payloadToValidate && typeof payloadToValidate === 'object') {
			payloadToValidate = normalizeCoValueData(payloadToValidate)
			payloadToValidate = sanitizePayloadForValidation(payloadToValidate)
			if (
				payloadToValidate &&
				(['FORM_SUBMIT', 'UPDATE_INPUT', 'UPDATE_WASM_CODE'].includes(eventName) ||
					isContentEditableUpdateEvent(eventDef)) &&
				actor?.interfaceFactory?.properties?.[eventName]?.properties?.value?.type === 'string'
			) {
				const v = payloadToValidate.value
				if (v === undefined || v === null || typeof v !== 'string') {
					payloadToValidate = { ...payloadToValidate, value: v == null ? '' : String(v) }
				}
			}
		}

		const validation = (await this.actorOps.validateEventPayloadForSendWithDetails?.(
			actorId,
			eventName,
			payloadToValidate,
		)) ?? { valid: true, errors: null }
		if (!validation.valid) {
			if (
				typeof window !== 'undefined' &&
				(window.location?.hostname === 'localhost' || import.meta?.env?.DEV)
			) {
				viewOps.warn('Payload validation failed - event not delivered:', {
					event: eventName,
					actorId: actorId?.slice(0, 24),
					errors: validation.errors,
				})
			}
			return
		}

		const isUpdateInputType =
			UPDATE_INPUT_TYPES.includes(eventName) || isContentEditableUpdateEvent(eventDef)

		if (isUpdateInputType && isBlur && payload && typeof payload === 'object') {
			let allMatch = true
			for (const [key, value] of Object.entries(payload)) {
				const contextValue = currentContext[key]
				if (value !== contextValue) {
					allMatch = false
					break
				}
			}
			if (allMatch) return
		}

		perfEnginesPipeline.step('view:deliver', { event: eventName })
		traceViewDeliver({ actorId, eventName })
		await this.actorOps?.deliverEvent?.(actorId, actorId, eventName, payloadToValidate)

		if (!isUpdateInputType) {
			await this._clearInputFields(element, actorId)
		}
	}

	/**
	 * Walk viewDef tree and return context keys bound to input/textarea elements.
	 * Keys are extracted from node.value like "$inputValue" -> "inputValue".
	 * @param {Object} viewDef - View definition (content or root)
	 * @returns {string[]} Context keys bound to inputs
	 * @private
	 */
	_getInputContextKeys(viewDef) {
		const keys = new Set()
		const root = viewDef?.content ?? viewDef
		if (!root) return []

		function walk(node) {
			if (!node || typeof node !== 'object') return
			const tag = (node.tag ?? '').toLowerCase()
			if ((tag === 'input' || tag === 'textarea') && node.value !== undefined) {
				const v = node.value
				if (typeof v === 'string' && v.startsWith('$') && !v.startsWith('$$')) {
					keys.add(v.slice(1))
				}
			}
			for (const child of node.children ?? []) walk(child)
		}
		walk(root)
		return [...keys]
	}

	/**
	 * Clear all input and textarea fields in the form containing the element
	 * If no form found, clears inputs in the actor's shadow root.
	 * Also clears bound context keys via updateContextCoValue (CoJSON single source of truth).
	 * @param {HTMLElement} element - The element that triggered the event
	 * @param {string} actorId - The actor ID
	 * @private
	 */
	async _clearInputFields(element, actorId) {
		let container = element.closest('form') || element.closest('.form')
		const actor = this.actorOps?.getActor?.(actorId)
		if (!container && actor?.shadowRoot) container = actor.shadowRoot
		if (!container) return
		for (const input of container.querySelectorAll('input, textarea')) {
			input.value = ''
		}
		// Clear bound context keys via CoJSON (single source of truth)
		if (actor?.viewDef && this.actorOps?.updateContextCoValue) {
			const keys = this._getInputContextKeys(actor.viewDef)
			if (keys.length) {
				const updates = Object.fromEntries(keys.map((k) => [k, '']))
				await this.actorOps.updateContextCoValue(actor, updates)
			}
		}
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
		for (const k of this._debounceSendTimers.keys()) {
			if (k.startsWith(`${actorId}:`)) {
				const entry = this._debounceSendTimers.get(k)
				if (entry?.timeoutId) clearTimeout(entry.timeoutId)
				this._debounceSendTimers.delete(k)
			}
		}
	}
}
