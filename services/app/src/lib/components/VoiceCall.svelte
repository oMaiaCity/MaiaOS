<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { env } from '$env/dynamic/public';

	// Connection state
	let status = $state<'disconnected' | 'connecting' | 'connected'>('disconnected');
	let error = $state<string | null>(null);
	let ws = null;
	let googleSession = null;

	// Audio handling - separate contexts for input and output (as per reference)
	let inputAudioContext = null;
	let outputAudioContext = null;
	let mediaStream = null;
	let processorRef = null;
	let inputSourceRef = null;
	let nextStartTime = 0;
	let playingSources = new Set();
	let isRecording = $state(false);

	// Get API URL from environment
	function getApiUrl() {
		const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
		let apiDomain = env.PUBLIC_DOMAIN_API || (isProduction ? 'api.hominio.me' : 'localhost:4204');
		apiDomain = apiDomain.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
		const protocol = apiDomain.startsWith('localhost') || apiDomain.startsWith('127.0.0.1') ? 'ws' : 'wss';
		return `${protocol}://${apiDomain}`;
	}

	// Initialize audio contexts - separate for input (16kHz) and output (24kHz)
	async function initAudio() {
		try {
			const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
			inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
			outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
			console.log('[VoiceCall] Audio contexts initialized', {
				inputState: inputAudioContext.state,
				outputState: outputAudioContext.state
			});
		} catch (err) {
			console.error('[VoiceCall] Failed to initialize audio:', err);
			error = 'Failed to initialize audio';
		}
	}

	// Resume audio contexts (must be called from user gesture)
	async function resumeAudioContexts() {
		if (inputAudioContext && inputAudioContext.state === 'suspended') {
			await inputAudioContext.resume();
			console.log('[VoiceCall] Resumed input audio context');
		}
		if (outputAudioContext && outputAudioContext.state === 'suspended') {
			await outputAudioContext.resume();
			console.log('[VoiceCall] Resumed output audio context');
		}
	}

	// Encode bytes to base64 (as per reference)
	function encode(bytes: Uint8Array): string {
		let binary = '';
		const len = bytes.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	// Convert Float32Array to Blob object (as per reference implementation)
	function createBlob(data: Float32Array): { data: string; mimeType: string } {
		const l = data.length;
		const int16 = new Int16Array(l);
		for (let i = 0; i < l; i++) {
			// Clamp values to [-1, 1] before converting to PCM16
			const s = Math.max(-1, Math.min(1, data[i]));
			int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
		}
		return {
			data: encode(new Uint8Array(int16.buffer)),
			mimeType: 'audio/pcm;rate=16000',
		};
	}

	// Process audio chunks and send to WebSocket
	function processAudioChunk(audioBuffer: AudioBuffer) {
		if (ws && ws.readyState === WebSocket.OPEN && isRecording) {
			const inputData = audioBuffer.getChannelData(0);
			const pcmBlob = createBlob(inputData);
			ws.send(JSON.stringify({
				type: 'audio',
				data: pcmBlob.data, // Send the base64 string
				mimeType: pcmBlob.mimeType,
			}));
		}
	}

	// Start recording audio
	async function startRecording() {
		try {
			// Request microphone permission
			mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					sampleRate: 16000,
				},
			});

			if (!inputAudioContext) {
				await initAudio();
			}

			if (!inputAudioContext) {
				throw new Error('Input audio context not initialized');
			}

			// Create source from microphone
			inputSourceRef = inputAudioContext.createMediaStreamSource(mediaStream);
			processorRef = inputAudioContext.createScriptProcessor(4096, 1, 1);
			
			processorRef.onaudioprocess = (e) => {
				if (isRecording && ws && ws.readyState === WebSocket.OPEN) {
					const inputBuffer = e.inputBuffer;
					processAudioChunk(inputBuffer);
				}
			};

			inputSourceRef.connect(processorRef);
			processorRef.connect(inputAudioContext.destination);

			isRecording = true;
		} catch (err) {
			console.error('[VoiceCall] Failed to start recording:', err);
			error = err instanceof Error ? err.message : 'Failed to start recording';
			stopRecording();
		}
	}

	// Stop recording audio
	function stopRecording() {
		isRecording = false;
		
		if (inputSourceRef) {
			inputSourceRef.disconnect();
			inputSourceRef = null;
		}

		if (processorRef) {
			processorRef.disconnect();
			processorRef = null;
		}

		if (mediaStream) {
			mediaStream.getTracks().forEach(track => track.stop());
			mediaStream = null;
		}
	}

	// Decode base64 to Uint8Array
	function decode(base64: string): Uint8Array {
		const binaryString = atob(base64);
		const len = binaryString.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes;
	}

	// Decode audio data (as per reference implementation)
	async function decodeAudioData(
		data: Uint8Array,
		ctx: AudioContext,
		sampleRate: number,
		numChannels: number,
	): Promise<AudioBuffer> {
		const dataInt16 = new Int16Array(data.buffer);
		const frameCount = dataInt16.length / numChannels;
		const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

		for (let channel = 0; channel < numChannels; channel++) {
			const channelData = buffer.getChannelData(channel);
			for (let i = 0; i < frameCount; i++) {
				channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
			}
		}
		return buffer;
	}

	// Play audio from base64 PCM data (as per reference implementation)
	async function playAudio(base64Audio: string, sampleRate: number = 24000) {
		if (!outputAudioContext) {
			console.warn('[VoiceCall] Output audio context not initialized, cannot play audio');
			return;
		}

		try {
			const ctx = outputAudioContext;
			nextStartTime = Math.max(nextStartTime, ctx.currentTime);

			const audioBuffer = await decodeAudioData(
				decode(base64Audio),
				ctx,
				24000,
				1
			);

			const source = ctx.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(ctx.destination);
			
			source.addEventListener('ended', () => {
				playingSources.delete(source);
			});

			source.start(nextStartTime);
			nextStartTime += audioBuffer.duration;
			playingSources.add(source);
		} catch (err) {
			console.error('[VoiceCall] Failed to play audio:', err);
		}
	}

	// Connect to WebSocket
	async function connect() {
		if (ws && ws.readyState === WebSocket.OPEN) {
			console.log('[VoiceCall] Already connected');
			return;
		}

		status = 'connecting';
		error = null;

		try {
			const apiUrl = getApiUrl();
			const wsUrl = `${apiUrl}/api/v0/voice/live`;
			
			ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				console.log('[VoiceCall] WebSocket connected');
				status = 'connecting'; // Will be set to 'connected' when Google is ready
				// Don't start recording yet - wait for Google's onopen callback
				// The backend will send a 'status: connected' message when Google is ready
			};

			ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);

					switch (message.type) {
						case 'status':
							if (message.status === 'connected') {
								status = 'connected';
								// Google Live API is ready - start recording now
								if (!isRecording) {
									startRecording();
								}
							} else if (message.status === 'disconnected') {
								status = 'disconnected';
								stopRecording();
							}
							break;

						case 'audio':
							// Play received audio
							playAudio(message.data, 24000);
							break;

						case 'error':
							console.error('[VoiceCall] Server error:', message.message);
							error = message.message;
							break;

						case 'serverContent':
							// Handle interruption - stop all playing audio
							if (message.data?.interrupted) {
								playingSources.forEach(s => {
									try { s.stop(); } catch (e) {}
								});
								playingSources.clear();
								nextStartTime = 0;
							}
							break;
					}
				} catch (err) {
					console.error('[VoiceCall] Failed to parse message:', err);
				}
			};

			ws.onerror = (event) => {
				console.error('[VoiceCall] WebSocket error:', event);
				error = 'WebSocket connection error';
				status = 'disconnected';
				stopRecording();
			};

			ws.onclose = (event) => {
				console.log('[VoiceCall] WebSocket closed:', event.code, event.reason);
				status = 'disconnected';
				stopRecording();
				ws = null;
			};
		} catch (err) {
			console.error('[VoiceCall] Failed to connect:', err);
			error = err instanceof Error ? err.message : 'Failed to connect';
			status = 'disconnected';
		}
	}

	// Disconnect from WebSocket
	function disconnect() {
		stopRecording();

		// Stop all currently playing audio immediately
		playingSources.forEach(source => {
			try { source.stop(); } catch (e) {}
		});
		playingSources.clear();
		nextStartTime = 0;

		if (ws) {
			ws.close();
			ws = null;
		}

		status = 'disconnected';
		error = null;
	}

	// Handle start/end call button
	async function toggleCall() {
		await resumeAudioContexts();
		
		if (status === 'connected') {
			disconnect();
		} else {
			connect();
		}
	}

	onMount(() => {
		initAudio();
	});

	onDestroy(() => {
		disconnect();
		// Stop all playing sources
		playingSources.forEach(source => {
			try { source.stop(); } catch (e) {}
		});
		playingSources.clear();
		
		// Close audio contexts
		if (inputAudioContext?.state !== 'closed') {
			inputAudioContext?.close();
		}
		if (outputAudioContext?.state !== 'closed') {
			outputAudioContext?.close();
		}
	});
</script>

<div class="relative z-10 mt-8 rounded-lg border border-white/10 bg-white/5 p-6 shadow-lg">
	<h3 class="mb-4 text-lg font-semibold text-white/95">Voice Assistant</h3>

	<div class="flex flex-col items-center gap-4">
		<!-- Status indicator -->
		<div class="flex items-center gap-2">
			<div
				class="h-3 w-3 rounded-full {status === 'connected'
					? 'bg-green-400'
					: status === 'connecting'
						? 'bg-yellow-400 animate-pulse'
						: 'bg-gray-400'}"
			></div>
			<span class="text-sm text-white/70">
				{status === 'connected'
					? 'Connected'
					: status === 'connecting'
						? 'Connecting...'
						: 'Disconnected'}
			</span>
		</div>

		<!-- Error message -->
		{#if error}
			<p class="text-sm text-yellow-400">{error}</p>
		{/if}

		<!-- Call button -->
		<button
			onclick={toggleCall}
			disabled={status === 'connecting'}
			class="rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-base font-medium text-white/90 transition-colors hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed {status === 'connected'
				? 'bg-red-500/20 hover:bg-red-500/30 border-red-400/30'
				: 'bg-green-500/20 hover:bg-green-500/30 border-green-400/30'}"
		>
			{status === 'connected' ? 'End Call' : 'Start Call'}
		</button>
	</div>
</div>

