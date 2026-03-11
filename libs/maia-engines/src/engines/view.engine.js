import { ensureCoValueLoaded, normalizeCoValueData, ReactiveStore } from '@MaiaOS/db'
import { validateViewDef } from '@MaiaOS/schemata'
import { containsExpressions, resolveExpressions } from '@MaiaOS/schemata/expression-resolver'
import { extractDOMValuesAsync } from '@MaiaOS/schemata/payload-resolver'
import { sanitizePayloadForValidation } from '../utils/payload-sanitizer.js'
import { perfPipelineStart, perfPipelineStep } from '../utils/perf-pipeline.js'
import { readStore } from '../utils/store-reader.js'
import { traceView } from '../utils/trace.js'
import { RENDER_STATES } from './actor.engine.js'

const DEBUG_COBINARY =
	typeof window !== 'undefined' &&
	(window.location?.hostname === 'localhost' || import.meta?.env?.DEV) &&
	false // Set true to debug CoBinary hydration

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

/** Cache for CoBinary image data URLs - shared across actor views, enables progressive reactive preview */
const cobinaryPreviewCache = new Map()

/**
 * Hydrate cobinary image previews within a root (shadow DOM or element).
 * Finds img[data-co-id], loads binary via loadBinaryAsBlob, sets img.src.
 * Skips imgs that already have a valid data: URL in src.
 */
/** 1x1 transparent GIF - placeholder when no co-id or load fails (avoids broken-image icon) */
const COBINARY_PLACEHOLDER =
	'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function extractDataUrl(res) {
	const dataUrl = res?.dataUrl ?? res?.data?.dataUrl ?? (res?.ok === true && res?.data?.dataUrl)
	if (DEBUG_COBINARY && res && !dataUrl) {
		console.warn('[CoBinary] extractDataUrl: no dataUrl in response', {
			keys: Object.keys(res || {}),
			hasData: !!res?.data,
			dataKeys: res?.data ? Object.keys(res.data) : [],
		})
	}
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
	if (DEBUG_COBINARY)
		console.log('[CoBinary] hydrateCobinaryPreviews', {
			hasRoot: !!root,
			rootTag: root?.tagName,
			rootInShadow: !!root?.host,
			hasDataEngine: !!dataEngine?.execute,
		})
	if (!root || !dataEngine?.execute) return
	const imgs = root.querySelectorAll('img[data-co-id]')
	const allImgs = root.querySelectorAll('img')
	if (DEBUG_COBINARY)
		console.log('[CoBinary] hydrateCobinaryPreviews', {
			foundWithAttr: imgs.length,
			totalImgs: allImgs.length,
			imgAttrs: Array.from(allImgs).map((img) => ({
				hasDataCoId: img.hasAttribute('data-co-id'),
				dataCoId: img.getAttribute('data-co-id'),
			})),
		})
	imgs.forEach((img) => {
		const coId = img.getAttribute('data-co-id')
		if (!coId || !coId.startsWith('co_z')) {
			if (DEBUG_COBINARY) console.log('[CoBinary] hydrateCobinaryPreviews skip invalid coId', { coId })
			if (!img.src) img.src = COBINARY_PLACEHOLDER
			return
		}
		// Skip if already has valid src (data: or blob:)
		if (img.src && (img.src.startsWith('data:') || img.src.startsWith('blob:'))) {
			if (DEBUG_COBINARY) console.log('[CoBinary] hydrateCobinaryPreviews skip (has src)', { coId })
			return
		}
		const cached = cobinaryPreviewCache.get(coId)
		if (cached?.dataUrl) {
			img.src = cached.dataUrl
			if (DEBUG_COBINARY) console.log('[CoBinary] hydrateCobinaryPreviews from cache', { coId })
			return
		}
		if (cached?.loading) {
			cached.loading.then((dataUrl) => {
				const current = root.querySelector(`img[data-co-id="${coId}"]`)
				if (current) current.src = dataUrl || COBINARY_PLACEHOLDER
			})
			if (DEBUG_COBINARY)
				console.log('[CoBinary] hydrateCobinaryPreviews waiting for loading', { coId })
			return
		}
		if (DEBUG_COBINARY)
			console.log('[CoBinary] hydrateCobinaryPreviews loadBinaryAsBlob start', { coId })
		const loading = loadBinaryWithRetry(dataEngine, coId)
			.then((dataUrl) => {
				cobinaryPreviewCache.set(coId, { dataUrl })
				if (DEBUG_COBINARY)
					console.log('[CoBinary] hydrateCobinaryPreviews loadBinaryAsBlob done', {
						coId,
						hasDataUrl: !!dataUrl,
						len: dataUrl?.length,
					})
				return dataUrl
			})
			.catch((err) => {
				if (DEBUG_COBINARY)
					console.warn('[CoBinary] hydrateCobinaryPreviews loadBinaryAsBlob failed', {
						coId,
						err: err?.message,
					})
				return null
			})
		cobinaryPreviewCache.set(coId, { loading })
		loading.then((dataUrl) => {
			const current = root.querySelector(`img[data-co-id="${coId}"]`)
			if (current) current.src = dataUrl || COBINARY_PLACEHOLDER
		})
	})
}

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
	// data-co-id: ALWAYS set (use "" when undefined/null) so img[data-co-id] matches for hydration
	if (name === 'data-co-id') {
		const coId = value != null ? toCoIdString(value) : null
		if (DEBUG_COBINARY)
			console.log('[CoBinary] setAttr data-co-id', {
				rawType: typeof value,
				rawPreview:
					value == null
						? '(null/undefined)'
						: typeof value === 'string'
							? value.slice(0, 30) + (value.length > 30 ? '...' : '')
							: value && typeof value === 'object'
								? `{id:${value?.id ?? '?'},...}`
								: String(value),
				coId: coId ?? '(empty)',
			})
		value = coId ?? ''
		// fall through to set the attribute
	} else if (value === undefined || value === null) {
		return
	}
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
		/** Track last-rendered profile.avatar coId per actor for reactive re-hydration on avatar change */
		this._lastAvatarCoIdPerActor = new Map()
		/** Debounce: eventDef.$debounce ms (schema-driven), key -> lastFireTime */
		this._eventDebounce = new Map()
		/** Cooling: ignore FORM_SUBMIT for this ms after OPEN_POPUP (prevents ghost clicks when overlay appears) */
		this._lastPopupOpenTime = 0
		this._popupOpenCoolingMs = 350
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
	 * Create fallback context when CoValue load fails. Universal: no hardcoded actor types.
	 * Merges parent's @actors so child refs (e.g. $targetActor) resolve. Derives targetActor from
	 * sibling slot when namekey indicates input-like child (tell target needs resolution).
	 * @param {Object|null} parentActor - Parent actor (when child), for @actors propagation
	 * @param {string|null} namekey - Child slot name when spawned from parent (e.g. 'input' => targetActor from @actors.messages)
	 * @returns {ReactiveStore} Store with minimal structure
	 */
	_createFallbackContext(parentActor = null, namekey = null) {
		const base = {}
		const parentValue = parentActor?.context?.value
		if (parentValue?.['@actors'] && typeof parentValue?.['@actors'] === 'object') {
			base['@actors'] = { ...parentValue['@actors'] }
			// When input child: targetActor = @actors.messages (layout-chat convention)
			if (namekey === 'input' && base['@actors'].messages) {
				base.targetActor = base['@actors'].messages
			}
			// When messages child: targetInput = @actors.input (layout-chat convention)
			if (namekey === 'messages' && base['@actors'].input) {
				base.targetInput = base['@actors'].input
			}
		}
		return new ReactiveStore(base)
	}

	/**
	 * Load view-related configs (view, context, style, brand). Returns viewDef, context, subscriptions.
	 * Self-healing: when context CoValue fails to load, uses fallback store so actor spawns (no hard failure).
	 * @param {Object} actorConfig - Actor config
	 * @param {string} actorId - Actor ID
	 * @param {Object|null} parentActor - Parent actor when spawning child (for fallback @actors)
	 * @param {string|null} namekey - Child slot name when spawned (e.g. 'input' for targetActor)
	 * @returns {Promise<{viewDef, context, contextCoId, contextSchemaCoId, configUnsubscribes}>}
	 */
	async loadViewConfigs(actorConfig, actorId, parentActor = null, namekey = null) {
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
			// Ensure context CoValue is loaded (e.g. after capability extend, may be in IndexedDB but not node memory)
			try {
				await ensureCoValueLoaded(this.dataEngine.peer, contextCoIdVal, {
					waitForAvailable: true,
					timeoutMs: 5000,
				})
			} catch (_e) {
				// Fall through - readStore may still work if CoValue became available
			}
			let contextStore = await readStore(this.dataEngine, contextCoIdVal)
			// Retry: context may be loading from sync
			for (let i = 0; !contextStore && i < 5; i++) {
				await new Promise((r) => setTimeout(r, 150 + i * 100))
				contextStore = await readStore(this.dataEngine, contextCoIdVal)
			}
			if (!contextStore) {
				// Self-healing: use fallback so actor spawns. No persistence (contextCoId stays null).
				context = this._createFallbackContext(parentActor, namekey)
				contextCoId = null
				contextSchemaCoId = null
			} else {
				contextSchemaCoId = await this.dataEngine.peer.resolve(
					{ fromCoValue: contextCoIdVal },
					{ returnType: 'coId' },
				)
				context = contextStore
				contextCoId = contextCoIdVal
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
		return { viewDef, context, contextCoId, contextSchemaCoId, configUnsubscribes }
	}

	/**
	 * Attach view to actor: load configs, shadowRoot, styleSheets, render.
	 * @param {Object} actor - Actor instance
	 * @param {HTMLElement} containerElement - Container element
	 * @param {Object} actorConfig - Actor config
	 * @param {string|null} avenKey - Optional aven key
	 * @param {() => Promise<void>} [onBeforeRender] - Callback before render (e.g. state init)
	 */
	async attachViewToActor(
		actor,
		containerElement,
		actorConfig,
		avenKey,
		onBeforeRender,
		parentActor = null,
		namekey = null,
	) {
		const actorId = actor.id
		const { viewDef, context, contextCoId, contextSchemaCoId, configUnsubscribes } =
			await this.loadViewConfigs(actorConfig, actorId, parentActor, namekey)

		actor.shadowRoot = containerElement.attachShadow({ mode: 'open' })
		actor.context = context
		actor.contextCoId = contextCoId
		actor.contextSchemaCoId = contextSchemaCoId
		actor.viewDef = viewDef
		actor.avenKey = avenKey
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
			// Use explicitly passed dataEngine (from ActorEngine) - same peer as maia.do() in db-view
			const dataEngine =
				options.dataEngine ??
				this.dataEngine ??
				this.actorOps?.dataEngine ??
				this.actorOps?.os?.dataEngine
			if (DEBUG_COBINARY)
				console.log('[CoBinary] render calling hydrateCobinaryPreviews', {
					actorId,
					hasDataEngine: !!dataEngine,
					source: options.dataEngine
						? 'options'
						: this.dataEngine
							? 'this'
							: this.actorOps?.dataEngine
								? 'actorOps'
								: this.actorOps?.os?.dataEngine
									? 'actorOps.os'
									: 'none',
				})
			hydrateCobinaryPreviews(shadowRoot, dataEngine)
			// Staggered re-hydration: CoBinary finished state may lag; multiple passes ensure display
			for (const delay of [200, 500, 1200, 2500, 4000]) {
				setTimeout(() => hydrateCobinaryPreviews(shadowRoot, dataEngine), delay)
			}
			// Reactive re-hydration on avatar change: when profile.avatar coId changes, extra passes at 100ms and 600ms
			const avatarCoId =
				typeof contextForRender?.profile?.avatar === 'string' &&
				contextForRender.profile.avatar.startsWith('co_z')
					? contextForRender.profile.avatar
					: null
			const prevAvatar = this._lastAvatarCoIdPerActor.get(actorId)
			if (avatarCoId && avatarCoId !== prevAvatar && dataEngine) {
				this._lastAvatarCoIdPerActor.set(actorId, avatarCoId)
				for (const delay of [50, 150, 400, 800]) {
					setTimeout(() => hydrateCobinaryPreviews(shadowRoot, dataEngine), delay)
				}
			}
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
		if (DEBUG_COBINARY && tag.toLowerCase() === 'img' && node.attrs?.['data-co-id'])
			console.log('[CoBinary] renderNode img with data-co-id', {
				attrExpr: node.attrs['data-co-id'],
			})
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
					if (DEBUG_COBINARY && attrName === 'data-co-id')
						console.log('[CoBinary] _applyNodeAttributes data-co-id', {
							tag: element?.tagName,
							attrValue: typeof attrValue === 'string' ? attrValue.slice(0, 25) : attrValue,
							resolvedType: typeof resolved,
							resolvedPreview:
								resolved == null
									? '(null/undefined)'
									: typeof resolved === 'string'
										? resolved.slice(0, 30)
										: resolved && typeof resolved === 'object'
											? `{id:${resolved?.id ?? '?'}}`
											: String(resolved),
						})
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
				actor.avenKey ?? null,
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
					if (
						typeof window !== 'undefined' &&
						(window.location?.hostname === 'localhost' || import.meta?.env?.DEV)
					) {
						console.error('[ViewEngine] Event handler error:', eventDef?.send || eventName, error)
					}
				}
			})
		}
	}

	async _handleEvent(e, eventDef, data, element, actorId) {
		const eventName = eventDef.send

		// CRITICAL: Ignore events from elements torn down during rerender (blur/focusout fire when removed)
		// Prevents FORM_SUBMIT/UPDATE_INPUT feedback loop: rerender → clear DOM → blur → deliver → process → ctx → rerender
		if (element?.isConnected === false) return

		const FORM_INPUT_EVENTS = ['FORM_SUBMIT', 'UPDATE_INPUT', 'UPDATE_AGENT_INPUT']

		// Schema-driven debounce: eventDef.$debounce (ms) prevents event storms
		// CRITICAL: Use separate keys per event type. Shared key caused double-submit bug:
		// click submit → blur fires UPDATE_INPUT → debounce set → FORM_SUBMIT blocked (same key).
		// Each event type throttles only itself (double FORM_SUBMIT, duplicate UPDATE_INPUT).
		// FORM_SUBMIT: 100ms (prevents accidental double-submit; 400ms felt like double-click needed)
		// UPDATE_INPUT: 400ms (prevents storm from input/blur)
		const defaultDebounce =
			eventName === 'FORM_SUBMIT' ? 100 : FORM_INPUT_EVENTS.includes(eventName) ? 400 : 0
		const debounceMs = eventDef.$debounce ?? defaultDebounce
		const debounceKey = `${actorId}:${eventName}`
		if (typeof debounceMs === 'number' && debounceMs > 0) {
			const now = Date.now()
			const last = this._eventDebounce.get(debounceKey)
			if (last != null && now - last < debounceMs) return
			this._eventDebounce.set(debounceKey, now)
			setTimeout(() => this._eventDebounce.delete(debounceKey), debounceMs)
		}

		// Cooling: block spurious FORM_SUBMIT when overlay just opened (ghost clicks, touch delayed events)
		if (eventName === 'OPEN_POPUP') {
			this._lastPopupOpenTime = Date.now()
		}
		if (
			eventName === 'FORM_SUBMIT' &&
			this._lastPopupOpenTime > 0 &&
			Date.now() - this._lastPopupOpenTime < this._popupOpenCoolingMs
		) {
			return
		}

		perfPipelineStart(`view:${eventName}`)
		traceView(eventName, actorId)
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

		const UPDATE_INPUT_TYPES = ['UPDATE_INPUT', 'UPDATE_AGENT_INPUT']
		const isUpdateInputType = UPDATE_INPUT_TYPES.includes(eventName)

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

		if (eventName === 'UPDATE_INPUT' && e.type === 'input') {
			return
		}

		// Message types that sync context from DOM - do NOT clear inputs (would overwrite user typing)
		if (this.actorOps) {
			const actor = this.actorOps.getActor?.(actorId)
			if (actor?.machine || actor?.process) {
				payload = await extractDOMValuesAsync(payload, element)

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

				// BlobEngine: Convert file to CoBinary ref BEFORE validation/deliver (generic)
				// Rule: Binary lives only in storage; inbox carries refs and metadata only.
				const hasBinaryPayload = payload?.file instanceof File
				let payloadToValidate = payload
				if (hasBinaryPayload && this.blobEngine) {
					const eventSchema = actor?.interfaceSchema?.properties?.[eventName]
					const blobRefKey = eventSchema?.required?.[0] ?? eventSchema?.['$blobRefKey'] ?? 'coId'
					const result = await this.blobEngine.uploadToCoBinary(payload, {
						onProgress: (loaded, total, phase) =>
							this.actorOps?.reportUploadProgress?.(actorId, loaded, total, phase),
					})
					payloadToValidate = { [blobRefKey]: result.coId, mimeType: result.mimeType }
				} else if (payloadToValidate && typeof payloadToValidate === 'object') {
					// Plain-ify: CoMap/Proxy from context have extra props; additionalProperties fails
					payloadToValidate = normalizeCoValueData(payloadToValidate)
					// Strip CoJSON metadata (_coValueType etc.) and ensure definition is string for schema items
					payloadToValidate = sanitizePayloadForValidation(payloadToValidate)
					// Ensure FORM_SUBMIT/UPDATE_INPUT value is string (context/Proxy can yield undefined)
					if (
						payloadToValidate &&
						(eventName === 'FORM_SUBMIT' || eventName === 'UPDATE_INPUT') &&
						actor?.interfaceSchema?.properties?.[eventName]?.properties?.value?.type === 'string'
					) {
						const v = payloadToValidate.value
						if (v === undefined || v === null || typeof v !== 'string') {
							payloadToValidate = { ...payloadToValidate, value: v == null ? '' : String(v) }
						}
					}
				}

				// Runtime schema validation (from actor's interface) - skip send if payload invalid
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
						console.warn('[ViewEngine] Payload validation failed - event not delivered:', {
							event: eventName,
							actorId: actorId?.slice(0, 24),
							payloadKeys: payloadToValidate ? Object.keys(payloadToValidate) : [],
							payloadValueType:
								payloadToValidate?.value != null ? typeof payloadToValidate.value : 'missing',
							errors: validation.errors,
							errorSummary: (validation.errors || [])
								.map((e) => `${e.instancePath || '/'}: ${e.message || ''}`)
								.join('; '),
						})
					}
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

				perfPipelineStep('view:deliver', { event: eventName })
				await this.actorOps?.deliverEvent?.(actorId, actorId, eventName, payloadToValidate)

				// AUTO-CLEAR INPUTS: After form submission (any event except update-input types), clear all input fields
				// This ensures forms reset after submission without manual clearing workarounds
				// UPDATE_INPUT, UPDATE_AGENT_INPUT etc. update context from DOM - do NOT clear (would overwrite user typing)
				if (!isUpdateInputType) {
					this._clearInputFields(element, actorId)
				}
			} else if (
				typeof window !== 'undefined' &&
				(window.location?.hostname === 'localhost' || import.meta?.env?.DEV) &&
				eventDef?.send
			) {
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
		// Find the closest form element, form-like container (.form), or fall back to actor's shadow root
		let container = element.closest('form') || element.closest('.form')
		if (!container && this.actorOps) {
			const actor = this.actorOps.getActor?.(actorId)
			if (actor?.shadowRoot) {
				container = actor.shadowRoot
			}
		}

		if (!container) return

		// Clear all input and textarea fields within the container
		const inputs = container.querySelectorAll('input, textarea')
		for (const input of inputs) {
			if (input.tagName === 'INPUT') {
				input.value = ''
			} else if (input.tagName === 'TEXTAREA') {
				input.value = ''
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
	}
}
