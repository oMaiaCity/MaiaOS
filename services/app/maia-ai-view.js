/**
 * Maia AI View — On-device VAD + STT voice-to-text
 * Uses @MaiaOS/maia-ai (RunAnywhere) for private, offline-capable transcription.
 */

import { resolveAccountCoIdsToProfiles } from '@MaiaOS/loader'
import {
	AudioCapture,
	ensureAllModelsLoaded,
	initialize,
	isVoiceModelsLoaded,
	SpeechActivity,
	transcribeVoice,
	VAD,
	VOICE_MODEL_IDS,
	VOICE_MODEL_LABELS,
} from '@MaiaOS/maia-ai'
import { escapeHtml, getProfileAvatarHtml, getSyncStatusMessage, truncate } from './utils.js'

export async function renderMaiaAIView(maia, authState, syncState, navigateToScreen) {
	const accountId = maia?.id?.maiaId?.id || ''
	let accountDisplayName = truncate(accountId, 12)
	let accountAvatarHtml = ''
	if (accountId?.startsWith('co_z') && maia?.do) {
		try {
			const profiles = await resolveAccountCoIdsToProfiles(maia, [accountId])
			const accountProfile = profiles.get(accountId) ?? null
			accountDisplayName = accountProfile?.name ?? accountDisplayName
			accountAvatarHtml = getProfileAvatarHtml(accountProfile?.image, {
				size: 44,
				className: 'navbar-avatar',
			})
		} catch (_e) {}
	}
	if (accountId && !accountAvatarHtml) {
		accountAvatarHtml = getProfileAvatarHtml(null, {
			size: 44,
			className: 'navbar-avatar',
			syncState,
		})
	}

	if (typeof window._maiaAIDispose === 'function') {
		window._maiaAIDispose()
		window._maiaAIDispose = null
	}

	const transcriptions = []
	let tabState = 'collapsed' // 'collapsed' | 'voice'
	let voiceState = 'idle' // idle | loading-models | listening | processing
	let micRef = null
	let vadUnsub = null
	let modelsLoadPromise = null

	document.getElementById('app').innerHTML = `
		<div class="db-container">
			<div class="navbar-section">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left"><h1>Maia AI</h1></div>
					<div class="header-center"><img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" /></div>
					<div class="header-right">
						${authState.signedIn ? (accountAvatarHtml ? `<div class="account-nav-group"><span class="account-display-name">${escapeHtml(accountDisplayName)}</span><button type="button" class="db-status account-menu-toggle" title="Account: ${accountId} (${getSyncStatusMessage(syncState)})" onclick="window.toggleMobileMenu()" aria-label="Toggle account menu">${accountAvatarHtml}</button></div>` : `<button type="button" class="db-status db-status-name account-menu-toggle" title="Account: ${accountId} (${getSyncStatusMessage(syncState)})" onclick="window.toggleMobileMenu()" aria-label="Toggle account menu">${escapeHtml(accountDisplayName)}</button>`) : ''}
					</div>
				</div>
			</header>
			<div class="mobile-menu" id="mobile-menu">
				${authState.signedIn && accountId ? `<div class="mobile-menu-account"><div class="mobile-menu-account-info"><span class="mobile-menu-account-name">${escapeHtml(accountDisplayName)}</span><div class="mobile-menu-account-id-row"><button type="button" class="mobile-menu-copy-id" title="Copy ID" data-copy-id="${escapeHtml(accountId)}" onclick="(function(btn){const id=btn.dataset.copyId;if(id)navigator.clipboard.writeText(id).then(()=>{btn.textContent='✓';setTimeout(()=>btn.textContent='⎘',800)});})(this)">⎘</button><code class="mobile-menu-account-id-value" title="${escapeHtml(accountId)}">${escapeHtml(accountId)}</code></div></div></div>` : ''}
				${authState.signedIn ? `<button class="mobile-menu-item sign-out-btn" onclick="window.handleSignOut(); window.toggleMobileMenu();">Sign Out</button>` : ''}
			</div>
			</div>

			<div class="vibe-viewer-main">
				<div class="maia-ai-chat">
					<div class="maia-ai-status" id="maia-ai-status">Initializing…</div>
					<div class="maia-ai-progress" id="maia-ai-progress" style="display:none;">
						<div class="maia-ai-progress-models" id="maia-ai-progress-models"></div>
					</div>
					<div class="maia-ai-messages" id="maia-ai-messages"></div>
					<div class="maia-ai-footer">
						<div class="maia-ai-tab" id="maia-ai-tab">
							<div class="maia-ai-tab-voice" id="maia-ai-tab-voice" style="display:none;">
								<div class="maia-ai-voice-orb" id="maia-ai-voice-orb"></div>
								<div class="maia-ai-voice-status" id="maia-ai-voice-status"></div>
								<div class="maia-ai-voice-actions" id="maia-ai-voice-actions"></div>
							</div>
							<div class="maia-ai-tab-load" id="maia-ai-tab-load" style="display:none;">
								<span class="maia-ai-loading-text">Loading model…</span>
							</div>
						</div>
						<button type="button" class="maia-ai-center-btn" id="maia-ai-center-btn" title="Start" aria-label="Start">
							<svg class="maia-ai-center-icon maia-ai-icon-mic" width="24" height="24" viewBox="0 0 24 24" fill="none"><path fill="currentColor" fill-opacity="0.16" d="m9.96 9.137l.886-3.099c.332-1.16 1.976-1.16 2.308 0l.885 3.099a1.2 1.2 0 0 0 .824.824l3.099.885c1.16.332 1.16 1.976 0 2.308l-3.099.885a1.2 1.2 0 0 0-.824.824l-.885 3.099c-.332 1.16-1.976 1.16-2.308 0l-.885-3.099a1.2 1.2 0 0 0-.824-.824l-3.099-.885c-1.16-.332-1.16-1.976 0-2.308l3.099-.885a1.2 1.2 0 0 0 .824-.824"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="m9.96 9.137l.886-3.099c.332-1.16 1.976-1.16 2.308 0l.885 3.099a1.2 1.2 0 0 0 .824.824l3.099.885c1.16.332 1.16 1.976 0 2.308l-3.099.885a1.2 1.2 0 0 0-.824.824l-.885 3.099c-.332 1.16-1.976 1.16-2.308 0l-.885-3.099a1.2 1.2 0 0 0-.824-.824l-3.099-.885c-1.16-.332-1.16-1.976 0-2.308l3.099-.885a1.2 1.2 0 0 0 .824-.824M4.43 4.283l.376-1.507c.05-.202.338-.202.388 0l.377 1.507a.2.2 0 0 0 .145.146l1.508.377c.202.05.202.337 0 .388l-1.508.377a.2.2 0 0 0-.145.145l-.377 1.508c-.05.202-.338.202-.388 0l-.377-1.508a.2.2 0 0 0-.145-.145l-1.508-.377c-.202-.05-.202-.338 0-.388l1.508-.377a.2.2 0 0 0 .145-.146M18.43 18.284l.376-1.508c.05-.202.337-.202.388 0l.377 1.508a.2.2 0 0 0 .145.145l1.508.377c.202.05.202.337 0 .388l-1.508.377a.2.2 0 0 0-.145.145l-.377 1.508c-.05.202-.337.202-.388 0l-.377-1.508a.2.2 0 0 0-.145-.145l-1.508-.377c-.202-.05-.202-.338 0-.388l1.508-.377a.2.2 0 0 0 .145-.145"/></svg>
							<svg class="maia-ai-center-icon maia-ai-icon-stop" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
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
	const tabVoice = document.getElementById('maia-ai-tab-voice')
	const tabLoad = document.getElementById('maia-ai-tab-load')
	const centerBtn = document.getElementById('maia-ai-center-btn')
	const voiceOrb = document.getElementById('maia-ai-voice-orb')
	const voiceStatus = document.getElementById('maia-ai-voice-status')
	const voiceActions = document.getElementById('maia-ai-voice-actions')

	function renderMessages() {
		messagesEl.innerHTML = transcriptions
			.map(
				(text) => `
			<div class="maia-ai-msg user" style="padding:0.75rem 1rem;border-radius:12px;max-width:85%;background:var(--marine-blue, #1e3a5f);color:white;margin-left:auto;">
				<div class="maia-ai-msg-text" style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(text)}</div>
			</div>
		`,
			)
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

	function collapseTab() {
		tabState = 'collapsed'
		stopListening()
		updateTabContent()
	}

	function updateCenterButton() {
		const isListening = voiceState === 'listening' || voiceState === 'processing'
		centerBtn?.querySelector('.maia-ai-icon-mic')?.classList.toggle('active', !isListening)
		centerBtn?.querySelector('.maia-ai-icon-stop')?.classList.toggle('active', isListening)
		centerBtn?.classList.toggle('maia-ai-center-btn-stop', isListening)
		const isExpanded = tabState !== 'collapsed'
		centerBtn?.setAttribute('title', isExpanded ? (isListening ? 'Stop' : 'Start') : 'Voice')
		centerBtn?.setAttribute('aria-label', isExpanded ? (isListening ? 'Stop' : 'Start') : 'Voice')
	}

	function updateTabContent() {
		tabVoice.style.display = 'none'
		tabLoad.style.display = 'none'
		if (tabState === 'collapsed') {
			tabEl?.classList.remove('expanded')
		} else {
			tabEl?.classList.add('expanded')
		}
		if (tabState === 'voice') {
			if (isVoiceModelsLoaded()) {
				tabVoice.style.display = 'flex'
				renderVoiceUI()
			} else {
				const loadText = tabLoad?.querySelector('.maia-ai-loading-text')
				if (loadText) loadText.textContent = 'Loading models…'
				tabLoad.style.display = 'flex'
			}
		}
		updateCenterButton()
	}

	function renderProgressBars(progressByModel, modelIds = VOICE_MODEL_IDS) {
		if (!progressModelsEl) return
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
		progressModelsEl.innerHTML = rowsHtml
	}

	async function ensureAllModels() {
		if (isVoiceModelsLoaded()) return true
		if (modelsLoadPromise) return modelsLoadPromise
		voiceState = 'loading-models'
		if (tabState === 'voice') renderVoiceUI()
		statusEl.textContent = 'Loading models…'
		statusEl.style.display = 'block'
		showProgress(true)
		const progressByModel = {}
		for (const id of VOICE_MODEL_IDS)
			progressByModel[id] = { phase: 'waiting', progress: 0, bytesDownloaded: 0, totalBytes: 0 }
		renderProgressBars(progressByModel, VOICE_MODEL_IDS)
		modelsLoadPromise = (async () => {
			try {
				await ensureAllModelsLoaded((modelId, data) => {
					if (data) {
						progressByModel[modelId] = { ...progressByModel[modelId], ...data }
						renderProgressBars(progressByModel, VOICE_MODEL_IDS)
					}
				})
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
			idle: 'Tap the button to start',
			'loading-models': 'Loading models…',
			listening: 'Listening… tap to stop',
			processing: 'Transcribing…',
		}
		if (voiceStatus) {
			voiceStatus.textContent = statusText[voiceState] ?? voiceState
			voiceStatus.style.display = voiceStatus.textContent ? '' : 'none'
		}
		if (voiceOrb) {
			const showOrb = voiceState === 'listening'
			voiceOrb.style.display = showOrb ? '' : 'none'
			voiceOrb.className = 'maia-ai-voice-orb'
			if (voiceState === 'listening') voiceOrb.classList.add('listening')
		}
		voiceActions.innerHTML = ''
		if (voiceState === 'idle' && tabState === 'voice') {
			const closeLink = document.createElement('button')
			closeLink.type = 'button'
			closeLink.className = 'maia-ai-voice-close'
			closeLink.textContent = 'Close'
			closeLink.onclick = () => collapseTab()
			voiceActions.appendChild(closeLink)
		}
		updateCenterButton()
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
		// VAD trigger = transcript moment only. Keep listening; user stops manually.
		voiceState = 'processing'
		renderVoiceUI()

		try {
			const { text } = await transcribeVoice(samples, { sampleRate: 16000 })
			if (text?.trim()) {
				transcriptions.push(text.trim())
				renderMessages()
			}
		} catch (err) {
			transcriptions.push(`Error: ${err?.message || String(err)}`)
			renderMessages()
		}
		voiceState = 'listening'
		renderVoiceUI()
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
			(chunk) => VAD.processSamples(chunk),
			(level) => {
				if (voiceOrb && voiceState === 'listening') {
					voiceOrb.style.transform = `scale(${1 + level * 0.3})`
				}
			},
		)
	}

	function openVoiceTab() {
		tabState = 'voice'
		if (!isVoiceModelsLoaded()) ensureAllModels()
		updateTabContent()
		if (isVoiceModelsLoaded()) startListening()
	}

	window.__maiaAIRetryModel = () => ensureAllModels()

	centerBtn?.addEventListener('click', () => {
		if (tabState === 'collapsed') {
			openVoiceTab()
			return
		}
		if (voiceState === 'listening' || voiceState === 'processing') {
			stopListening()
			return
		}
		if (voiceState === 'idle') {
			startListening()
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
