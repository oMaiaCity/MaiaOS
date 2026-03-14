/**
 * @MaiaOS/maia-ai — On-device VAD + STT via RunAnywhere Web SDK
 * Thin wrapper around @runanywhere/web + @runanywhere/web-onnx.
 */

import {
	AudioCapture,
	EventBus,
	LLMFramework,
	ModelCategory,
	ModelManager,
	ModelStatus,
	RunAnywhere,
	SpeechActivity,
} from '@runanywhere/web'
import { ONNX, SherpaONNXBridge, STT, VAD } from '@runanywhere/web-onnx'

/** Re-export for consumers */
export { AudioCapture, VAD, SpeechActivity }

/**
 * Transcribe audio to text (STT). Use after VAD detects speech end.
 * @param {Float32Array} audioSamples - Raw audio samples
 * @param {object} [opts] - { sampleRate: number } (default 16000)
 * @returns {Promise<{ text: string }>}
 */
export async function transcribeVoice(audioSamples, opts = {}) {
	if (!initialized) await initialize()
	const result = await STT.transcribe(audioSamples, { sampleRate: opts.sampleRate ?? 16000 })
	return { text: result?.text?.trim() ?? '' }
}

/** Whether SDK has been initialized */
let initialized = false

/**
 * Initialize the RunAnywhere SDK and register ONNX backend.
 * Configures WASM URLs to point to /runanywhere-wasm/ (served by dev-server and production).
 * @param {object} [opts] - Optional: { environment, debug }
 */
export async function initialize(opts = {}) {
	if (initialized) return
	await RunAnywhere.initialize({
		environment: opts.environment ?? 'development',
		debug: opts.debug ?? false,
	})
	const base =
		typeof window !== 'undefined' ? `${window.location.origin}/runanywhere-wasm/` : MAIA_AI_WASM_BASE
	SherpaONNXBridge.shared.wasmUrl = `${base}sherpa/sherpa-onnx-glue.js`
	await ONNX.register()
	initialized = true
}

/** VAD + STT models */
export const VOICE_MODELS = [
	{
		id: 'silero-vad-v5',
		name: 'Silero VAD v5',
		url: 'https://huggingface.co/runanywhere/silero-vad-v5/resolve/main/silero_vad.onnx',
		files: ['silero_vad.onnx'],
		framework: LLMFramework.ONNX,
		modality: ModelCategory.Audio,
		memoryRequirement: 5_000_000,
	},
	{
		id: 'sherpa-onnx-whisper-tiny.en',
		name: 'Whisper Tiny English',
		url: 'https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz',
		framework: LLMFramework.ONNX,
		modality: ModelCategory.SpeechRecognition,
		memoryRequirement: 105_000_000,
		artifactType: 'archive',
	},
]

/** Path where RunAnywhere WASM files are served (for SDK locateFile / config) */
export const MAIA_AI_WASM_BASE = '/runanywhere-wasm/'

/** Model IDs required for VAD + STT pipeline */
export const VOICE_MODEL_IDS = ['silero-vad-v5', 'sherpa-onnx-whisper-tiny.en']

/** Human-readable labels for VAD + STT models (for progress UI) */
export const VOICE_MODEL_LABELS = {
	'silero-vad-v5': 'VAD',
	'sherpa-onnx-whisper-tiny.en': 'STT',
}

/**
 * Ensure VAD + STT models are loaded.
 * Downloads missing models in parallel, then loads each (sequential for coexist).
 * @param {(modelId: string, data: { phase?: 'downloading'|'loading'|'done', progress?: number, bytesDownloaded?: number, totalBytes?: number }) => void} [onProgress] - Progress callback per model
 * @param {(phase: 'storage-setup'|'storage-done') => void} [onStoragePhase] - Storage/OPFS setup phase callback
 */
export async function ensureAllModelsLoaded(onProgress, onStoragePhase) {
	if (!initialized) await initialize()
	RunAnywhere.registerModels(VOICE_MODELS)
	if (onStoragePhase) onStoragePhase('storage-setup')
	await ModelManager.refreshDownloadStatus()
	if (onStoragePhase) onStoragePhase('storage-done')

	const needDownload = []
	for (const modelId of VOICE_MODEL_IDS) {
		const model = RunAnywhere.availableModels().find((m) => m.id === modelId)
		if (model?.status !== ModelStatus.Downloaded && model?.status !== ModelStatus.Loaded) {
			needDownload.push(modelId)
		}
	}

	if (needDownload.length > 0) {
		let currentModelId = null
		const unsub = onProgress
			? EventBus.shared.on('model.downloadProgress', (data) => {
					if (currentModelId) onProgress(currentModelId, { ...data, phase: 'downloading' })
				})
			: () => {}
		for (const modelId of needDownload) {
			currentModelId = modelId
			if (onProgress) onProgress(modelId, { phase: 'downloading', progress: 0 })
			await RunAnywhere.downloadModel(modelId)
			if (onProgress) onProgress(modelId, { phase: 'downloading', progress: 1 })
		}
		currentModelId = null
		unsub()
		await ModelManager.refreshDownloadStatus()
	}

	const loadOrder = ['silero-vad-v5', 'sherpa-onnx-whisper-tiny.en']
	for (const modelId of loadOrder) {
		const model = RunAnywhere.availableModels().find((m) => m.id === modelId)
		if (!model) continue
		if (model.status === ModelStatus.Loaded) continue
		if (onProgress) onProgress(modelId, { phase: 'loading' })
		await ModelManager.loadModel(modelId, { coexist: true })
		if (onProgress) onProgress(modelId, { phase: 'done' })
	}
}

/** @deprecated Use ensureAllModelsLoaded. Kept for backwards compatibility. */
export async function ensureVoiceModelsLoaded(onProgress, onStoragePhase) {
	return ensureAllModelsLoaded(onProgress, onStoragePhase)
}

/**
 * Check if VAD + STT models are loaded.
 */
export function isVoiceModelsLoaded() {
	return !!(
		ModelManager.getLoadedModel(ModelCategory.Audio) &&
		ModelManager.getLoadedModel(ModelCategory.SpeechRecognition)
	)
}

/**
 * Subscribe to model download progress. Used to show progress bar during model download.
 * @param {(event: { progress: number, bytesDownloaded: number, totalBytes: number, stage?: string }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onDownloadProgress(callback) {
	return EventBus.shared.on('model.downloadProgress', (data) => {
		callback(data)
	})
}
