/**
 * Streaming transcription.
 *
 * Two modes:
 * - VAD mode (LFM2.5): Transcription on VAD-detected speech segments.
 * - Moonshine mode: Continuous incremental streaming per Moonshine design
 *   (https://huggingface.co/UsefulSensors/moonshine-streaming-medium) — no VAD,
 *   add_audio in chunks, update_interval-based transcription.
 */

const VAD_SAMPLE_RATE = 16000
const MIN_CHUNK_SAMPLES = 8000 // 0.5s at 16kHz - skip shorter segments
const MOONSHINE_UPDATE_INTERVAL_MS = 2000
const MOONSHINE_MIN_SAMPLES = 32000 // 2s at 16kHz — decoder needs enough encoder frames

/**
 * Moonshine streaming: continuous audio capture, no VAD.
 * Matches Moonshine intended architecture: chunk-wise add_audio, update_interval.
 */
export async function createMoonshineStreamingTranscription(options) {
	const { audioModel, onTranscript, onListeningChange } = options

	let stream = null
	let audioContext = null
	let source = null
	let processor = null
	let intervalId = null
	const buffer = []
	let isProcessing = false

	async function processChunk() {
		if (buffer.length < MOONSHINE_MIN_SAMPLES || isProcessing) return
		const samples = buffer.splice(0, buffer.length)
		isProcessing = true
		try {
			const audio = new Float32Array(samples)
			const text = await audioModel.transcribe(audio, VAD_SAMPLE_RATE)
			const trimmed = text?.trim()
			if (trimmed) {
				onTranscript(trimmed)
			}
		} catch (err) {
			console.error('[moonshine streaming] transcribe failed:', err)
		} finally {
			isProcessing = false
		}
	}

	function resampleTo16k(input, fromRate) {
		if (fromRate === 16000) return new Float32Array(input)
		const ratio = fromRate / 16000
		const outLen = Math.floor(input.length / ratio)
		const output = new Float32Array(outLen)
		for (let i = 0; i < outLen; i++) {
			const srcIdx = i * ratio
			const srcLo = Math.floor(srcIdx)
			const srcHi = Math.min(srcLo + 1, input.length - 1)
			const t = srcIdx - srcLo
			output[i] = input[srcLo] * (1 - t) + input[srcHi] * t
		}
		return output
	}

	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true })
		audioContext = new (window.AudioContext || window.webkitAudioContext)()
		source = audioContext.createMediaStreamSource(stream)

		processor = audioContext.createScriptProcessor(4096, 1, 1)
		processor.onaudioprocess = (e) => {
			const input = e.inputBuffer.getChannelData(0)
			const resampled = resampleTo16k(input, audioContext.sampleRate)
			for (let i = 0; i < resampled.length; i++) {
				buffer.push(resampled[i])
			}
		}
		source.connect(processor)
		const silence = audioContext.createGain()
		silence.gain.value = 0
		processor.connect(silence)
		silence.connect(audioContext.destination)

		intervalId = setInterval(processChunk, MOONSHINE_UPDATE_INTERVAL_MS)
		onListeningChange?.(true)

		return {
			start() {
				/* already started */
			},
			pause() {
				if (intervalId) {
					clearInterval(intervalId)
					intervalId = null
				}
				onListeningChange?.(false)
			},
			destroy() {
				if (intervalId) {
					clearInterval(intervalId)
					intervalId = null
				}
				if (processor && source) {
					processor.disconnect()
					source.disconnect()
				}
				if (stream) {
					for (const t of stream.getTracks()) {
						t.stop()
					}
				}
				if (audioContext) {
					audioContext.close()
				}
				buffer.length = 0
				onListeningChange?.(false)
			},
			get listening() {
				return !!intervalId
			},
		}
	} catch (err) {
		console.error('[moonshine streaming] failed to start:', err)
		throw err
	}
}

/**
 * VAD-based streaming (for LFM2.5-Audio).
 * Transcription runs on VAD-detected speech segments only.
 */
export async function createStreamingTranscription(options) {
	const { audioModel, onTranscript, onVadBoundary, onSpeechStart, onListeningChange } = options
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
			onVadBoundary?.()
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
