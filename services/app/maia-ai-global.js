/**
 * Maia AI Global — RedPill LLM chat via Chat vibe (messages actor). FAB + modal with text input.
 */

import { ACTOR_NANOID_TO_EXECUTABLE_KEY } from '@MaiaOS/universe'
import { maiaIdentity } from '@MaiaOS/validation/identity-from-maia-path.js'
import { escapeHtml } from './utils.js'

const SPARKLE_ICON = `<svg class="maia-ai-center-icon maia-ai-icon-mic" width="24" height="24" viewBox="0 0 24 24" fill="none"><path fill="currentColor" fill-opacity="0.16" d="m9.96 9.137l.886-3.099c.332-1.16 1.976-1.16 2.308 0l.885 3.099a1.2 1.2 0 0 0 .824.824l3.099.885c1.16.332 1.16 1.976 0 2.308l-3.099.885a1.2 1.2 0 0 0-.824.824l-.885 3.099c-.332 1.16-1.976 1.16-2.308 0l-.885-3.099a1.2 1.2 0 0 0-.824-.824l-3.099-.885c-1.16-.332-1.16-1.976 0-2.308l3.099-.885a1.2 1.2 0 0 0 .824-.824"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="m9.96 9.137l.886-3.099c.332-1.16 1.976-1.16 2.308 0l.885 3.099a1.2 1.2 0 0 0 .824.824l3.099.885c1.16.332 1.16 1.976 0 2.308l-3.099.885a1.2 1.2 0 0 0-.824.824l-.885 3.099c-.332 1.16-1.976 1.16-2.308 0l-.885-3.099a1.2 1.2 0 0 0-.824-.824l-3.099-.885c-1.16-.332-1.16-1.976 0-2.308l3.099-.885a1.2 1.2 0 0 0 .824-.824M4.43 4.283l.376-1.507c.05-.202.338-.202.388 0l.377 1.507a.2.2 0 0 0 .145.146l1.508.377c.202.05.202.337 0 .388l-1.508.377a.2.2 0 0 0-.145.145l-.377 1.508c-.05.202-.338.202-.388 0l-.377-1.508a.2.2 0 0 0-.145-.145l-1.508-.377c-.202-.05-.202-.338 0-.388l1.508-.377a.2.2 0 0 0 .145-.146M18.43 18.284l.376-1.508c.05-.202.337-.202.388 0l.377 1.508a.2.2 0 0 0 .145.145l1.508.377c.202.05.202.337 0 .388l-1.508.377a.2.2 0 0 0-.145.145l-.377 1.508c-.05.202-.337.202-.388 0l-.377-1.508a.2.2 0 0 0-.145-.145l-1.508-.377c-.202-.05-.202-.338 0-.388l1.508-.377a.2.2 0 0 0 .145-.145"/></svg>`
const STOP_ICON = `<svg class="maia-ai-center-icon maia-ai-icon-stop" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`
const HOME_ICON = `<svg class="maia-nav-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" fill-opacity="0.25" d="M5 14.059c0-1.01 0-1.514.222-1.945c.221-.43.632-.724 1.453-1.31l4.163-2.974c.56-.4.842-.601 1.162-.601s.601.2 1.162.601l4.163 2.973c.821.587 1.232.88 1.453 1.311s.222.935.222 1.944V19c0 .943 0 1.414-.293 1.707S17.943 21 17 21H7c-.943 0-1.414 0-1.707-.293S5 19.943 5 19z"/><path fill="currentColor" d="M3 12.387c0 .266 0 .4.084.441s.19-.04.4-.205l7.288-5.668c.59-.459.885-.688 1.228-.688s.638.23 1.228.688l7.288 5.668c.21.164.316.246.4.205s.084-.175.084-.441v-.409c0-.48 0-.72-.102-.928s-.291-.356-.67-.65l-7-5.445c-.59-.459-.885-.688-1.228-.688s-.638.23-1.228.688l-7 5.445c-.379.294-.569.442-.67.65S3 11.498 3 11.978zM12.5 15h-1a2 2 0 0 0-2 2v3.85c0 .083.067.15.15.15h4.7a.15.15 0 0 0 .15-.15V17a2 2 0 0 0-2-2"/><rect width="2" height="4" x="16" y="5" fill="currentColor" rx=".5"/></svg>`
const BELL_ICON = `<svg class="maia-nav-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M18.75 9v.704c0 .845.24 1.671.692 2.374l1.108 1.723c1.011 1.574.239 3.713-1.52 4.21a25.8 25.8 0 0 1-14.06 0c-1.759-.497-2.531-2.636-1.52-4.21l1.108-1.723a4.4 4.4 0 0 0 .693-2.374V9c0-3.866 3.022-7 6.749-7s6.75 3.134 6.75 7" opacity="0.5"/><path fill="currentColor" d="M7.243 18.545a5.002 5.002 0 0 0 9.513 0c-3.145.59-6.367.59-9.513 0"/></svg>`
const SEND_ICON = `<svg class="maia-ai-send-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="currentColor" d="M3 20V4l18 8z"/></svg>`

const CHAT_INTENT_ACTOR_NANOID = maiaIdentity('chat/intent/intent.actor.maia').$nanoid

function execKeyFromActorCfg(cfg) {
	if (!cfg || typeof cfg !== 'object' || typeof cfg.$nanoid !== 'string') return ''
	return ACTOR_NANOID_TO_EXECUTABLE_KEY[cfg.$nanoid] ?? ''
}

let maiaRef = null
let messagesActorId = null
let contextUnsub = null
/** @type {Record<string, unknown>|null} */
let lastChatCtx = null
let chatError = ''
/** @type {string|null} */
let lastChatVibeCoId = null
let sessionChatHost = null
let sessionChatLoadPromise = null

let rootEl = null
let navEl = null
let fabBtn = null
let navLeftBtn = null
let messagesEl = null
/** @type {HTMLInputElement|null} */
let inputEl = null
let sendBtn = null

let fabVisibleByRoute = true
let modalOpen = false

/** @type {{ name: string, ok: boolean }[]} */
let pendingToolsForTurn = []
const toolsByAssistantOrdinal = new Map()
let prevChatLoading = false

function formatToolBadgesHtml(badges) {
	if (!badges?.length) return ''
	const inner = badges
		.map(
			(t) =>
				`<span class="maia-ai-tool-badge ${t.ok ? 'maia-ai-tool-badge-ok' : 'maia-ai-tool-badge-err'}" title="${t.ok ? 'OK' : 'Failed'}">${escapeHtml(t.name)}</span>`,
		)
		.join('')
	return `<div class="maia-ai-msg-tools" aria-label="Tools used">${inner}</div>`
}

function assistantOrdinalCount(conv) {
	let ord = 0
	for (const m of conv) {
		if (m?.role === 'assistant' && typeof m.content === 'string' && m.content.trim()) ord += 1
	}
	return ord
}

function flushPendingToolsToLastAssistant(ctx) {
	if (!pendingToolsForTurn.length) return
	const conv = Array.isArray(ctx?.conversations) ? ctx.conversations : []
	const ord = assistantOrdinalCount(conv)
	if (ord < 1) return
	const prev = toolsByAssistantOrdinal.get(ord) || []
	toolsByAssistantOrdinal.set(ord, [...prev, ...pendingToolsForTurn])
	pendingToolsForTurn = []
}

function toolExecutedHandler(payload) {
	const name =
		payload && typeof payload.toolName === 'string' && payload.toolName.trim()
			? payload.toolName.trim()
			: 'tool'
	pendingToolsForTurn.push({ name, ok: payload?.ok !== false })
	if (modalOpen) renderMessages()
}

function scrollMessagesToBottom() {
	if (!messagesEl) return
	messagesEl.scrollTop = messagesEl.scrollHeight
	requestAnimationFrame(() => {
		if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight
	})
}

function renderMessages() {
	if (!messagesEl) return
	const ctx = lastChatCtx
	const conv = Array.isArray(ctx?.conversations) ? ctx.conversations : []
	if (conv.length === 0 && !ctx?.isLoading) {
		toolsByAssistantOrdinal.clear()
		pendingToolsForTurn = []
	}
	let assistantOrdinal = 0
	const rows = []
	for (const msg of conv) {
		const role = msg?.role
		const content = typeof msg?.content === 'string' ? msg.content.trim() : ''
		if (!content) continue
		const isUser = role === 'user'
		if (!isUser && role === 'assistant') assistantOrdinal += 1
		const toolStrip =
			!isUser && role === 'assistant'
				? formatToolBadgesHtml(toolsByAssistantOrdinal.get(assistantOrdinal) || [])
				: ''
		const name = typeof msg?.displayName === 'string' ? msg.displayName : ''
		const label = name ? `<div class="maia-ai-msg-name">${escapeHtml(name)}</div>` : ''
		const bubbleStyle = isUser
			? 'padding:0.75rem 1rem;border-radius:12px;max-width:85%;background:var(--marine-blue, #1e3a5f);color:white;margin-left:auto;'
			: 'padding:0.75rem 1rem;border-radius:12px;max-width:85%;background:rgba(30,58,95,0.12);color:inherit;margin-right:auto;'
		rows.push(`
		<div class="maia-ai-msg ${isUser ? 'user' : 'assistant'}" style="${bubbleStyle}">
			${label}
			<div class="maia-ai-msg-text" style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(content)}</div>
			${toolStrip}
		</div>`)
	}
	if (ctx?.isLoading) {
		const lt = typeof ctx.loadingText === 'string' ? ctx.loadingText : 'Maia is thinking…'
		const liveTools = formatToolBadgesHtml(pendingToolsForTurn)
		rows.push(`
		<div class="maia-ai-msg assistant maia-ai-msg-loading" style="padding:0.5rem 1rem;max-width:85%;margin-right:auto;opacity:0.85;font-style:italic;">
			${escapeHtml(lt)}
			${liveTools}
		</div>`)
	}
	if (chatError) {
		rows.push(`
		<div class="maia-ai-msg error" style="padding:0.75rem 1rem;border-radius:12px;max-width:85%;background:rgba(185,28,28,0.12);color:#991b1b;margin-left:auto;">
			<div class="maia-ai-msg-text" style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(chatError)}</div>
		</div>`)
	}
	if (rows.length === 0) {
		rows.push(`
		<div class="maia-ai-msg empty" style="padding:1rem;text-align:center;opacity:0.65;font-size:0.9rem;">
			Type a message to chat with Maia (same thread as Chat).
		</div>`)
	}
	messagesEl.innerHTML = rows.join('')
	scrollMessagesToBottom()
}

function actorConfigMatchesChatIntent(cfg) {
	if (!cfg || typeof cfg !== 'object') return false
	return cfg.$nanoid === CHAT_INTENT_ACTOR_NANOID
}

function actorConfigMatchesMessages(cfg) {
	if (!cfg || typeof cfg !== 'object') return false
	const k = execKeyFromActorCfg(cfg)
	return (
		typeof k === 'string' &&
		(k.includes('views/messages') || k.includes('actor/services/messages') || k.endsWith('/messages'))
	)
}

function actorIsMessagesViewByProcessDef(actor) {
	const procId = actor?.process?.definition?.$id
	if (typeof procId === 'string' && procId.includes('views/messages/process')) return true
	return false
}

function findMessagesActorIdInTree(actor) {
	if (!actor) return null
	if (actorConfigMatchesMessages(actor.config) || actorIsMessagesViewByProcessDef(actor))
		return actor.id
	const ch = actor.children
	if (!ch || typeof ch !== 'object') return null
	for (const k of Object.keys(ch)) {
		const found = findMessagesActorIdInTree(ch[k])
		if (found) return found
	}
	return null
}

export async function resolveChatVibeCoId(maia) {
	const peer = maia?.dataEngine?.peer
	if (!peer) return null
	if (typeof peer.resolveSystemSparkCoId === 'function' && !peer.systemSparkCoId) {
		await peer.resolveSystemSparkCoId()
	}
	const sparkCoId = peer.systemSparkCoId
	if (!sparkCoId?.startsWith?.('co_z')) return null
	const sparkStore = await maia.do({ op: 'read', factory: null, key: sparkCoId })
	const osId = sparkStore?.value?.os
	if (!osId?.startsWith?.('co_z')) return null
	const osStore = await maia.do({ op: 'read', factory: null, key: osId })
	const vibesId = osStore?.value?.vibes
	if (!vibesId?.startsWith?.('co_z')) return null
	const vibesStore = await maia.do({ op: 'read', factory: vibesId, key: vibesId })
	const vibesData = vibesStore?.value ?? vibesStore
	const cid = vibesData?.chat
	return typeof cid === 'string' && cid.startsWith('co_z') ? cid : null
}

export async function findSessionChatIntentActorId(maia) {
	const chatVibe = await resolveChatVibeCoId(maia)
	if (!chatVibe) return null
	const set = maia.getEngines().actorEngine.getActorsForVibe(chatVibe)
	if (!set?.size) return null
	for (const id of set) {
		const a = maia.getActor(id)
		if (actorConfigMatchesChatIntent(a?.config)) return id
	}
	return null
}

async function findMessagesActorId(maia) {
	const chatVibe = await resolveChatVibeCoId(maia)
	if (!chatVibe) return null
	const set = maia.getEngines().actorEngine.getActorsForVibe(chatVibe)
	if (!set?.size) return null
	for (const id of set) {
		const a = maia.getActor(id)
		if (actorConfigMatchesMessages(a?.config) || actorIsMessagesViewByProcessDef(a)) return id
	}
	return null
}

async function waitForMessagesActor(maia, rootIntentActor) {
	const deadline = Date.now() + 15000
	while (Date.now() < deadline) {
		const fromSet = await findMessagesActorId(maia)
		if (fromSet) return fromSet
		const fromTree = rootIntentActor ? findMessagesActorIdInTree(rootIntentActor) : null
		if (fromTree) return fromTree
		await new Promise((r) => setTimeout(r, 48))
	}
	return null
}

function wireMessagesContext() {
	if (!maiaRef || !messagesActorId) return
	const actor = maiaRef.getActor(messagesActorId)
	if (!actor?.context?.subscribe) return
	if (contextUnsub) {
		contextUnsub()
		contextUnsub = null
	}
	contextUnsub = actor.context.subscribe((ctx) => {
		lastChatCtx = ctx && typeof ctx === 'object' ? ctx : null
		const loading = !!lastChatCtx?.isLoading
		if (prevChatLoading && !loading) {
			flushPendingToolsToLastAssistant(lastChatCtx)
		}
		if (!prevChatLoading && loading) {
			pendingToolsForTurn = []
		}
		prevChatLoading = loading
		if (modalOpen) renderMessages()
	})
	prevChatLoading = false
}

async function ensureSessionChat() {
	if (!maiaRef?.id?.maiaId) {
		throw new Error('Sign in required')
	}
	const resolvedVibe = await resolveChatVibeCoId(maiaRef)
	if (resolvedVibe) lastChatVibeCoId = resolvedVibe
	if (messagesActorId && maiaRef.getActor(messagesActorId)) {
		wireMessagesContext()
		return messagesActorId
	}
	const existing = await findMessagesActorId(maiaRef)
	if (existing) {
		messagesActorId = existing
		wireMessagesContext()
		return messagesActorId
	}
	if (sessionChatLoadPromise) return sessionChatLoadPromise
	sessionChatLoadPromise = (async () => {
		if (!sessionChatHost) {
			sessionChatHost = document.getElementById('maia-session-chat-host')
		}
		if (!sessionChatHost) {
			sessionChatHost = document.createElement('div')
			sessionChatHost.id = 'maia-session-chat-host'
			sessionChatHost.setAttribute('aria-hidden', 'true')
			sessionChatHost.style.cssText =
				'position:fixed;width:0;height:0;overflow:hidden;pointer-events:none;visibility:hidden'
			document.body.appendChild(sessionChatHost)
		}
		const chatVibeCoId = resolvedVibe ?? (await resolveChatVibeCoId(maiaRef))
		if (!chatVibeCoId) throw new Error('Chat vibe co-id not found in spark.os.vibes')
		lastChatVibeCoId = chatVibeCoId
		const { actor: rootIntent } = await maiaRef.loadVibe(chatVibeCoId, sessionChatHost, chatVibeCoId)
		const mid = await waitForMessagesActor(maiaRef, rootIntent)
		if (!mid) throw new Error('Messages actor not found after loading Chat')
		messagesActorId = mid
		wireMessagesContext()
		return messagesActorId
	})()
	try {
		return await sessionChatLoadPromise
	} finally {
		sessionChatLoadPromise = null
	}
}

function applyFabVisibility() {
	if (!navEl) return
	navEl.style.display = fabVisibleByRoute ? '' : 'none'
}

function updateFabButton() {
	if (!fabBtn) return
	const micIcon = fabBtn.querySelector('.maia-ai-icon-mic')
	const stopIcon = fabBtn.querySelector('.maia-ai-icon-stop')
	if (micIcon) micIcon.classList.toggle('active', !modalOpen)
	if (stopIcon) stopIcon.classList.toggle('active', modalOpen)
	fabBtn.classList.toggle('maia-ai-center-btn-stop', modalOpen)
	fabBtn.setAttribute('title', modalOpen ? 'Close chat' : 'Chat')
	fabBtn.setAttribute('aria-label', modalOpen ? 'Close chat' : 'Chat')
	fabBtn.disabled = false
	applyFabVisibility()
}

async function sendTextMessage() {
	if (!inputEl || !maiaRef) return
	const trimmed = inputEl.value.trim()
	if (!trimmed) return
	chatError = ''
	try {
		if (!maiaRef?.id?.maiaId) {
			chatError = 'Sign in required to message Maia.'
			renderMessages()
			return
		}
		const mid = await ensureSessionChat()
		await maiaRef.deliverEvent(mid, mid, 'SEND_MESSAGE', { inputText: trimmed })
		inputEl.value = ''
		renderMessages()
	} catch (err) {
		chatError = err?.message || String(err)
		renderMessages()
	}
}

function openModal() {
	modalOpen = true
	const modal = rootEl?.querySelector('.maia-ai-modal')
	if (modal) modal.classList.add('open')
	if (maiaRef?.id?.maiaId) {
		void ensureSessionChat()
			.then(() => {
				if (modalOpen) renderMessages()
			})
			.catch(() => {})
	}
	updateFabButton()
	scrollMessagesToBottom()
	requestAnimationFrame(() => inputEl?.focus())
}

function closeModal() {
	modalOpen = false
	const modal = rootEl?.querySelector('.maia-ai-modal')
	if (modal) modal.classList.remove('open')
	updateFabButton()
}

function handleFabClick() {
	if (!modalOpen) openModal()
	else closeModal()
}

function injectDOM() {
	if (rootEl) return
	rootEl = document.createElement('div')
	rootEl.id = 'maia-ai-fab-root'
	rootEl.innerHTML = `
		<div class="maia-ai-modal" id="maia-ai-modal">
			<div class="maia-ai-modal-content">
				<div class="maia-ai-messages" id="maia-ai-messages"></div>
				<div class="maia-ai-footer">
					<div class="maia-ai-input-wrap">
						<input type="text" class="maia-ai-input" id="maia-ai-input" placeholder="Message Maia…" autocomplete="off" />
						<button type="button" class="maia-ai-send" id="maia-ai-send" title="Send" aria-label="Send">${SEND_ICON}</button>
					</div>
				</div>
				<div class="maia-ai-modal-close-wrap">
					<button type="button" class="maia-ai-modal-close" id="maia-ai-modal-close" title="Close" aria-label="Close">×</button>
				</div>
			</div>
		</div>
		<nav class="maia-nav" id="maia-nav">
			<div class="maia-nav-pill">
				<button type="button" class="maia-nav-left" id="maia-nav-left">${HOME_ICON}</button>
				<button type="button" class="maia-nav-right" id="maia-nav-right" disabled>${BELL_ICON}</button>
			</div>
			<button type="button" class="maia-nav-center maia-ai-center-btn" id="maia-ai-fab" title="Chat" aria-label="Chat">
				<div class="maia-nav-center-inner">
					${SPARKLE_ICON}
					${STOP_ICON}
				</div>
			</button>
		</nav>
	`
	document.body.appendChild(rootEl)

	messagesEl = rootEl.querySelector('#maia-ai-messages')
	inputEl = rootEl.querySelector('#maia-ai-input')
	sendBtn = rootEl.querySelector('#maia-ai-send')
	navEl = rootEl.querySelector('#maia-nav')
	navLeftBtn = rootEl.querySelector('#maia-nav-left')
	fabBtn = rootEl.querySelector('#maia-ai-fab')

	fabBtn?.addEventListener('click', handleFabClick)
	sendBtn?.addEventListener('click', () => void sendTextMessage())
	inputEl?.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			void sendTextMessage()
		}
	})

	const closeBtn = rootEl.querySelector('#maia-ai-modal-close')
	closeBtn?.addEventListener('click', closeModal)

	const micIcon = fabBtn?.querySelector('.maia-ai-icon-mic')
	const stopIcon = fabBtn?.querySelector('.maia-ai-icon-stop')
	if (micIcon) micIcon.classList.add('active')
	if (stopIcon) stopIcon.classList.remove('active')
}

export function setFabVisible(signedIn) {
	fabVisibleByRoute = !!signedIn
	applyFabVisibility()
}

export function updateNavLeft(label, onClick) {
	if (!navLeftBtn) return
	navLeftBtn.innerHTML = label === 'home' ? HOME_ICON : label
	navLeftBtn.disabled = !onClick
	navLeftBtn.onclick = onClick ? () => onClick() : null
}

export async function initGlobalAI(maia) {
	maiaRef = maia ?? null
	if (maiaRef?.runtime?.off) {
		maiaRef.runtime.off('toolExecuted', toolExecutedHandler)
	}
	if (maiaRef?.runtime?.on) {
		maiaRef.runtime.on('toolExecuted', toolExecutedHandler)
	}
	injectDOM()
	setFabVisible(true)
	updateFabButton()
}

export function disposeGlobalAI() {
	const rt = maiaRef?.runtime
	if (rt?.off) {
		rt.off('toolExecuted', toolExecutedHandler)
	}
	pendingToolsForTurn = []
	toolsByAssistantOrdinal.clear()
	prevChatLoading = false
	if (contextUnsub) {
		contextUnsub()
		contextUnsub = null
	}
	if (maiaRef?.runtime && lastChatVibeCoId) {
		try {
			maiaRef.runtime.destroyActorsForVibe(lastChatVibeCoId)
		} catch (_e) {}
	}
	maiaRef = null
	messagesActorId = null
	lastChatCtx = null
	lastChatVibeCoId = null
	chatError = ''
	if (sessionChatHost?.parentNode) {
		sessionChatHost.parentNode.removeChild(sessionChatHost)
	}
	sessionChatHost = null
	sessionChatLoadPromise = null
	modalOpen = false
	if (rootEl?.parentNode) {
		rootEl.parentNode.removeChild(rootEl)
	}
	rootEl = null
	navEl = null
	fabBtn = null
	navLeftBtn = null
	messagesEl = null
	inputEl = null
	sendBtn = null
}
