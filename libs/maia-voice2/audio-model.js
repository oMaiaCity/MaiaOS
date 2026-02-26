/**
 * LFM2-Audio ASR Model Runner for ONNX Runtime Web
 *
 * Transcription only (speech → text). Uses:
 * 1. decoder.onnx - LFM2 backbone
 * 2. audio_encoder.onnx - Conformer encoder (mel → embeddings)
 * 3. embed_tokens - Text embedding lookup
 */

import { AutoTokenizer, env } from '@huggingface/transformers'
import * as ort from 'onnxruntime-web'
import { computeMelSpectrogram, loadAudioFile, loadMelConfig } from './audio-processor.js'

// Cache configuration
const CACHE_NAME = 'onnx-models-v1'
const IDB_NAME = 'onnx-model-cache'
const IDB_STORE = 'models'

// IndexedDB helpers for fallback caching
let idbPromise = null

function openIDB() {
	if (idbPromise) return idbPromise

	idbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(IDB_NAME, 1)
		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve(request.result)
		request.onupgradeneeded = (event) => {
			const db = event.target.result
			if (!db.objectStoreNames.contains(IDB_STORE)) {
				db.createObjectStore(IDB_STORE)
			}
		}
	})

	return idbPromise
}

async function idbGet(key) {
	try {
		const db = await openIDB()
		return new Promise((resolve, reject) => {
			const tx = db.transaction(IDB_STORE, 'readonly')
			const store = tx.objectStore(IDB_STORE)
			const request = store.get(key)
			request.onerror = () => reject(request.error)
			request.onsuccess = () => resolve(request.result)
		})
	} catch (_e) {
		return null
	}
}

async function idbSet(key, value) {
	try {
		const db = await openIDB()
		return new Promise((resolve, reject) => {
			const tx = db.transaction(IDB_STORE, 'readwrite')
			const store = tx.objectStore(IDB_STORE)
			const request = store.put(value, key)
			request.onerror = () => reject(request.error)
			request.onsuccess = () => resolve()
		})
	} catch (_e) {
		// Ignore cache write failures
	}
}

// Special tokens for ASR
const SPECIAL_TOKENS = {
	IM_END: 7, // <|im_end|>
}

const DEFAULT_SYSTEM_PROMPT_ASR = 'Perform ASR.'
const DEFAULT_MAX_TOKENS_TEXT = 100 // ASR mode

// Timestamped logging helper
let _logStartTime = null
function log(...args) {
	if (_logStartTime === null) {
		_logStartTime = performance.now()
	}
	const elapsed = ((performance.now() - _logStartTime) / 1000).toFixed(2)
	console.log(`[${elapsed}s]`, ...args)
}
function logReset() {
	_logStartTime = performance.now()
}

/** Small files to cache in IDB. Excludes onnx, onnx_data, embed_tokens.bin (large). */
const CACHEABLE_SUFFIXES = [
	'tokenizer.json',
	'tokenizer_config.json',
	'config.json',
	'embed_tokens.json',
]

function isCacheableUrl(url) {
	const fileName = url.split('/').pop() || ''
	return CACHEABLE_SUFFIXES.some((s) => fileName.endsWith(s))
}

/**
 * Fetch with caching support for small files only. IDB cache for tokenizer, config,
 * embed_tokens. Large onnx/onnx_data bypass cache and rely on browser HTTP cache.
 */
async function fetchWithCache(url, options = {}) {
	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return fetch(url, options)
	}

	const fileName = url.split('/').pop()

	if (!isCacheableUrl(url)) {
		return fetch(url, options)
	}

	if (typeof indexedDB !== 'undefined') {
		try {
			const cached = await idbGet(url)
			if (cached) {
				console.log(`[IDB HIT] ${fileName}`)
				return new Response(cached.data, {
					status: 200,
					headers: { 'Content-Type': cached.contentType || 'application/octet-stream' },
				})
			}
		} catch (e) {
			console.warn('IndexedDB read failed:', e)
		}
	}

	console.log(`[Cache MISS] Fetching ${fileName}...`)
	const response = await fetch(url, options)
	if (!response.ok) return response

	const data = await response.arrayBuffer()
	const contentType = response.headers.get('Content-Type') || 'application/octet-stream'

	if (typeof indexedDB !== 'undefined') {
		try {
			await idbSet(url, { data, contentType })
		} catch (_e) {
			// Ignore
		}
	}

	return new Response(data, { status: 200, headers: { 'Content-Type': contentType } })
}

/**
 * Clear the model cache (both Cache API and IndexedDB)
 */
export async function clearModelCache() {
	let deleted = false

	// Clear Cache API
	if (typeof caches !== 'undefined') {
		try {
			deleted = await caches.delete(CACHE_NAME)
		} catch (_e) {
			// Ignore
		}
	}

	// Clear IndexedDB
	if (typeof indexedDB !== 'undefined') {
		try {
			await new Promise((resolve, reject) => {
				const request = indexedDB.deleteDatabase(IDB_NAME)
				request.onerror = () => reject(request.error)
				request.onsuccess = () => resolve()
			})
			idbPromise = null // Reset the cached promise
			deleted = true
		} catch (_e) {
			// Ignore
		}
	}

	console.log(deleted ? 'Model cache cleared' : 'No cache to clear')
	return deleted
}

/**
 * Get cache storage usage info
 */
export async function getCacheInfo() {
	if ('storage' in navigator && 'estimate' in navigator.storage) {
		const estimate = await navigator.storage.estimate()
		return {
			used: estimate.usage || 0,
			available: estimate.quota || 0,
		}
	}
	return null
}

/**
 * Load tokenizer from model path
 */
async function loadTokenizerFromPath(modelPath) {
	console.log(`Loading tokenizer from ${modelPath}`)

	const [tokenizerResponse, configResponse] = await Promise.all([
		fetchWithCache(`${modelPath}/tokenizer.json`),
		fetchWithCache(`${modelPath}/tokenizer_config.json`),
	])

	if (!tokenizerResponse.ok) {
		throw new Error(`Failed to fetch tokenizer.json: ${tokenizerResponse.status}`)
	}
	if (!configResponse.ok) {
		throw new Error(`Failed to fetch tokenizer_config.json: ${configResponse.status}`)
	}

	const tokenizerJSON = await tokenizerResponse.text()
	const configJSON = await configResponse.text()

	// Parse tokenizer.json to extract special token IDs
	const tokenizerData = JSON.parse(tokenizerJSON)
	const specialTokens = {}

	if (tokenizerData.added_tokens) {
		for (const token of tokenizerData.added_tokens) {
			specialTokens[token.content] = token.id
		}
		console.log('Found special tokens:', Object.keys(specialTokens).length)
	}

	// Create tokenizer using transformers.js
	const fakeModelId = `tokenizer-${Date.now()}`

	const fileCache = {
		'tokenizer.json': tokenizerJSON,
		'tokenizer_config.json': configJSON,
	}

	const originalFetch = globalThis.fetch
	globalThis.fetch = async (input, init) => {
		const url = typeof input === 'string' ? input : input.url

		if (url.includes(fakeModelId)) {
			for (const [filename, content] of Object.entries(fileCache)) {
				if (url.includes(filename)) {
					return new Response(content, {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					})
				}
			}
			return new Response('Not found', { status: 404 })
		}

		return originalFetch(input, init)
	}

	const originalAllowLocal = env.allowLocalModels
	env.allowLocalModels = false

	try {
		const tokenizer = await AutoTokenizer.from_pretrained(fakeModelId)
		console.log('Tokenizer created successfully')
		return { tokenizer, specialTokens }
	} finally {
		globalThis.fetch = originalFetch
		env.allowLocalModels = originalAllowLocal
	}
}

export class AudioModel {
	constructor() {
		this.tokenizer = null
		this.decoderSession = null
		this.audioEncoderSession = null
		this.config = null
		this.embedTokensWeight = null

		// Model config
		this.hiddenSize = 2048
		this.numLayers = 16
		this.numKVHeads = 8
		this.headDim = 64
		this.convL = 3
		this.layerTypes = []
		this.vocabSize = 65536
	}

	/**
	 * Load the audio model from a directory
	 * @param {string} modelPath - Path to model directory
	 * @param {object} options - Loading options
	 */
	async load(modelPath, options = {}) {
		const { progressCallback, device = 'webgpu', quantization = null } = options

		const report = (status, progress = 0, file = '') => {
			if (progressCallback) {
				progressCallback({ status, progress, file })
			}
		}

		const executionProviders = device === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm']

		try {
			// Disable WebGPU validation to reduce overhead (adapter pre-init removed:
			// one adapter can only create one device; parallel session creation caused "consumed" error)
			if (device === 'webgpu' && navigator.gpu) {
				ort.env.webgpu ??= {}
				ort.env.webgpu.validationMode = 'disabled'
			}

			// WASM multi-threading (requires COOP/COEP headers)
			ort.env.wasm ??= {}
			ort.env.wasm.numThreads =
				navigator.hardwareConcurrency && self.crossOriginIsolated
					? Math.min(4, Math.ceil(navigator.hardwareConcurrency / 2))
					: 1

			// Load mel config for audio processing
			await loadMelConfig(modelPath)

			// Load tokenizer
			report('loading', 0, 'tokenizer')
			const { tokenizer } = await loadTokenizerFromPath(modelPath)
			this.tokenizer = tokenizer

			// Load config
			report('loading', 5, 'config')
			const configResponse = await fetch(`${modelPath}/config.json`)
			this.config = await configResponse.json()

			// Extract model dimensions from config
			const lfmConfig = this.config.lfm || {}
			this.hiddenSize = lfmConfig.hidden_size || 2048
			this.numLayers = lfmConfig.num_hidden_layers || 16
			this.numKVHeads = lfmConfig.num_key_value_heads || 8
			this.headDim = Math.floor(this.hiddenSize / (lfmConfig.num_attention_heads || 32))
			this.convL = lfmConfig.conv_L_cache || 3
			this.layerTypes = lfmConfig.layer_types || []
			this.vocabSize = lfmConfig.vocab_size || 65536

			console.log('Model config:', {
				hiddenSize: this.hiddenSize,
				numLayers: this.numLayers,
				numKVHeads: this.numKVHeads,
				headDim: this.headDim,
			})

			// Parse quantization config (ASR only: decoder, audioEncoder)
			const quantConfig =
				typeof quantization === 'object'
					? quantization
					: {
							decoder: quantization,
							audioEncoder: quantization,
						}

			// Helper to load ONNX model with external data.
			// Pass URLs directly to ORT instead of fetching into ArrayBuffer — eliminates
			// large copies and lets ORT/browser HTTP cache handle loading.
			const loadOnnxWithExternalData = async (
				name,
				progress,
				quantSuffix = null,
				extraOptions = {},
			) => {
				const t0 = performance.now()
				const suffix = quantSuffix ? `_${quantSuffix}` : ''
				const fileName = `${name}${suffix}`
				report('loading', progress, `${fileName}.onnx`)

				const onnxPath = `${modelPath}/onnx/${fileName}.onnx`
				const singleDataPath = `${modelPath}/onnx/${fileName}.onnx_data`

				console.log(`Loading ${fileName}...`)

				const sessionOptions = { executionProviders, ...extraOptions }

				// Check that single onnx_data exists (HEAD) before using URL passthrough
				const dataHead = await fetch(singleDataPath, { method: 'HEAD' })
				const hasSingleData =
					dataHead.ok && !(dataHead.headers.get('content-type') || '').includes('text/html')

				if (hasSingleData) {
					sessionOptions.externalData = [{ path: `./${fileName}.onnx_data`, data: singleDataPath }]
				} else {
					// Fallback: numbered external data files
					sessionOptions.externalData = []
					for (let i = 1; ; i++) {
						const numberedPath = `${modelPath}/onnx/${fileName}.onnx_data_${i}`
						const r = await fetch(numberedPath, { method: 'HEAD' })
						if (!r.ok || (r.headers.get('content-type') || '').includes('text/html')) break
						sessionOptions.externalData.push({
							path: `./${fileName}.onnx_data_${i}`,
							data: numberedPath,
						})
					}
					if (sessionOptions.externalData.length === 0) delete sessionOptions.externalData
				}

				const tSession = performance.now()
				const session = await ort.InferenceSession.create(onnxPath, sessionOptions)
				console.log(
					`[${fileName}] session create: ${(performance.now() - tSession).toFixed(0)}ms | total: ${(performance.now() - t0).toFixed(0)}ms`,
				)
				return session
			}

			// Skip preferredOutputLocation: gpu-buffer — when decoder falls back to WASM
			// (e.g. after adapter consumed), passing it causes "not supported without WebGPU" crash.

			// Load ASR models in parallel (decoder, embed_tokens, audio_encoder)
			const loadDecoder = () => loadOnnxWithExternalData('decoder', 10, quantConfig.decoder, {})
			const loadEmbedTokens = async () => {
				report('loading', 30, 'embed_tokens')
				return this.loadEmbedTokensWeight(modelPath)
			}
			const loadAudioEncoder = () =>
				loadOnnxWithExternalData('audio_encoder', 50, quantConfig.audioEncoder)

			report('loading', 10, 'models (parallel)')
			const [decoderSession, embedTokensWeight, audioEncoderSession] = await Promise.all([
				loadDecoder(),
				loadEmbedTokens(),
				loadAudioEncoder(),
			])

			this.decoderSession = decoderSession
			this.embedTokensWeight = embedTokensWeight
			this.audioEncoderSession = audioEncoderSession

			report('done', 100, '')
			return true
		} catch (error) {
			let errorMessage = error
			if (typeof error === 'number') {
				errorMessage = `ONNX Runtime error code: ${error}`
			} else if (error instanceof Error) {
				errorMessage = error.message
			}
			console.error('Failed to load audio model:', errorMessage)
			throw new Error(errorMessage)
		}
	}

	/**
	 * Load embed_tokens.weight from raw binary file for text embedding lookup
	 *
	 * The Python export saves embed_tokens.weight as:
	 * - embed_tokens.bin: raw float32 binary (vocab_size * hidden_size * 4 bytes)
	 * - embed_tokens.json: metadata (vocab_size, hidden_size)
	 */
	async loadEmbedTokensWeight(modelPath) {
		// Load metadata
		const metaResponse = await fetchWithCache(`${modelPath}/onnx/embed_tokens.json`)
		if (!metaResponse.ok) {
			throw new Error('embed_tokens.json not found - required for ASR')
		}
		const meta = await metaResponse.json()
		console.log('embed_tokens metadata:', meta)

		// Load binary weight
		const binResponse = await fetchWithCache(`${modelPath}/onnx/embed_tokens.bin`)
		if (!binResponse.ok) {
			throw new Error('embed_tokens.bin not found - required for ASR')
		}
		const buffer = await binResponse.arrayBuffer()
		const weight = new Float32Array(buffer)

		if (weight.length !== meta.vocab_size * meta.hidden_size) {
			throw new Error(
				`embed_tokens size mismatch: ${weight.length} vs expected ${meta.vocab_size * meta.hidden_size}`,
			)
		}

		console.log(
			`Loaded embed_tokens: [${meta.vocab_size}, ${meta.hidden_size}] (${(buffer.byteLength / 1e6).toFixed(1)} MB)`,
		)
		return { weight, vocabSize: meta.vocab_size, hiddenSize: meta.hidden_size }
	}

	/**
	 * Get text embeddings for token IDs using pre-loaded weight
	 * @param {number[]} tokenIds - Array of token IDs
	 * @returns {ort.Tensor} - Embeddings tensor [1, seq_len, hidden_size]
	 */
	getTextEmbeddings(tokenIds) {
		if (!this.embedTokensWeight) {
			throw new Error('embed_tokens weight not loaded')
		}

		const { weight, hiddenSize } = this.embedTokensWeight
		const seqLen = tokenIds.length
		const embeddings = new Float32Array(seqLen * hiddenSize)

		for (let i = 0; i < seqLen; i++) {
			const tokenId = tokenIds[i]
			const srcOffset = tokenId * hiddenSize
			const dstOffset = i * hiddenSize
			embeddings.set(weight.subarray(srcOffset, srcOffset + hiddenSize), dstOffset)
		}

		return new ort.Tensor('float32', embeddings, [1, seqLen, hiddenSize])
	}

	/**
	 * Initialize KV cache for generation
	 */
	initializeCache() {
		const cache = {}

		for (let idx = 0; idx < this.layerTypes.length; idx++) {
			const layerType = this.layerTypes[idx]
			if (layerType === 'conv') {
				cache[`past_conv.${idx}`] = new ort.Tensor(
					'float32',
					new Float32Array(1 * this.hiddenSize * this.convL),
					[1, this.hiddenSize, this.convL],
				)
			} else {
				cache[`past_key_values.${idx}.key`] = new ort.Tensor('float32', new Float32Array(0), [
					1,
					this.numKVHeads,
					0,
					this.headDim,
				])
				cache[`past_key_values.${idx}.value`] = new ort.Tensor('float32', new Float32Array(0), [
					1,
					this.numKVHeads,
					0,
					this.headDim,
				])
			}
		}

		return cache
	}

	/**
	 * Update cache from decoder outputs
	 */
	updateCache(cache, outputs) {
		for (const name of Object.keys(outputs)) {
			if (name.startsWith('present_conv.')) {
				const cacheName = name.replace('present_conv', 'past_conv')
				if (cacheName in cache) {
					cache[cacheName] = outputs[name]
				}
			} else if (name.startsWith('present.')) {
				const cacheName = name.replace('present.', 'past_key_values.')
				if (cacheName in cache) {
					cache[cacheName] = outputs[name]
				}
			}
		}
	}

	/**
	 * Run decoder with embeddings
	 */
	async runDecoder(embeds, attentionMask, cache) {
		const feeds = {
			inputs_embeds: embeds,
			attention_mask: attentionMask,
			...cache,
		}

		const outputs = await this.decoderSession.run(feeds)

		return {
			logits: outputs.logits,
			hiddenStates: outputs.hidden_states,
			outputs,
		}
	}

	/**
	 * Sample next token
	 */
	sampleToken(logits, temperature = 0.7) {
		if (temperature === 0) {
			let maxIdx = 0
			let maxVal = logits[0]
			for (let i = 1; i < logits.length; i++) {
				if (logits[i] > maxVal) {
					maxVal = logits[i]
					maxIdx = i
				}
			}
			return maxIdx
		}

		// Temperature sampling
		const scaledLogits = new Float32Array(logits.length)
		let maxLogit = -Infinity
		for (let i = 0; i < logits.length; i++) {
			scaledLogits[i] = logits[i] / temperature
			maxLogit = Math.max(maxLogit, scaledLogits[i])
		}

		let sumExp = 0
		for (let i = 0; i < scaledLogits.length; i++) {
			scaledLogits[i] = Math.exp(scaledLogits[i] - maxLogit)
			sumExp += scaledLogits[i]
		}

		const probs = new Float32Array(scaledLogits.length)
		for (let i = 0; i < probs.length; i++) {
			probs[i] = scaledLogits[i] / sumExp
		}

		// Sample from distribution
		const r = Math.random()
		let cumsum = 0
		for (let i = 0; i < probs.length; i++) {
			cumsum += probs[i]
			if (r < cumsum) return i
		}
		return probs.length - 1
	}

	/**
	 * Transcribe audio to text (ASR mode)
	 * @param {Float32Array} audioData - Audio samples in [-1, 1]
	 * @param {number} sampleRate - Audio sample rate
	 * @param {object} options - Generation options
	 */
	async transcribe(audioData, sampleRate, options = {}) {
		const {
			maxNewTokens = DEFAULT_MAX_TOKENS_TEXT,
			temperature = 0,
			systemPrompt = DEFAULT_SYSTEM_PROMPT_ASR,
			onToken,
		} = options

		if (!this.audioEncoderSession) {
			throw new Error('Audio encoder not loaded')
		}

		if (!this.embedTokensWeight) {
			throw new Error('embed_tokens not loaded - required for ASR')
		}

		logReset()
		log('=== ASR Transcription ===')
		log('Audio samples:', audioData.length, 'Sample rate:', sampleRate)

		// 1. Compute mel spectrogram
		const { melFeatures, numFrames } = computeMelSpectrogram(audioData, sampleRate)
		log('Mel spectrogram frames:', numFrames)

		// 2. Run audio encoder
		const melTensor = new ort.Tensor(
			'float32',
			melFeatures,
			[1, numFrames, 128], // [batch, time, n_mels]
		)

		const melLengths = new ort.Tensor('int64', new BigInt64Array([BigInt(numFrames)]), [1])

		const encoderOutputs = await this.audioEncoderSession.run({
			mel_spectrogram: melTensor,
			mel_lengths: melLengths,
		})

		const audioEmbeds = encoderOutputs.audio_embeddings
		log('Audio embeddings shape:', audioEmbeds.dims)

		// 3. Build prompt: prefix + audio + suffix
		const prefixText = `<|startoftext|><|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n`
		const suffixText = '<|im_end|>\n<|im_start|>assistant\n'

		// Use add_special_tokens: false to match Python behavior (prompt already has special tokens)
		const prefixIds = Array.from(this.tokenizer.encode(prefixText, { add_special_tokens: false }))
		const suffixIds = Array.from(this.tokenizer.encode(suffixText, { add_special_tokens: false }))

		log('Prefix tokens:', prefixIds.length, 'Suffix tokens:', suffixIds.length)

		// Get text embeddings
		const prefixEmbeds = this.getTextEmbeddings(prefixIds)
		const suffixEmbeds = this.getTextEmbeddings(suffixIds)

		// 4. Concatenate embeddings: prefix + audio + suffix
		const prefixLen = prefixIds.length
		const audioLen = audioEmbeds.dims[1]
		const suffixLen = suffixIds.length
		const totalLen = prefixLen + audioLen + suffixLen

		const { hiddenSize } = this.embedTokensWeight
		const allEmbeds = new Float32Array(totalLen * hiddenSize)

		// Copy prefix embeddings
		allEmbeds.set(prefixEmbeds.data, 0)
		// Copy audio embeddings
		allEmbeds.set(
			new Float32Array(audioEmbeds.data.buffer, audioEmbeds.data.byteOffset, audioLen * hiddenSize),
			prefixLen * hiddenSize,
		)
		// Copy suffix embeddings
		allEmbeds.set(suffixEmbeds.data, (prefixLen + audioLen) * hiddenSize)

		const inputEmbeds = new ort.Tensor('float32', allEmbeds, [1, totalLen, hiddenSize])
		const attentionMask = new ort.Tensor('int64', new BigInt64Array(totalLen).fill(1n), [1, totalLen])

		// 5. Initialize cache and run prefill
		const cache = this.initializeCache()
		let { logits, outputs } = await this.runDecoder(inputEmbeds, attentionMask, cache)
		this.updateCache(cache, outputs)

		// 6. Generate tokens
		const generatedTokens = []
		let currentLen = totalLen

		for (let i = 0; i < maxNewTokens; i++) {
			// Get logits for last position - shape is [1, seq_len, vocab_size]
			const logitsData = logits.data
			const seqLen = logits.dims[1]
			const lastLogits = new Float32Array(this.vocabSize)
			const offset = (seqLen - 1) * this.vocabSize
			for (let j = 0; j < this.vocabSize; j++) {
				lastLogits[j] = logitsData[offset + j]
			}
			const nextToken = this.sampleToken(lastLogits, temperature)

			// Check for stop tokens
			if (nextToken === this.tokenizer.eos_token_id || nextToken === SPECIAL_TOKENS.IM_END) {
				log('Stop token reached')
				break
			}

			generatedTokens.push(nextToken)
			if (onToken) {
				const text = this.tokenizer.decode(generatedTokens)
				onToken(text, nextToken)
			}

			// Get embedding for next token
			const nextEmbeds = this.getTextEmbeddings([nextToken])
			currentLen++
			const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen])

			// Run decoder with single token
			;({ logits, outputs } = await this.runDecoder(nextEmbeds, nextMask, cache))
			this.updateCache(cache, outputs)
		}

		const result = this.tokenizer.decode(generatedTokens)
		log(`Generated ${generatedTokens.length} tokens: "${result}"`)
		return result
	}

	/**
	 * Free resources
	 */
	dispose() {
		this.tokenizer = null
		this.decoderSession = null
		this.audioEncoderSession = null
		this.embedTokensWeight = null
	}
}

// Re-export audio utilities
export { loadAudioFile }

export default AudioModel
