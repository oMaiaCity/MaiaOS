/**
 * LFM2.5-Audio ASR Demo
 *
 * Transcription only (speech → text) using ONNX Runtime Web.
 */

import { AudioModel, clearModelCache, getCacheInfo } from './audio-model.js'
import { MoonshineModel } from './moonshine-model.js'
import {
	createMoonshineStreamingTranscription,
	createStreamingTranscription,
} from './streaming-transcription.js'

// Models load from local public/ only (pre-download with download:model / download:moonshine)
const MODELS = {
	'LFM2.5-Audio-1.5B-Q4': {
		modelClass: AudioModel,
		path: '/LFM2.5-Audio-1.5B-ONNX',
		label: 'LFM2.5-Audio-1.5B Q4 (~1.6 GB)',
		quantization: { decoder: 'q4', audioEncoder: 'q4' },
	},
	'Moonshine-Streaming-medium': {
		modelClass: MoonshineModel,
		path: '/Moonshine-Streaming-medium',
		label: 'Moonshine Streaming Medium (~530 MB)',
		quantization: null,
	},
}

// DOM elements
const modelSelect = document.getElementById('modelSelect')
const loadBtn = document.getElementById('loadBtn')
const statusEl = document.getElementById('status')
const chatContainer = document.getElementById('chatContainer')
const progressBar = document.getElementById('progressBar')
const progressFill = document.getElementById('progressFill')
const progressText = document.getElementById('progressText')
const streamBtn = document.getElementById('streamBtn')
const clearCacheBtn = document.getElementById('clearCacheBtn')
const cacheInfoEl = document.getElementById('cacheInfo')

// State
let audioModel = null
let streamingVad = null
let streamingTranscriptEl = null
let isStreaming = false

// ============================================================================
// UI Helpers
// ============================================================================

function setStatus(text, type = '') {
	statusEl.textContent = text
	statusEl.className = type
}

function setLoading(loading) {
	loadBtn.disabled = loading
	modelSelect.disabled = loading
}

function setReady(ready) {
	streamBtn.disabled = !ready
}

function showProgress(show) {
	progressBar.style.display = show ? 'block' : 'none'
}

function updateProgress(percent, text) {
	progressFill.style.width = `${percent}%`
	progressText.textContent = text || `${percent}%`
}

function addMessage(role, content, isStreaming = false) {
	const msgEl = document.createElement('div')
	msgEl.className = `message ${role}${isStreaming ? ' generating' : ''}`

	const textEl = document.createElement('span')
	textEl.textContent = content
	msgEl.appendChild(textEl)

	chatContainer.appendChild(msgEl)
	chatContainer.scrollTop = chatContainer.scrollHeight
	return { msgEl, textEl }
}

async function updateCacheInfo() {
	if (!cacheInfoEl || !clearCacheBtn) return

	const info = await getCacheInfo()
	if (info && info.used > 0) {
		const usedMB = info.used / 1024 / 1024
		if (usedMB >= 1000) {
			cacheInfoEl.textContent = `${(usedMB / 1024).toFixed(1)} GB cached`
		} else if (usedMB >= 1) {
			cacheInfoEl.textContent = `${usedMB.toFixed(0)} MB cached`
		} else {
			cacheInfoEl.textContent = 'No models cached'
		}
		clearCacheBtn.disabled = usedMB < 1
	} else {
		cacheInfoEl.textContent = 'No models cached'
		clearCacheBtn.disabled = true
	}
}

// ============================================================================
// Model Loading
// ============================================================================

async function loadModel() {
	const modelKey = modelSelect.value
	const modelConfig = MODELS[modelKey]

	if (!modelConfig) {
		setStatus('Invalid model selection', 'error')
		return
	}

	setLoading(true)
	setReady(false)
	showProgress(true)
	updateProgress(0, 'Starting...')
	setStatus(`Loading ${modelConfig.label}...`)

	if (audioModel) {
		console.log('Disposing previous model...')
		audioModel.dispose()
		audioModel = null
	}
	chatContainer.innerHTML = ''

	try {
		const useWebGPU = !!navigator.gpu
		if (!useWebGPU) {
			console.warn('WebGPU not available, falling back to WASM (CPU)')
		}

		const device = useWebGPU ? 'webgpu' : 'wasm'
		setStatus(`Loading audio model (${device})...`)

		audioModel = new modelConfig.modelClass()
		await audioModel.load(modelConfig.path, {
			device,
			quantization: modelConfig.quantization ?? null,
			progressCallback: (progress) => {
				if (progress.status === 'loading') {
					updateProgress(progress.progress, `Loading ${progress.file}...`)
				} else if (progress.status === 'done') {
					updateProgress(100, 'Done')
				}
			},
		})

		showProgress(false)
		setStatus(`Ready! Audio model loaded on ${device === 'webgpu' ? 'WebGPU' : 'CPU'}`, 'success')
		setReady(true)
		updateCacheInfo()
	} catch (error) {
		console.error('Load error:', error)
		showProgress(false)
		const msg = error instanceof Error ? error.message : String(error)
		setStatus(`Error: ${msg}`, 'error')
		audioModel = null
	} finally {
		setLoading(false)
	}
}

// ============================================================================
// Event Handlers
// ============================================================================

loadBtn.addEventListener('click', loadModel)

streamBtn.addEventListener('click', async () => {
	if (!audioModel) return
	if (isStreaming) {
		streamingVad.destroy()
		streamingVad = null
		isStreaming = false
		streamBtn.textContent = 'Start'
		streamBtn.classList.remove('streaming')
		setStatus('Stream stopped', 'success')
		return
	}
	try {
		streamBtn.disabled = true
		const isMoonshine = modelSelect.value === 'Moonshine-Streaming-medium'
		setStatus(isMoonshine ? 'Starting Moonshine streaming...' : 'Starting VAD...', '')
		const { textEl } = addMessage('assistant', '', true)
		streamingTranscriptEl = textEl

		if (isMoonshine) {
			streamingVad = await createMoonshineStreamingTranscription({
				audioModel,
				onTranscript: (text) => {
					const sep = streamingTranscriptEl?.childNodes?.length ? ' ' : ''
					streamingTranscriptEl?.appendChild(document.createTextNode(sep + text))
					chatContainer.scrollTop = chatContainer.scrollHeight
				},
				onListeningChange: (listening) => {
					if (listening) {
						setStatus('Moonshine streaming... Speak to transcribe', 'success')
					}
				},
			})
		} else {
			streamingVad = await createStreamingTranscription({
				audioModel,
				onTranscript: (text) => {
					const sep = streamingTranscriptEl?.childNodes?.length ? ' ' : ''
					streamingTranscriptEl?.appendChild(document.createTextNode(sep + text))
					chatContainer.scrollTop = chatContainer.scrollHeight
				},
				onVadBoundary: () => {
					if (!streamingTranscriptEl) return
					const badge = document.createElement('span')
					badge.className = 'vad-badge'
					badge.textContent = 'VAD'
					streamingTranscriptEl.appendChild(document.createTextNode(' '))
					streamingTranscriptEl.appendChild(badge)
					streamingTranscriptEl.appendChild(document.createTextNode(' '))
					chatContainer.scrollTop = chatContainer.scrollHeight
				},
				onSpeechStart: () => {
					setStatus('Speaking...', 'success')
				},
				onListeningChange: (listening) => {
					if (listening) {
						setStatus('Listening... Speak to transcribe', 'success')
					}
				},
			})
			streamingVad.start()
		}
		isStreaming = true
		streamBtn.textContent = 'Stop'
		streamBtn.classList.add('streaming')
		setStatus('Listening... Speak to transcribe', 'success')
	} catch (err) {
		console.error('Stream start failed:', err)
		setStatus(`Stream error: ${err.message}`, 'error')
		if (streamingTranscriptEl) {
			streamingTranscriptEl.textContent = `Error: ${err.message}`
		}
	} finally {
		streamBtn.disabled = false
	}
})

clearCacheBtn.addEventListener('click', async () => {
	if (clearCacheBtn.disabled) return

	const info = await getCacheInfo()
	const usedMB = info ? (info.used / 1024 / 1024).toFixed(0) : 0
	const confirmed = confirm(
		`Delete downloaded model files?\n\n` +
			`This will free up ~${usedMB} MB of storage.\n` +
			`Models will be re-downloaded next time you load them.`,
	)
	if (!confirmed) return

	clearCacheBtn.textContent = 'Deleting...'
	await clearModelCache()
	clearCacheBtn.textContent = 'Delete Models'
	await updateCacheInfo()
	setStatus('Downloaded models deleted', 'success')
})

// Populate model dropdown
function populateModelDropdown() {
	modelSelect.innerHTML = ''
	let firstOption = null

	for (const [key, config] of Object.entries(MODELS)) {
		const option = document.createElement('option')
		option.value = key
		option.textContent = config.label
		modelSelect.appendChild(option)
		if (!firstOption) firstOption = option
	}

	if (firstOption) firstOption.selected = true
}

// Initialize
populateModelDropdown()
updateCacheInfo()

// Check WebGPU on load
;(async () => {
	if (!navigator.gpu) {
		setStatus(
			'WebGPU not available - will use CPU (WASM). For GPU acceleration, enable chrome://flags/#enable-unsafe-webgpu',
		)
		return
	}

	try {
		const adapter = await navigator.gpu.requestAdapter()
		if (!adapter) {
			setStatus('WebGPU adapter not found - will use CPU. Check chrome://gpu for WebGPU status.')
			return
		}

		const info = adapter.info || {}
		const desc = info.description || info.vendor || info.architecture || 'Available'
		setStatus(`WebGPU: ${desc}. Select model and click Load.`)
	} catch (e) {
		setStatus(`WebGPU error: ${e.message} - will use CPU.`)
	}
})()
