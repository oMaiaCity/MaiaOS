/**
 * @MaiaOS/maia-ai — On-device local LLM and voice via RunAnywhere Web SDK
 * Thin wrapper around @runanywhere/web + @runanywhere/web-llamacpp + @runanywhere/web-onnx.
 */

import {
	AudioCapture,
	AudioPlayback,
	EventBus,
	LLMFramework,
	ModelCategory,
	ModelManager,
	ModelStatus,
	RunAnywhere,
	SpeechActivity,
	VoicePipeline,
} from '@runanywhere/web'
import {
	fromToolValue,
	LlamaCPP,
	LlamaCppBridge,
	TextGeneration,
	ToolCalling,
	toToolValue,
} from '@runanywhere/web-llamacpp'
import { ONNX, SherpaONNXBridge, STT, TTS, VAD } from '@runanywhere/web-onnx'

/** Re-export for consumers */
export { VoicePipeline, AudioCapture, AudioPlayback, VAD, SpeechActivity }

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

/**
 * Synthesize text to speech (TTS).
 * @param {string} text - Text to speak
 * @param {object} [opts] - { speed: number } (default 1.0)
 * @returns {Promise<{ audioData: Float32Array, sampleRate: number }>}
 */
export async function synthesizeVoice(text, opts = {}) {
	if (!initialized) await initialize()
	const result = await TTS.synthesize(text.trim(), { speed: opts.speed ?? 1.0 })
	return { audioData: result.audioData, sampleRate: result.sampleRate }
}

/** Whether SDK has been initialized */
let initialized = false

/**
 * Initialize the RunAnywhere SDK and register LlamaCPP + ONNX backends.
 * Configures WASM URLs to point to /runanywhere-wasm/ (served by dev-server and production).
 * @param {object} [opts] - Optional: { environment: 'development'|'production', debug: boolean }
 */
export async function initialize(opts = {}) {
	if (initialized) return
	await RunAnywhere.initialize({
		environment: opts.environment ?? 'development',
		debug: opts.debug ?? false,
	})
	const base =
		typeof window !== 'undefined' ? `${window.location.origin}/runanywhere-wasm/` : MAIA_AI_WASM_BASE
	LlamaCppBridge.shared.wasmUrl = `${base}racommons-llamacpp.js`
	LlamaCppBridge.shared.webgpuWasmUrl = `${base}racommons-llamacpp-webgpu.js`
	await LlamaCPP.register({ acceleration: 'webgpu' })
	ToolCalling.registerTool(
		{
			name: 'get_current_time',
			description:
				'Returns the current date and time. MUST be called when the user asks for the time, date, or "now". Never guess—always use this tool.',
			parameters: [],
			category: 'Utility',
		},
		async () => ({
			time: toToolValue(new Date().toISOString()),
			timezone: toToolValue(Intl.DateTimeFormat().resolvedOptions().timeZone),
		}),
	)
	SherpaONNXBridge.shared.wasmUrl = `${base}sherpa/sherpa-onnx-glue.js`
	await ONNX.register()
	initialized = true
}

/** Default LLM model (LFM2.5 1.2B Instruct from Liquid AI — tool use out of the box, best-in-class at 1B scale) */
export const DEFAULT_MODEL = {
	id: 'lfm2.5-1.2b-instruct-q4_k_m',
	name: 'LFM2.5 1.2B Instruct Q4_K_M',
	repo: 'LiquidAI/LFM2.5-1.2B-Instruct-GGUF',
	files: ['LFM2.5-1.2B-Instruct-Q4_K_M.gguf'],
	framework: LLMFramework.LlamaCpp,
	modality: ModelCategory.Language,
	memoryRequirement: 800_000_000,
}

/** Voice pipeline models (VAD, STT, TTS). LLM reuses DEFAULT_MODEL. */
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
	{
		id: 'vits-piper-en_GB-alba-medium',
		name: 'Piper TTS British English (Alba)',
		url: 'https://huggingface.co/runanywhere/vits-piper-en_GB-alba-medium/resolve/main/vits-piper-en_GB-alba-medium.tar.gz',
		framework: LLMFramework.ONNX,
		modality: ModelCategory.SpeechSynthesis,
		memoryRequirement: 65_000_000,
		artifactType: 'archive',
	},
]

/**
 * Register and optionally download+load a model.
 * @param {object} modelDef - Model definition: { id, name, url } or { id, name, repo, files, ... }
 * @param {boolean} [downloadAndLoad=true] - If true, download then load the model
 */
export async function registerAndLoadModel(modelDef = DEFAULT_MODEL, downloadAndLoad = true) {
	if (!initialized) await initialize()
	RunAnywhere.registerModels([modelDef])
	if (downloadAndLoad) {
		await ModelManager.refreshDownloadStatus()
		const model = RunAnywhere.availableModels().find((m) => m.id === modelDef.id)
		if (model?.status === ModelStatus.Downloaded) {
			await RunAnywhere.loadModel(modelDef.id)
		} else {
			await RunAnywhere.downloadModel(modelDef.id)
			await RunAnywhere.loadModel(modelDef.id)
		}
	}
}

/**
 * Load a model by ID (must be registered and downloaded first).
 * @param {string} modelId - Model ID from registerAndLoadModel
 */
export async function loadModel(modelId) {
	if (!initialized) await initialize()
	await RunAnywhere.loadModel(modelId)
}

/**
 * Check if an LLM model is loaded.
 */
export function isModelLoaded() {
	return TextGeneration.isModelLoaded
}

/**
 * Generate a complete response (non-streaming).
 * @param {string} prompt - User prompt
 * @param {object} [opts] - Optional: { maxTokens, temperature, systemPrompt }
 * @returns {Promise<{ text: string }>}
 */
export async function generate(prompt, opts = {}) {
	const result = await TextGeneration.generate(prompt, opts)
	return { text: result.text }
}

/** Format tool definitions for LFM2 prompt (per RunAnywhere docs). Use actual tool names in examples to avoid the model copying placeholders. */
function formatToolsForPromptLFM2(tools) {
	if (tools.length === 0) return ''
	const toolNames = tools.map((t) => t.name)
	const descriptions = tools
		.map((t) => {
			const params = t.parameters
				.map(
					(p) =>
						`    - ${p.name} (${p.type}${p.required !== false ? ' (required)' : ' (optional)'}): ${p.description}`,
				)
				.join('\n')
			return `  ${t.name}: ${t.description}\n    Parameters:\n${params || '    (none)'}`
		})
		.join('\n\n')
	// Use real tool names in examples — placeholder "tool_name" causes small models to call it literally
	const exampleTool = toolNames[0] ?? 'get_current_time'
	const exampleWithArgs = tools.some((t) => t.parameters?.length > 0)
		? `[${exampleTool}(arg="value")]`
		: `[${exampleTool}()]`
	return `You have access to the following tools:\n\n${descriptions}\n\nTo use a tool, respond with:\n<|tool_call_start|>${exampleWithArgs}<|tool_call_end|>\n\nExample for time queries: <|tool_call_start|>[get_current_time()]<|tool_call_end|>\n\nIf no tool is needed, respond normally.`
}

/** Parse LFM2 format tool call from LLM output. */
function parseLFM2ToolCall(llmOutput) {
	const lfm2Match = llmOutput.match(
		/<\|tool_call_start\|>\s*\[(\w+)\((.*?)\)\]\s*<\|tool_call_end\|>/,
	)
	if (!lfm2Match) return { text: llmOutput.trim(), toolCall: null }
	const [, funcName, argsStr] = lfm2Match
	const cleanText = llmOutput.replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/, '').trim()
	const args = {}
	for (const m of argsStr.matchAll(/(\w+)="([^"]*)"/g)) {
		args[m[1]] = { type: 'string', value: m[2] }
	}
	return {
		text: cleanText,
		toolCall: { toolName: funcName, arguments: args, callId: `call_${Date.now()}` },
	}
}

/** Build follow-up prompt after tool execution (per RunAnywhere docs). */
function buildFollowUpPromptLFM2(originalPrompt, toolName, resultJson) {
	return `The user asked: "${originalPrompt}"\n\nYou used the ${toolName} tool and received this data:\n${resultJson}\n\nNow provide a helpful, natural response to the user based on this information.`
}

/** Collect full text from stream (non-streaming path for tool orchestration). */
async function collectStream(prompt, opts) {
	const { stream } = await TextGeneration.generateStream(prompt, opts)
	let text = ''
	for await (const token of stream) text += token
	return { text }
}

/**
 * Generate response with tool calling support (non-streaming).
 * Uses TextGeneration.generateStream with proper systemPrompt so the LLM receives
 * tool definitions in the system role (RunAnywhere's ToolCalling concatenates
 * into prompt, causing system_prompt_len=0). Keeps LFM2.5 Instruct model.
 * @param {string} prompt - User prompt
 * @param {object} [opts] - Optional: { maxTokens, temperature, systemPrompt }
 * @returns {Promise<{ text: string, toolCalls: Array, toolResults: Array, isComplete: boolean }>}
 */
export async function generateWithTools(prompt, opts = {}) {
	if (!initialized) await initialize()
	const baseSystemPrompt = opts.systemPrompt ?? 'You are a helpful assistant. Be concise.'
	const maxToolCalls = opts.maxToolCalls ?? 5
	const autoExecute = opts.autoExecute ?? true
	const tools = opts.tools ?? ToolCalling.getRegisteredTools()
	const toolsPrompt = formatToolsForPromptLFM2(tools)
	const systemPrompt = `${baseSystemPrompt}\n\n${toolsPrompt}`

	const allToolCalls = []
	const allToolResults = []
	let finalText = ''
	let currentPrompt = prompt

	for (let i = 0; i < maxToolCalls; i++) {
		const genResult = await collectStream(currentPrompt, {
			systemPrompt,
			maxTokens: opts.maxTokens ?? 512,
			temperature: opts.temperature ?? 0.3,
		})
		const { text, toolCall } = parseLFM2ToolCall(genResult.text)
		finalText = text
		if (!toolCall) break

		allToolCalls.push(toolCall)
		if (!autoExecute) {
			return {
				text: finalText,
				toolCalls: allToolCalls,
				toolResults: [],
				isComplete: false,
			}
		}

		const result = await ToolCalling.executeTool(toolCall)
		allToolResults.push(result)
		const resultJson =
			result.success && result.result
				? JSON.stringify(
						Object.fromEntries(Object.entries(result.result).map(([k, v]) => [k, fromToolValue(v)])),
					)
				: JSON.stringify({ error: result.error ?? 'Unknown error' })
		currentPrompt = buildFollowUpPromptLFM2(prompt, toolCall.toolName, resultJson)
	}

	return {
		text: finalText,
		toolCalls: allToolCalls,
		toolResults: allToolResults,
		isComplete: true,
	}
}

/** Path where RunAnywhere WASM files are served (for SDK locateFile / config) */
export const MAIA_AI_WASM_BASE = '/runanywhere-wasm/'

/** Model IDs required for voice pipeline (VAD, STT, LLM, TTS) */
export const VOICE_MODEL_IDS = [
	'silero-vad-v5',
	'sherpa-onnx-whisper-tiny.en',
	'lfm2.5-1.2b-instruct-q4_k_m',
	'vits-piper-en_GB-alba-medium',
]

/** Human-readable labels for voice pipeline models (for progress UI) */
export const VOICE_MODEL_LABELS = {
	'silero-vad-v5': 'VAD',
	'sherpa-onnx-whisper-tiny.en': 'STT',
	'lfm2.5-1.2b-instruct-q4_k_m': 'LLM',
	'vits-piper-en_GB-alba-medium': 'TTS',
}

/**
 * Ensure all models (LLM + VAD + STT + TTS) are loaded with coexist: true.
 * One shared LLM instance powers both text and voice modes.
 * Downloads missing models in parallel, then loads each (sequential for coexist).
 * @param {(modelId: string, data: { phase?: 'downloading'|'loading'|'done', progress?: number, bytesDownloaded?: number, totalBytes?: number }) => void} [onProgress] - Progress callback per model
 * @param {(phase: 'storage-setup'|'storage-done') => void} [onStoragePhase] - Storage/OPFS setup phase callback
 */
export async function ensureAllModelsLoaded(onProgress, onStoragePhase) {
	if (!initialized) await initialize()
	const allModels = [...VOICE_MODELS, DEFAULT_MODEL]
	RunAnywhere.registerModels(allModels)
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

	// Download missing models sequentially (required for progress events)
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

	// Load LLM first (largest, ~800MB) so text mode is ready sooner; then VAD/STT/TTS for voice
	const loadOrder = [
		'lfm2.5-1.2b-instruct-q4_k_m',
		'silero-vad-v5',
		'sherpa-onnx-whisper-tiny.en',
		'vits-piper-en_GB-alba-medium',
	]
	for (const modelId of loadOrder) {
		const model = RunAnywhere.availableModels().find((m) => m.id === modelId)
		if (!model) continue
		if (model.status === ModelStatus.Loaded) continue
		if (onProgress) onProgress(modelId, { phase: 'loading' })
		await ModelManager.loadModel(modelId, {
			coexist: true,
			...(modelId === 'lfm2.5-1.2b-instruct-q4_k_m' && { contextSize: 8192 }),
		})
		if (onProgress) onProgress(modelId, { phase: 'done' })
	}
}

/** @deprecated Use ensureAllModelsLoaded. Kept for backwards compatibility. */
export async function ensureVoiceModelsLoaded(onProgress, onStoragePhase) {
	return ensureAllModelsLoaded(onProgress, onStoragePhase)
}

/**
 * Create a VoicePipeline instance for STT → LLM → TTS processing.
 */
export function createVoicePipeline() {
	return new VoicePipeline()
}

/**
 * Check if all 4 voice pipeline models are loaded.
 */
export function isVoiceModelsLoaded() {
	return !!(
		ModelManager.getLoadedModel(ModelCategory.Audio) &&
		ModelManager.getLoadedModel(ModelCategory.SpeechRecognition) &&
		ModelManager.getLoadedModel(ModelCategory.Language) &&
		ModelManager.getLoadedModel(ModelCategory.SpeechSynthesis)
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
