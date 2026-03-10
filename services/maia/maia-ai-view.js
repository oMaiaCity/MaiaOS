/**
 * Maia AI View — On-device local LLM chat
 * Uses @MaiaOS/maia-ai (RunAnywhere) for private, offline-capable chat.
 */

import { resolveAccountCoIdsToProfileNames } from '@MaiaOS/loader'
import {
	AudioCapture,
	AudioPlayback,
	ensureAllModelsLoaded,
	generateWithTools,
	initialize,
	isModelLoaded,
	isVoiceModelsLoaded,
	SpeechActivity,
	synthesizeVoice,
	transcribeVoice,
	VAD,
	VOICE_MODEL_IDS,
	VOICE_MODEL_LABELS,
} from '@MaiaOS/maia-ai'
import { escapeHtml, getSyncStatusMessage, truncate } from './utils.js'

export async function renderMaiaAIView(maia, authState, syncState, navigateToScreen) {
	const accountId = maia?.id?.maiaId?.id || ''
	let accountDisplayName = truncate(accountId, 12)
	if (accountId?.startsWith('co_z') && maia?.db) {
		try {
			const profileNames = await resolveAccountCoIdsToProfileNames(maia, [accountId])
			accountDisplayName = profileNames.get(accountId) ?? accountDisplayName
		} catch (_e) {}
	}

	// Dispose previous state if any
	if (typeof window._maiaAIDispose === 'function') {
		window._maiaAIDispose()
		window._maiaAIDispose = null
	}

	const messages = []
	let tabState = 'collapsed' // 'collapsed' | 'text' | 'voice'
	let voiceState = 'idle' // idle | loading-models | listening | processing | speaking
	let micRef = null
	let vadUnsub = null
	let modelsLoadPromise = null

	document.getElementById('app').innerHTML = `
		<div class="db-container">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left"><h1>Maia AI</h1></div>
					<div class="header-center"><img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" /></div>
					<div class="header-right">
						<div class="sync-status ${syncState.connected ? 'connected' : 'disconnected'}" title="${getSyncStatusMessage(syncState)}" aria-label="${getSyncStatusMessage(syncState)}"><span class="sync-dot"></span></div>
						${authState.signedIn ? `<button type="button" class="db-status db-status-name account-menu-toggle" title="Account: ${accountId}" onclick="window.toggleMobileMenu()" aria-label="Toggle account menu">${escapeHtml(accountDisplayName)}</button>` : ''}
					</div>
				</div>
				<div class="mobile-menu" id="mobile-menu">
					${authState.signedIn && accountId ? `<div class="mobile-menu-account-id"><button type="button" class="mobile-menu-copy-id" title="Copy ID" data-copy-id="${escapeHtml(accountId)}" onclick="(function(btn){const id=btn.dataset.copyId;if(id)navigator.clipboard.writeText(id).then(()=>{btn.textContent='✓';setTimeout(()=>btn.textContent='⎘',800)});})(this)">⎘</button><code class="mobile-menu-account-id-value" title="${escapeHtml(accountId)}">${escapeHtml(accountId)}</code></div>` : ''}
					${authState.signedIn ? `<button class="mobile-menu-item sign-out-btn" onclick="window.handleSignOut(); window.toggleMobileMenu();">Sign Out</button>` : ''}
				</div>
			</header>
			<div class="agent-viewer-main">
				<div class="maia-ai-chat">
					<div class="maia-ai-status" id="maia-ai-status">Initializing…</div>
					<div class="maia-ai-progress" id="maia-ai-progress" style="display:none;">
						<div class="maia-ai-progress-models" id="maia-ai-progress-models"></div>
					</div>
					<div class="maia-ai-messages" id="maia-ai-messages"></div>
					<div class="maia-ai-footer">
						<div class="maia-ai-tab" id="maia-ai-tab">
							<div class="maia-ai-tab-text" id="maia-ai-tab-text" style="display:none;">
								<input type="text" class="maia-ai-prompt" id="maia-ai-prompt" placeholder="Type a message…" />
								<button type="button" class="maia-ai-send" id="maia-ai-send" title="Send">
									<svg class="maia-ai-send-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><defs><path id="maia-ai-send-path" d="m7.692 11.897l1.41.47c.932.31 1.397.466 1.731.8s.49.8.8 1.73l.47 1.41c.784 2.354 1.176 3.53 1.897 3.53c.72 0 1.113-1.176 1.897-3.53l2.838-8.512c.552-1.656.828-2.484.391-2.921s-1.265-.161-2.92.39l-8.515 2.84C5.34 8.887 4.162 9.279 4.162 10s1.177 1.113 3.53 1.897"/></defs><use href="#maia-ai-send-path" fill-opacity="0.25"/><path fill="currentColor" d="m9.526 13.842l-2.062-.687a1 1 0 0 0-.87.116l-1.09.726a.8.8 0 0 0 .25 1.442l1.955.488a.5.5 0 0 1 .364.364l.488 1.955a.8.8 0 0 0 1.442.25l.726-1.09a1 1 0 0 0 .116-.87l-.687-2.062a1 1 0 0 0-.632-.632"/></svg>
								</button>
							</div>
							<div class="maia-ai-tab-voice" id="maia-ai-tab-voice" style="display:none;">
								<div class="maia-ai-voice-orb" id="maia-ai-voice-orb"></div>
								<div class="maia-ai-voice-status" id="maia-ai-voice-status"></div>
								<div class="maia-ai-voice-actions" id="maia-ai-voice-actions"></div>
							</div>
							<div class="maia-ai-tab-load" id="maia-ai-tab-load" style="display:none;">
								<span class="maia-ai-loading-text">Loading model…</span>
							</div>
						</div>
						<button type="button" class="maia-ai-center-btn" id="maia-ai-center-btn" title="Tap to type, double-tap for voice" aria-label="Compose">
							<svg class="maia-ai-center-icon maia-ai-icon-sparkle" width="24" height="24" viewBox="0 0 24 24" fill="none"><path fill="currentColor" fill-opacity="0.16" d="m9.96 9.137l.886-3.099c.332-1.16 1.976-1.16 2.308 0l.885 3.099a1.2 1.2 0 0 0 .824.824l3.099.885c1.16.332 1.16 1.976 0 2.308l-3.099.885a1.2 1.2 0 0 0-.824.824l-.885 3.099c-.332 1.16-1.976 1.16-2.308 0l-.885-3.099a1.2 1.2 0 0 0-.824-.824l-3.099-.885c-1.16-.332-1.16-1.976 0-2.308l3.099-.885a1.2 1.2 0 0 0 .824-.824"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="m9.96 9.137l.886-3.099c.332-1.16 1.976-1.16 2.308 0l.885 3.099a1.2 1.2 0 0 0 .824.824l3.099.885c1.16.332 1.16 1.976 0 2.308l-3.099.885a1.2 1.2 0 0 0-.824.824l-.885 3.099c-.332 1.16-1.976 1.16-2.308 0l-.885-3.099a1.2 1.2 0 0 0-.824-.824l-3.099-.885c-1.16-.332-1.16-1.976 0-2.308l3.099-.885a1.2 1.2 0 0 0 .824-.824M4.43 4.283l.376-1.507c.05-.202.338-.202.388 0l.377 1.507a.2.2 0 0 0 .145.146l1.508.377c.202.05.202.337 0 .388l-1.508.377a.2.2 0 0 0-.145.145l-.377 1.508c-.05.202-.338.202-.388 0l-.377-1.508a.2.2 0 0 0-.145-.145l-1.508-.377c-.202-.05-.202-.338 0-.388l1.508-.377a.2.2 0 0 0 .145-.146M18.43 18.284l.376-1.508c.05-.202.337-.202.388 0l.377 1.508a.2.2 0 0 0 .145.145l1.508.377c.202.05.202.337 0 .388l-1.508.377a.2.2 0 0 0-.145.145l-.377 1.508c-.05.202-.337.202-.388 0l-.377-1.508a.2.2 0 0 0-.145-.145l-1.508-.377c-.202-.05-.202-.338 0-.388l1.508-.377a.2.2 0 0 0 .145-.145"/></svg>
							<svg class="maia-ai-center-icon maia-ai-icon-mic" width="24" height="24" viewBox="0 0 24 24" fill="none"><path fill="currentColor" fill-opacity="0.16" d="m9.96 9.137l.886-3.099c.332-1.16 1.976-1.16 2.308 0l.885 3.099a1.2 1.2 0 0 0 .824.824l3.099.885c1.16.332 1.16 1.976 0 2.308l-3.099.885a1.2 1.2 0 0 0-.824.824l-.885 3.099c-.332 1.16-1.976 1.16-2.308 0l-.885-3.099a1.2 1.2 0 0 0-.824-.824l-3.099-.885c-1.16-.332-1.16-1.976 0-2.308l3.099-.885a1.2 1.2 0 0 0 .824-.824"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="m9.96 9.137l.886-3.099c.332-1.16 1.976-1.16 2.308 0l.885 3.099a1.2 1.2 0 0 0 .824.824l3.099.885c1.16.332 1.16 1.976 0 2.308l-3.099.885a1.2 1.2 0 0 0-.824.824l-.885 3.099c-.332 1.16-1.976 1.16-2.308 0l-.885-3.099a1.2 1.2 0 0 0-.824-.824l-3.099-.885c-1.16-.332-1.16-1.976 0-2.308l3.099-.885a1.2 1.2 0 0 0 .824-.824M4.43 4.283l.376-1.507c.05-.202.338-.202.388 0l.377 1.507a.2.2 0 0 0 .145.146l1.508.377c.202.05.202.337 0 .388l-1.508.377a.2.2 0 0 0-.145.145l-.377 1.508c-.05.202-.338.202-.388 0l-.377-1.508a.2.2 0 0 0-.145-.145l-1.508-.377c-.202-.05-.202-.338 0-.388l1.508-.377a.2.2 0 0 0 .145-.146M18.43 18.284l.376-1.508c.05-.202.337-.202.388 0l.377 1.508a.2.2 0 0 0 .145.145l1.508.377c.202.05.202.337 0 .388l-1.508.377a.2.2 0 0 0-.145.145l-.377 1.508c-.05.202-.337.202-.388 0l-.377-1.508a.2.2 0 0 0-.145-.145l-1.508-.377c-.202-.05-.202-.338 0-.388l1.508-.377a.2.2 0 0 0 .145-.145"/></svg>
							<svg class="maia-ai-center-icon maia-ai-icon-close" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
						</button>
					</div>
				</div>
			</div>
			<div class="bottom-navbar">
				<div class="bottom-navbar-left">
					<button class="home-btn bottom-home-btn home-btn-icon-only" onclick="window.navigateToScreen('dashboard')" title="Home" aria-label="Home">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
					</button>
				</div>
				<div class="bottom-navbar-center"></div>
				<div class="bottom-navbar-right"></div>
			</div>
		</div>
	`

	const statusEl = document.getElementById('maia-ai-status')
	const progressWrap = document.getElementById('maia-ai-progress')
	const progressModelsEl = document.getElementById('maia-ai-progress-models')
	const messagesEl = document.getElementById('maia-ai-messages')
	const tabEl = document.getElementById('maia-ai-tab')
	const tabText = document.getElementById('maia-ai-tab-text')
	const tabVoice = document.getElementById('maia-ai-tab-voice')
	const tabLoad = document.getElementById('maia-ai-tab-load')
	const promptEl = document.getElementById('maia-ai-prompt')
	const sendBtn = document.getElementById('maia-ai-send')
	const centerBtn = document.getElementById('maia-ai-center-btn')
	const voiceOrb = document.getElementById('maia-ai-voice-orb')
	const voiceStatus = document.getElementById('maia-ai-voice-status')
	const voiceActions = document.getElementById('maia-ai-voice-actions')

	const WORKING_LABEL = 'Working on it'
	function renderMessages() {
		messagesEl.innerHTML = messages
			.map((m, idx) => {
				const isEmptyLastAssistant =
					m.role === 'assistant' && idx === messages.length - 1 && !m.text?.trim()
				if (isEmptyLastAssistant) {
					return `<div class="maia-ai-msg maia-ai-msg-pending" data-msg-idx="${idx}"><span class="maia-ai-working-badge">${escapeHtml(WORKING_LABEL)}</span></div>`
				}
				const toolLabel =
					m.role === 'assistant' && m.toolCalls?.length > 0
						? `🔧 ${m.toolCalls[0]}${m.toolCalls.length > 1 ? ` +${m.toolCalls.length - 1}` : ''}`
						: ''
				const toolBadgeRow = toolLabel
					? `<div class="maia-ai-msg-pending" data-msg-idx="${idx}"><span class="maia-ai-working-badge" title="${escapeHtml(m.toolCalls.join(', '))}">${escapeHtml(toolLabel)}</span></div>`
					: ''
				return `
			${toolBadgeRow}
			<div class="maia-ai-msg ${m.role}" data-msg-idx="${idx}" style="padding:0.75rem 1rem;border-radius:12px;max-width:85%;${m.role === 'user' ? 'background:var(--marine-blue, #1e3a5f);color:white;margin-left:auto;' : 'background:rgba(255,255,255,0.6);color:#1e293b;'}">
				<div class="maia-ai-msg-text" style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(m.text)}</div>
			</div>
		`
			})
			.join('')
		messagesEl.scrollTop = messagesEl.scrollHeight
	}

	function showProgress(show) {
		if (progressWrap) progressWrap.style.display = show ? 'block' : 'none'
	}

	function showReady(ready) {
		showProgress(false)
		if (ready) {
			statusEl.style.display = 'none'
			updateTabContent()
		} else {
			statusEl.style.display = 'block'
			tabState = 'collapsed'
			updateTabContent()
		}
	}

	function isAllReady() {
		return isModelLoaded() && isVoiceModelsLoaded()
	}

	function collapseTab() {
		tabState = 'collapsed'
		stopListening()
		updateTabContent()
	}

	function updateTabContent() {
		tabText.style.display = 'none'
		tabVoice.style.display = 'none'
		tabLoad.style.display = 'none'
		if (tabState === 'collapsed') {
			tabEl?.classList.remove('expanded')
		} else {
			tabEl?.classList.add('expanded')
		}
		if (tabState === 'text') {
			if (isAllReady()) {
				tabText.style.display = 'flex'
			} else {
				const loadText = tabLoad?.querySelector('.maia-ai-loading-text')
				if (loadText) loadText.textContent = 'Loading models…'
				tabLoad.style.display = 'flex'
			}
		} else if (tabState === 'voice') {
			if (isAllReady()) {
				tabVoice.style.display = 'flex'
				renderVoiceUI()
			} else {
				const loadText = tabLoad?.querySelector('.maia-ai-loading-text')
				if (loadText) loadText.textContent = 'Loading models…'
				tabLoad.style.display = 'flex'
			}
		}
		const isExpanded = tabState !== 'collapsed'
		centerBtn?.querySelector('.maia-ai-icon-sparkle')?.classList.toggle('active', !isExpanded)
		centerBtn?.querySelector('.maia-ai-icon-mic')?.classList.toggle('active', false)
		centerBtn?.querySelector('.maia-ai-icon-close')?.classList.toggle('active', isExpanded)
		centerBtn?.setAttribute('title', isExpanded ? 'Close' : 'Tap to type, double-tap for voice')
		centerBtn?.setAttribute('aria-label', isExpanded ? 'Close' : 'Compose')
	}

	function renderProgressBars(progressByModel, modelIds = VOICE_MODEL_IDS, storagePhase = null) {
		if (!progressModelsEl) return
		const storageHtml =
			storagePhase === 'storage-setup'
				? `
				<div class="maia-ai-progress-row maia-ai-progress-row-storage" data-phase="storage">
					<div class="maia-ai-progress-row-label">Storage</div>
					<div class="maia-ai-progress-bar-wrap maia-ai-progress-indeterminate"><div class="maia-ai-progress-bar maia-ai-progress-bar-indeterminate"></div></div>
					<div class="maia-ai-progress-text">Setting up OPFS…</div>
				</div>
			`
				: storagePhase === 'storage-done'
					? `
					<div class="maia-ai-progress-row maia-ai-progress-row-storage maia-ai-progress-row-done" data-phase="storage">
						<div class="maia-ai-progress-row-label">Storage</div>
						<div class="maia-ai-progress-bar-wrap"><div class="maia-ai-progress-bar" style="width:100%"></div></div>
						<div class="maia-ai-progress-text">Ready</div>
					</div>
				`
					: ''
		const rowsHtml = modelIds
			.map((modelId) => {
				const label = VOICE_MODEL_LABELS[modelId] ?? modelId
				const data = progressByModel[modelId] ?? {
					phase: 'waiting',
					progress: 0,
					bytesDownloaded: 0,
					totalBytes: 0,
				}
				const phase = data.phase || 'waiting'
				const pct =
					phase === 'done'
						? 100
						: data.progress != null
							? Math.round(data.progress * 100)
							: data.totalBytes
								? Math.round((data.bytesDownloaded / data.totalBytes) * 100)
								: 0
				const mb = data.totalBytes ? ` / ${(data.totalBytes / 1024 / 1024).toFixed(1)} MB` : ''
				const phaseLabel =
					phase === 'downloading'
						? 'Downloading'
						: phase === 'loading'
							? 'Loading from device'
							: phase === 'done'
								? 'Ready'
								: 'Waiting'
				const isIndeterminate = phase === 'loading'
				const barStyle = isIndeterminate ? '' : `width:${pct}%`
				const barClass = isIndeterminate
					? 'maia-ai-progress-bar maia-ai-progress-bar-indeterminate'
					: 'maia-ai-progress-bar'
				const wrapClass = isIndeterminate
					? 'maia-ai-progress-bar-wrap maia-ai-progress-indeterminate'
					: 'maia-ai-progress-bar-wrap'
				const rowClass = `maia-ai-progress-row ${phase === 'done' ? 'maia-ai-progress-row-done' : ''} ${phase === 'downloading' ? 'maia-ai-progress-row-downloading' : ''} ${phase === 'loading' ? 'maia-ai-progress-row-loading' : ''}`
				const text = phase === 'loading' ? 'Loading…' : phase === 'done' ? 'Ready' : `${pct}%${mb}`
				return `
				<div class="${rowClass}" data-model-id="${escapeHtml(modelId)}" data-phase="${phase}">
					<div class="maia-ai-progress-row-label">${escapeHtml(label)} <span class="maia-ai-progress-phase">${escapeHtml(phaseLabel)}</span></div>
					<div class="${wrapClass}"><div class="${barClass}" style="${barStyle}"></div></div>
					<div class="maia-ai-progress-text">${text}</div>
				</div>
			`
			})
			.join('')
		progressModelsEl.innerHTML = storageHtml + rowsHtml
	}

	async function ensureAllModels() {
		if (isAllReady()) return true
		if (modelsLoadPromise) return modelsLoadPromise
		voiceState = 'loading-models'
		if (tabState === 'voice') renderVoiceUI()
		statusEl.textContent = 'Loading models…'
		statusEl.style.display = 'block'
		showProgress(true)
		const progressByModel = {}
		for (const id of VOICE_MODEL_IDS)
			progressByModel[id] = { phase: 'waiting', progress: 0, bytesDownloaded: 0, totalBytes: 0 }
		let storagePhase = null
		renderProgressBars(progressByModel, VOICE_MODEL_IDS, storagePhase)
		modelsLoadPromise = (async () => {
			try {
				await ensureAllModelsLoaded(
					(modelId, data) => {
						if (data) {
							progressByModel[modelId] = { ...progressByModel[modelId], ...data }
							renderProgressBars(progressByModel, VOICE_MODEL_IDS, storagePhase)
						}
					},
					(phase) => {
						storagePhase = phase
						renderProgressBars(progressByModel, VOICE_MODEL_IDS, storagePhase)
					},
				)
				showProgress(false)
				voiceState = 'idle'
				statusEl.style.display = 'none'
				showReady(true)
				if (tabState === 'voice') startListening()
				return true
			} catch (err) {
				showProgress(false)
				voiceState = 'idle'
				const msg = err?.message || String(err)
				statusEl.innerHTML = `Failed to load models: ${escapeHtml(msg)} <button type="button" class="maia-ai-retry-btn" onclick="this.closest('.maia-ai-chat') && window.__maiaAIRetryModel?.()">Retry</button>`
				statusEl.style.display = 'block'
				return false
			} finally {
				modelsLoadPromise = null
			}
		})()
		return modelsLoadPromise
	}

	function renderVoiceUI() {
		const statusText = {
			idle: 'Tap to start listening',
			'loading-models': 'Loading models…',
			listening: 'Listening… speak now',
			processing: '',
			speaking: 'Speaking…',
		}
		if (voiceStatus) {
			voiceStatus.textContent = statusText[voiceState] ?? voiceState
			voiceStatus.style.display = voiceStatus.textContent ? '' : 'none'
		}
		if (voiceOrb) {
			const showOrb = voiceState === 'listening' || voiceState === 'speaking'
			voiceOrb.style.display = showOrb ? '' : 'none'
			voiceOrb.className = 'maia-ai-voice-orb'
			if (voiceState === 'listening') voiceOrb.classList.add('listening')
			else if (voiceState === 'speaking') voiceOrb.classList.add('speaking')
		}
		voiceActions.innerHTML = ''
		if (voiceState === 'idle' || voiceState === 'loading-models') {
			const btn = document.createElement('button')
			btn.type = 'button'
			btn.className = 'maia-ai-voice-btn'
			btn.textContent = 'Send voice note'
			btn.disabled = voiceState === 'loading-models'
			btn.onclick = () => startListening()
			voiceActions.appendChild(btn)
		}
		// When listening/processing/speaking: use center X button to close (collapseTab → stopListening)
	}

	function stopListening() {
		if (micRef) {
			micRef.stop()
			micRef = null
		}
		if (vadUnsub) {
			vadUnsub()
			vadUnsub = null
		}
		voiceState = 'idle'
		renderVoiceUI()
	}

	async function processSpeechSegment(samples) {
		if (micRef) {
			micRef.stop()
			micRef = null
		}
		if (vadUnsub) {
			vadUnsub()
			vadUnsub = null
		}
		voiceState = 'processing'
		renderVoiceUI()
		messages.push({ role: 'user', text: '' })
		messages.push({ role: 'assistant', text: '' })
		const userIdx = messages.length - 2
		const assistantIdx = messages.length - 1
		renderMessages()

		try {
			const { text: userText } = await transcribeVoice(samples, { sampleRate: 16000 })
			messages[userIdx].text = userText || ''
			renderMessages()
			if (!userText) {
				messages[assistantIdx].text = '(No speech detected)'
				renderMessages()
				voiceState = 'idle'
				renderVoiceUI()
				collapseTab()
				return
			}

			const llmResult = await generateWithTools(userText, {
				maxTokens: 150,
				temperature: 0.3,
				systemPrompt:
					'You are a helpful voice assistant. Keep responses concise — 1-2 sentences max. For time or date questions you MUST call get_current_time — never guess or invent a time.',
			})

			let display = llmResult.text?.trim() || ''
			const toolNames = []
			if (llmResult.toolCalls?.length > 0 && llmResult.toolResults?.length > 0) {
				for (let i = 0; i < llmResult.toolCalls.length; i++) {
					const tc = llmResult.toolCalls[i]
					const tr = llmResult.toolResults[i]
					if (tc?.toolName) toolNames.push(tc.toolName)
					const resStr = tr?.success && tr?.result ? JSON.stringify(tr.result) : tr?.error || '?'
					display += `\n\n[Tool: ${tc?.toolName || '?'} → ${resStr}]`
				}
			}

			messages[assistantIdx] = {
				role: 'assistant',
				text: display || '(No response)',
				toolCalls: toolNames,
			}
			renderMessages()

			const textToSpeak = llmResult.text?.trim() || ''
			if (textToSpeak) {
				voiceState = 'speaking'
				renderVoiceUI()
				const { audioData, sampleRate } = await synthesizeVoice(textToSpeak, { speed: 1.0 })
				const player = new AudioPlayback({ sampleRate })
				await player.play(audioData, sampleRate)
				player.dispose()
			}
		} catch (err) {
			messages[assistantIdx].text = `Error: ${err?.message || String(err)}`
			renderMessages()
		}
		voiceState = 'idle'
		renderVoiceUI()
		collapseTab()
	}

	async function startListening() {
		const ok = await ensureAllModels()
		if (!ok) return
		voiceState = 'listening'
		renderVoiceUI()
		const mic = new AudioCapture({ sampleRate: 16000 })
		micRef = mic
		VAD.reset()
		vadUnsub = VAD.onSpeechActivity((activity) => {
			if (activity === SpeechActivity.Ended) {
				const segment = VAD.popSpeechSegment()
				if (segment && segment.samples.length >= 1600) {
					processSpeechSegment(segment.samples)
				}
			}
		})
		await mic.start(
			(chunk) => {
				VAD.processSamples(chunk)
			},
			(level) => {
				if (voiceOrb && voiceState === 'listening') {
					voiceOrb.style.transform = `scale(${1 + level * 0.3})`
				}
			},
		)
	}

	function openTextTab() {
		tabState = 'text'
		stopListening()
		if (!isAllReady()) ensureAllModels()
		updateTabContent()
		promptEl?.focus()
	}

	function openVoiceTab() {
		tabState = 'voice'
		if (!isAllReady()) ensureAllModels()
		updateTabContent()
		if (isAllReady()) startListening()
	}

	async function sendMessage() {
		const text = (promptEl?.value || '').trim()
		if (!text) return

		if (!isAllReady()) {
			const ok = await ensureAllModels()
			if (!ok) return
		}

		messages.push({ role: 'user', text })
		messages.push({ role: 'assistant', text: '' })
		renderMessages()
		promptEl.value = ''
		sendBtn.disabled = true

		const assistantIdx = messages.length - 1

		try {
			const result = await generateWithTools(text, {
				maxTokens: 512,
				temperature: 0.3,
				systemPrompt:
					'You are a helpful assistant. Be concise. For time or date questions, you MUST call get_current_time — never guess or invent a time.',
			})

			let display = result.text?.trim() || ''
			const toolNames = []
			if (result.toolCalls?.length > 0 && result.toolResults?.length > 0) {
				for (let i = 0; i < result.toolCalls.length; i++) {
					const tc = result.toolCalls[i]
					const tr = result.toolResults[i]
					if (tc?.toolName) toolNames.push(tc.toolName)
					const resStr = tr?.success && tr?.result ? JSON.stringify(tr.result) : tr?.error || '?'
					display += `\n\n[Tool: ${tc?.toolName || '?'} → ${resStr}]`
				}
			}
			messages[assistantIdx] = {
				role: 'assistant',
				text: display || '(No response)',
				toolCalls: toolNames,
			}
			renderMessages()
		} catch (err) {
			messages[assistantIdx].text = `Error: ${err?.message || String(err)}`
			renderMessages()
		} finally {
			sendBtn.disabled = false
			collapseTab()
		}
	}

	window.__maiaAIRetryModel = () => ensureAllModels()

	let lastTap = 0
	centerBtn?.addEventListener('click', () => {
		if (tabState !== 'collapsed') {
			collapseTab()
			return
		}
		const now = Date.now()
		if (now - lastTap < 400) {
			lastTap = 0
			openVoiceTab()
			return
		}
		lastTap = now
		setTimeout(() => {
			if (lastTap > 0 && Date.now() - lastTap >= 400) {
				openTextTab()
			}
		}, 400)
	})

	sendBtn?.addEventListener('click', () => sendMessage())
	promptEl?.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			sendMessage()
		}
	})

	window._maiaAIDispose = () => {
		stopListening()
		modelsLoadPromise = null
		window._maiaAIDispose = null
	}

	const homeBtn = document.querySelector('.home-btn')
	if (homeBtn) {
		homeBtn.onclick = () => {
			if (typeof window._maiaAIDispose === 'function') {
				window._maiaAIDispose()
			}
			navigateToScreen('dashboard')
		}
	}

	try {
		await initialize({ environment: 'development', debug: false })
		showReady(true)
	} catch (err) {
		statusEl.textContent = `Failed to initialize: ${escapeHtml(err?.message || String(err))}`
		showReady(false)
	}
}
