/**
 * Streaming transcription with VAD.
 * Uses @ricky0123/vad-web to segment speech from the mic, then transcribes each chunk.
 * Processes chunks sequentially to avoid overloading WebGPU/WASM.
 */

const MIN_CHUNK_SAMPLES = 8000 // 0.5s at 16kHz - skip shorter segments
const VAD_SAMPLE_RATE = 16000

/**
 * Create a streaming transcription controller.
 * @param {object} options
 * @param {import('./audio-model.js').AudioModel} options.audioModel - Loaded ASR model
 * @param {(text: string) => void} options.onTranscript - Called when a chunk is transcribed
 * @param {() => void} [options.onSpeechStart] - Called when speech starts
 * @param {(listening: boolean) => void} [options.onListeningChange] - Called when VAD listening state changes
 */
export async function createStreamingTranscription(options) {
	const { audioModel, onTranscript, onSpeechStart, onListeningChange } = options
	const vad = globalThis.vad
	if (!vad?.MicVAD) {
		throw new Error(
			'VAD not loaded. Ensure /vad/ort.wasm.min.js and /vad/bundle.min.js are loaded before streaming.',
		)
	}
	const { MicVAD } = vad

	const chunkQueue = []
	let isProcessing = false

	async function processQueue() {
		if (isProcessing || chunkQueue.length === 0) return
		isProcessing = true
		const audio = chunkQueue.shift()
		try {
			const text = await audioModel.transcribe(audio, VAD_SAMPLE_RATE, {
				temperature: 0,
			})
			const trimmed = text?.trim()
			if (trimmed) {
				onTranscript(trimmed)
			}
		} catch (err) {
			console.error('[streaming] transcribe failed:', err)
		} finally {
			isProcessing = false
			if (chunkQueue.length > 0) {
				processQueue()
			}
		}
	}

	const myvad = await MicVAD.new({
		baseAssetPath: '/vad/',
		onnxWASMBasePath: '/vad/',
		onSpeechStart: () => {
			onSpeechStart?.()
		},
		onSpeechEnd: (audio) => {
			if (audio.length < MIN_CHUNK_SAMPLES) return
			chunkQueue.push(audio)
			processQueue()
		},
		submitUserSpeechOnPause: true,
	})

	return {
		start() {
			myvad.start()
			onListeningChange?.(true)
		},
		pause() {
			myvad.pause()
			onListeningChange?.(false)
		},
		destroy() {
			myvad.pause()
			chunkQueue.length = 0
		},
		get listening() {
			return myvad.listening
		},
	}
}
