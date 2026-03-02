/**
 * Moonshine Streaming ONNX Model for ASR
 *
 * Matches the official C++ reference (moonshine-streaming-model.cpp):
 *   Pipeline: frontend → encoder → adapter → cross_kv → decoder_kv
 *
 *   cross_kv.onnx   input:  memory
 *                   output: k_cross, v_cross
 *
 *   decoder_kv.onnx input:  token, k_self, v_self, out_k_cross, out_v_cross
 *                   output: logits, out_k_self, out_v_self, (out_k_cross, out_v_cross)
 *
 * The C++ reference starts with cache_seq_len=0 (empty self-KV). Native ORT
 * handles 0-dim tensors fine, but ORT Web WASM's Squeeze op crashes on them.
 * Workaround: seed self-KV with total_lookahead+1 zeros so the internal
 * sliding window width is ≥ 1.
 */

import { AutoTokenizer, env } from '@huggingface/transformers'
import * as ort from 'onnxruntime-web'

const MAX_NEW_TOKENS = 448

async function loadMoonshineTokenizer(baseUrl) {
	const res = await fetch(baseUrl + 'tokenizer.json')
	if (!res.ok) throw new Error('Failed to fetch tokenizer.json')
	const tokenizerJson = await res.text()
	const tokenizerConfig = JSON.stringify({ tokenizer_class: 'PreTrainedTokenizerFast' })
	const fakeId = `moonshine-tok-${Date.now()}`
	const originalFetch = globalThis.fetch
	globalThis.fetch = (input) => {
		const url = typeof input === 'string' ? input : (input?.url ?? '')
		if (url.includes(fakeId)) {
			if (url.includes('tokenizer.json')) {
				return Promise.resolve(
					new Response(tokenizerJson, { headers: { 'Content-Type': 'application/json' } }),
				)
			}
			if (url.includes('tokenizer_config.json')) {
				return Promise.resolve(
					new Response(tokenizerConfig, { headers: { 'Content-Type': 'application/json' } }),
				)
			}
			return Promise.resolve(new Response('Not found', { status: 404 }))
		}
		return originalFetch(input)
	}
	const origLocal = env.allowLocalModels
	env.allowLocalModels = false
	try {
		return await AutoTokenizer.from_pretrained(fakeId)
	} finally {
		globalThis.fetch = originalFetch
		env.allowLocalModels = origLocal
	}
}

export class MoonshineModel {
	constructor() {
		this.tokenizer = null
		this.frontendSession = null
		this.encoderSession = null
		this.adapterSession = null
		this.crossKvSession = null
		this.decoderKvSession = null
		this.config = null
	}

	async load(modelPath, options = {}) {
		const { progressCallback, device = 'webgpu' } = options

		const report = (progress, file) => {
			progressCallback?.({ status: 'loading', progress, file })
		}

		const executionProviders = device === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm']

		if (device === 'webgpu' && typeof navigator !== 'undefined' && navigator.gpu) {
			ort.env.webgpu ??= {}
			ort.env.webgpu.validationMode = 'disabled'
		}

		ort.env.wasm ??= {}
		ort.env.wasm.numThreads =
			typeof navigator !== 'undefined' && navigator.hardwareConcurrency && self.crossOriginIsolated
				? Math.min(4, Math.ceil(navigator.hardwareConcurrency / 2))
				: 1

		const base = modelPath.endsWith('/') ? modelPath : modelPath + '/'

		try {
			report(5, 'config')
			const configRes = await fetch(base + 'streaming_config.json')
			this.config = await configRes.json()

			report(10, 'tokenizer')
			this.tokenizer = await loadMoonshineTokenizer(base)

			report(20, 'frontend')
			this.frontendSession = await ort.InferenceSession.create(base + 'frontend.onnx', {
				executionProviders,
			})

			report(35, 'encoder')
			this.encoderSession = await ort.InferenceSession.create(base + 'encoder.onnx', {
				executionProviders,
			})

			report(50, 'adapter')
			this.adapterSession = await ort.InferenceSession.create(base + 'adapter.onnx', {
				executionProviders,
			})

			report(65, 'cross_kv')
			this.crossKvSession = await ort.InferenceSession.create(base + 'cross_kv.onnx', {
				executionProviders,
			})

			report(85, 'decoder_kv')
			this.decoderKvSession = await ort.InferenceSession.create(base + 'decoder_kv.onnx', {
				executionProviders,
			})

			progressCallback?.({ status: 'done', progress: 100, file: '' })
			return true
		} catch (err) {
			console.error('Moonshine load error:', err)
			throw err
		}
	}

	_createFrontendState() {
		const shapes = this.config.frontend_state_shapes
		return {
			sample_buffer: new ort.Tensor(
				'float32',
				new Float32Array(shapes.sample_buffer[0] * shapes.sample_buffer[1]),
				shapes.sample_buffer,
			),
			sample_len: new ort.Tensor('int64', new BigInt64Array(1), shapes.sample_len),
			conv1_buffer: new ort.Tensor(
				'float32',
				new Float32Array(shapes.conv1_buffer[0] * shapes.conv1_buffer[1] * shapes.conv1_buffer[2]),
				shapes.conv1_buffer,
			),
			conv2_buffer: new ort.Tensor(
				'float32',
				new Float32Array(shapes.conv2_buffer[0] * shapes.conv2_buffer[1] * shapes.conv2_buffer[2]),
				shapes.conv2_buffer,
			),
			frame_count: new ort.Tensor('int64', new BigInt64Array(1), shapes.frame_count),
		}
	}

	_dispose() {
		this.tokenizer = null
		this.frontendSession = null
		this.encoderSession = null
		this.adapterSession = null
		this.crossKvSession = null
		this.decoderKvSession = null
		this.config = null
	}

	async transcribe(audioData, _sampleRate, options = {}) {
		const { onToken } = options

		if (!this.frontendSession || !this.crossKvSession || !this.decoderKvSession) {
			throw new Error('Moonshine model not loaded')
		}

		const cfg = this.config
		const nlayers = cfg.depth
		const nheads = cfg.nheads
		const headDim = cfg.head_dim
		const vocabSize = cfg.vocab_size

		const t0 = performance.now()

		// --- 1. Frontend ---
		const audioTensor = new ort.Tensor('float32', audioData, [1, audioData.length])
		const feState = this._createFrontendState()
		const frontendOut = await this.frontendSession.run({
			audio_chunk: audioTensor,
			...feState,
		})

		const features = frontendOut.features
		if (!features || features.dims[1] === 0) return ''

		// --- 2. Encoder ---
		const encoded = await this.encoderSession.run({ features })
		const encHidden = encoded.encoded

		// --- 3. Adapter ---
		const posOffset = new ort.Tensor('int64', new BigInt64Array([0n]), [1])
		const adapterOut = await this.adapterSession.run({
			encoded: encHidden,
			pos_offset: posOffset,
		})
		const memory = adapterOut.memory

		// --- 4. Cross-KV (once per utterance, from memory) ---
		const crossKvOut = await this.crossKvSession.run({ memory })
		const kCross = crossKvOut.k_cross
		const vCross = crossKvOut.v_cross

		console.log(
			`[moonshine] encode pipeline: ${(performance.now() - t0).toFixed(0)}ms, memory: [${memory.dims}], cross: [${kCross.dims}]`,
		)

		// --- 5. Autoregressive decode via decoder_kv.onnx ---
		const durationSec = audioData.length / 16000
		const maxTokens = Math.min(options.maxTokens ?? Math.ceil(durationSec * 6.5), MAX_NEW_TOKENS)
		if (maxTokens <= 0) return ''

		// ORT Web workaround: native ORT handles cache_seq_len=0 fine, but
		// ORT WASM's Squeeze op crashes on the resulting 0-dim tensor.
		// The sliding window computes: window = cache_len - total_lookahead.
		// We need window ≥ 1, so cache_len ≥ total_lookahead + 1.
		const initCacheLen = cfg.total_lookahead + 1
		const initCacheSize = nlayers * 1 * nheads * initCacheLen * headDim

		const generatedTokens = []
		let cacheSeqLen = initCacheLen
		let kSelfData = new Float32Array(initCacheSize)
		let vSelfData = new Float32Array(initCacheSize)
		let nextToken = cfg.bos_id
		const DECODER_KV_OUTPUTS = ['logits', 'out_k_self', 'out_v_self']

		const tDec = performance.now()
		console.log(`[moonshine] decode start: maxTokens=${maxTokens}, initCacheLen=${initCacheLen}`)

		const argmax = (logitsTensor) => {
			const d = logitsTensor.data
			const off = (logitsTensor.dims[1] - 1) * vocabSize
			let best = 0
			let bestV = d[off]
			for (let j = 1; j < vocabSize; j++) {
				if (d[off + j] > bestV) {
					bestV = d[off + j]
					best = j
				}
			}
			return best
		}

		for (let i = 0; i < maxTokens; i++) {
			const tokenTensor = new ort.Tensor('int64', new BigInt64Array([BigInt(nextToken)]), [1, 1])
			const kSelf = new ort.Tensor('float32', kSelfData, [nlayers, 1, nheads, cacheSeqLen, headDim])
			const vSelf = new ort.Tensor('float32', vSelfData, [nlayers, 1, nheads, cacheSeqLen, headDim])

			const decOut = await this.decoderKvSession.run(
				{
					token: tokenTensor,
					k_self: kSelf,
					v_self: vSelf,
					out_k_cross: kCross,
					out_v_cross: vCross,
				},
				DECODER_KV_OUTPUTS,
			)

			nextToken = argmax(decOut.logits)
			if (nextToken === cfg.eos_id) break

			generatedTokens.push(nextToken)
			onToken?.(this.tokenizer.decode(generatedTokens), nextToken)

			const newK = decOut.out_k_self
			cacheSeqLen = newK.dims[3]
			kSelfData = new Float32Array(newK.data)
			vSelfData = new Float32Array(decOut.out_v_self.data)

			if (i === 0) {
				console.log(`[moonshine] first decode step done, new cacheSeqLen=${cacheSeqLen}`)
			}

			if (i % 5 === 4) {
				await new Promise((r) => setTimeout(r, 0))
			}
		}

		const result = this.tokenizer.decode(generatedTokens)
		console.log(
			`[moonshine] decode: ${generatedTokens.length} tokens in ${(performance.now() - tDec).toFixed(0)}ms → "${result}"`,
		)
		return result
	}

	dispose() {
		this._dispose()
	}
}
