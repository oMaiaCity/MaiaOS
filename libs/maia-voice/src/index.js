/**
 * Maia Voice - On-device speech-to-text via MoonshineJS
 * Wraps MicrophoneTranscriber with a clean API for streaming transcription.
 */

import * as Moonshine from '@usefulsensors/moonshine-js'

// Add ?voice_debug=1 to URL for verbose maia-voice logs
const DEBUG = typeof window !== 'undefined' && window.location?.search?.includes('voice_debug=1')

/** Safari has stricter WASM memory limits; we don't fall back to tiny (bad quality). */
function isSafari() {
	if (typeof navigator === 'undefined') return false
	const ua = navigator.userAgent
	return (
		(ua.includes('Safari') && !ua.includes('Chrome')) || navigator.vendor === 'Apple Computer, Inc.'
	)
}

/** Matches "maia"/"maya" or "hey maia"/"hey maya" as wake words (STT often transcribes as Maya). */
const WAKE_WORD_RE = /\b(hey\s+)?ma[iy]a\b/i

function log(...args) {
	if (DEBUG) console.log('[maia-voice]', ...args)
}

/**
 * Create a microphone transcriber.
 *
 * @param {Object} opts - Options
 * @param {boolean} [opts.useVAD=true] - Use Voice Activity Detection. When true, only onCommit fires (at end of each
 *   speech segment). When false, both onUpdate (streaming) and onCommit fire.
 * @param {function(): void} [opts.onPermissionsRequested] - Called when mic permission is requested
 * @param {function(): void} [opts.onModelLoadStarted] - Called when model loading begins
 * @param {function(): void} [opts.onModelLoaded] - Called when model AND VAD are loaded (ready to transcribe)
 * @param {function(): void} [opts.onTranscribeStarted] - Called when mic is active and transcription has started
 * @param {function(): void} [opts.onTranscribeStopped] - Called when transcription stopped
 * @param {function(string): void} [opts.onUpdate] - Called on streaming transcript updates (only when useVAD=false)
 * @param {function(string): void} [opts.onCommit] - Called when a segment is committed (always; on pause with VAD)
 * @param {function(string): void} [opts.onWakeWordDetected] - Called when "Maia" or "Hey Maia" is detected in transcript
 * @param {function(any): void} [opts.onError] - Called on error
 * @returns {{ start: () => Promise<void>, stop: () => void }} Transcriber control
 */
export function isVoiceSupported() {
	return !isSafari()
}

export function createMicrophoneTranscriber(opts = {}) {
	const {
		onUpdate,
		onCommit,
		onWakeWordDetected,
		onPermissionsRequested,
		onModelLoadStarted,
		onModelLoaded,
		onTranscribeStarted,
		onTranscribeStopped,
		onError,
		useVAD = true,
	} = opts

	log('createMicrophoneTranscriber: useVAD=', useVAD)

	function checkWakeWord(text) {
		if (text && WAKE_WORD_RE.test(text) && typeof onWakeWordDetected === 'function') {
			onWakeWordDetected('maia')
		}
	}

	const transcriber = new Moonshine.MicrophoneTranscriber(
		'model/base',
		{
			onPermissionsRequested: () => {
				log('onPermissionsRequested')
				if (typeof onPermissionsRequested === 'function') onPermissionsRequested()
			},
			onModelLoadStarted: () => {
				log('onModelLoadStarted')
				if (typeof onModelLoadStarted === 'function') onModelLoadStarted()
			},
			onModelLoaded: () => {
				log('onModelLoaded')
				if (typeof onModelLoaded === 'function') onModelLoaded()
			},
			onTranscribeStarted: () => {
				log('onTranscribeStarted')
				if (typeof onTranscribeStarted === 'function') onTranscribeStarted()
			},
			onTranscribeStopped: () => {
				log('onTranscribeStopped')
				if (typeof onTranscribeStopped === 'function') onTranscribeStopped()
			},
			onError: (err) => {
				log('onError', err)
				if (typeof onError === 'function') onError(err)
			},
			onTranscriptionUpdated: (text) => {
				log('onTranscriptionUpdated', JSON.stringify(text))
				checkWakeWord(text)
				if (typeof onUpdate === 'function') onUpdate(text)
			},
			onTranscriptionCommitted: (text) => {
				log('onTranscriptionCommitted', JSON.stringify(text))
				checkWakeWord(text)
				if (typeof onCommit === 'function') onCommit(text)
			},
		},
		useVAD,
	)

	return {
		async start() {
			log('start() called')
			await transcriber.start()
			log('start() completed')
		},
		stop() {
			log('stop() called')
			transcriber.stop()
		},
	}
}
