/**
 * Voice page - Real-time speech-to-text via MoonshineJS
 * Uses maia-voice (MicrophoneTranscriber) for on-device transcription.
 */

import { createMicrophoneTranscriber, isVoiceSupported } from '@MaiaOS/maia-voice'
import { escapeHtml, getSyncStatusMessage, truncate } from './utils.js'

let transcriberRef = null

/**
 * Render the voice page with Start/Stop and transcript display.
 * @param {Object} maia - MaiaOS instance (for header account display)
 * @param {Object} authState - { signedIn, accountID }
 * @param {Object} syncState - Sync state for status display
 * @param {function(string, Object): void} navigateToScreen - Navigate to screen
 */
export async function renderVoicePage(maia, authState, syncState, _navigateToScreen) {
	const accountId = maia?.id?.maiaId?.id || authState?.accountID || ''
	let accountDisplayName = truncate(accountId, 12)
	if (accountId?.startsWith('co_z') && maia?.db) {
		try {
			const { resolveAccountCoIdsToProfileNames } = await import('@MaiaOS/loader')
			const profileNames = await resolveAccountCoIdsToProfileNames(maia, [accountId])
			accountDisplayName = profileNames.get(accountId) ?? accountDisplayName
		} catch (_e) {}
	}

	document.getElementById('app').innerHTML = `
		<div class="db-container voice-container">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<h1>Voice</h1>
					</div>
					<div class="header-center">
						<img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" />
					</div>
					<div class="header-right">
						<div class="sync-status ${syncState.connected ? 'connected' : 'disconnected'}" title="${getSyncStatusMessage(syncState)}" aria-label="${getSyncStatusMessage(syncState)}">
							<span class="sync-dot"></span>
						</div>
						${
							authState.signedIn && accountId
								? `
							<button type="button" class="db-status db-status-name" title="Account: ${escapeHtml(accountId)}" onclick="window.toggleMobileMenu()" aria-label="Toggle account menu">${escapeHtml(accountDisplayName)}</button>
						`
								: ''
						}
					</div>
				</div>
			</header>

			<div class="voice-main">
				<div class="voice-controls whitish-card">
					<button type="button" id="voice-asr-btn" class="voice-asr-btn voice-asr-idle ${!isVoiceSupported() ? 'voice-asr-disabled' : ''}" data-state="idle" aria-label="Start voice input" ${!isVoiceSupported() ? 'disabled aria-disabled="true"' : ''}>
						<svg class="voice-asr-icon voice-asr-icon-mic" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
							<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
							<line x1="12" y1="19" x2="12" y2="23"/>
							<line x1="8" y1="23" x2="16" y2="23"/>
						</svg>
						<svg class="voice-asr-icon voice-asr-icon-loader" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10" stroke-dasharray="16 48" stroke-linecap="round" />
						</svg>
						<svg class="voice-asr-icon voice-asr-icon-close" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"/>
							<line x1="6" y1="6" x2="18" y2="18"/>
						</svg>
					</button>
				</div>
				<div id="voice-transcript" class="voice-transcript whitish-card ${!isVoiceSupported() ? 'voice-transcript-active' : ''}">
					${
						!isVoiceSupported()
							? '<p class="voice-unsupported">Voice works best in Chrome. Safari has known memory limits with on-device speech.</p>'
							: '<p class="voice-transcript-placeholder">Click Start to begin. Your speech will appear here in real time.</p>'
					}
				</div>
			</div>

			<div class="bottom-navbar">
				<div class="bottom-navbar-left"></div>
				<div class="bottom-navbar-center">
					<button type="button" class="home-btn bottom-home-btn" onclick="window.navigateTo('/me')" title="Home">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
							<polyline points="9 22 9 12 15 12 15 22"/>
						</svg>
						<span class="home-label">Home</span>
					</button>
				</div>
				<div class="bottom-navbar-right"></div>
			</div>
		</div>
	`

	const asrBtn = document.getElementById('voice-asr-btn')
	const transcriptEl = document.getElementById('voice-transcript')

	function setAsrState(state) {
		asrBtn?.classList.remove(
			'voice-asr-idle',
			'voice-asr-request-mic',
			'voice-asr-loading',
			'voice-asr-ready',
			'voice-asr-listening',
		)
		asrBtn?.classList.add(`voice-asr-${state}`)
		asrBtn?.setAttribute('data-state', state)
	}

	if (transcriberRef) {
		transcriberRef.stop()
		transcriberRef = null
	}

	const voiceDebug =
		typeof window !== 'undefined' && window.location?.search?.includes('voice_debug=1')

	/** Wrap wake words in badge span for display. */
	function formatWithWakeWordBadge(text) {
		if (!text) return ''
		return escapeHtml(text).replace(
			/\b(hey\s+)?ma[iy]a\b/gi,
			() => '<span class="voice-wake-badge" aria-label="Wake word detected">Maia</span>',
		)
	}

	asrBtn?.addEventListener('click', async () => {
		const state = asrBtn?.getAttribute('data-state') || 'idle'
		if (state === 'ready' || state === 'listening') {
			if (transcriberRef) transcriberRef.stop()
			transcriberRef = null
			setAsrState('idle')
			return
		}
		if (state !== 'idle') return

		if (!isVoiceSupported()) {
			transcriptEl.innerHTML =
				'<p class="voice-unsupported">Voice works best in Chrome. Safari has known memory limits with on-device speech.</p>'
			transcriptEl.classList.remove('voice-transcript-placeholder')
			transcriptEl.classList.add('voice-transcript-active')
			return
		}

		try {
			setAsrState('request-mic')
			transcriptEl.innerHTML = ''
			transcriptEl.classList.remove('voice-transcript-placeholder')
			transcriptEl.classList.add('voice-transcript-active')

			let committedText = ''

			const transcriber = createMicrophoneTranscriber({
				useVAD: true,
				onPermissionsRequested: () => setAsrState('request-mic'),
				onModelLoadStarted: () => setAsrState('loading'),
				onModelLoaded: () => setAsrState('ready'),
				onTranscribeStarted: () => setAsrState('listening'),
				onTranscribeStopped: () => {
					transcriberRef = null
					setAsrState('idle')
				},
				onError: (err) => {
					console.error('[voice] Error:', err)
					transcriberRef = null
					setAsrState('idle')
					transcriptEl.innerHTML = `<p class="voice-error">${escapeHtml(err?.message || 'Error')}</p>`
				},
				onUpdate(text) {
					if (voiceDebug) console.log('[voice] onUpdate', JSON.stringify(text))
					const display = committedText
						? `${formatWithWakeWordBadge(committedText)} ${formatWithWakeWordBadge(text)}`
						: formatWithWakeWordBadge(text)
					transcriptEl.innerHTML =
						display || '<span class="voice-transcript-placeholder">Speaking…</span>'
				},
				onCommit(text) {
					if (voiceDebug) console.log('[voice] onCommit', JSON.stringify(text))
					if (text?.trim()) {
						committedText = committedText ? `${committedText} ${text}` : text
						transcriptEl.innerHTML = formatWithWakeWordBadge(committedText)
					}
				},
			})

			transcriberRef = transcriber
			await transcriber.start()
		} catch (err) {
			console.error('[voice] Start failed:', err)
			setAsrState('idle')
			transcriptEl.innerHTML = `<p class="voice-error">${escapeHtml(err?.message || 'Microphone permission denied.')}</p>`
			transcriptEl.classList.add('voice-transcript-placeholder')
			transcriberRef = null
		}
	})
}
