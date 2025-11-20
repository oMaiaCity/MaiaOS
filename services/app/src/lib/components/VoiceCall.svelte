<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { GlassCard, Alert, GlassButton } from '@hominio/brand';

	// Connection state
	let status = $state<'disconnected' | 'connecting' | 'connected'>('disconnected');
	let aiState = $state<'listening' | 'thinking' | 'speaking' | 'idle'>('idle');
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
				if (playingSources.size === 0 && status === 'connected') {
					aiState = 'listening';
				}
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
								aiState = 'listening';
								// Google Live API is ready - start recording now
								if (!isRecording) {
									startRecording();
								}
							} else if (message.status === 'disconnected') {
								status = 'disconnected';
								aiState = 'idle';
								stopRecording();
							}
							break;

						case 'audio':
							// Play received audio
							aiState = 'speaking';
							playAudio(message.data, 24000);
							break;

						case 'toolCall':
							aiState = 'thinking';
							break;

						case 'error':
							console.error('[VoiceCall] Server error:', message.message);
							error = message.message;
							aiState = 'idle';
							break;

						case 'serverContent':
							// Handle interruption - stop all playing audio
							if (message.data?.interrupted) {
								playingSources.forEach(s => {
									try { s.stop(); } catch (e) {}
								});
								playingSources.clear();
								nextStartTime = 0;
								aiState = 'listening';
							}
							// Check for turn completion (model finished generating)
							if (message.data?.turnComplete) {
								// We stay in 'speaking' if audio is still playing, 
								// but logically the AI finished its turn.
								// The audio ended listener will handle transition back to listening.
							}
							break;
					}
				} catch (err) {
					console.error('[VoiceCall] Failed to parse message:', err);
				}
			};

			ws.onerror = (event) => {
				console.error('[VoiceCall] WebSocket error:', event);
				// Error message will be set in onclose based on close code
				status = 'disconnected';
				stopRecording();
			};

			ws.onclose = (event) => {
				console.log('[VoiceCall] WebSocket closed:', event.code, event.reason);
				status = 'disconnected';
				stopRecording();
				
				// Set user-friendly error message based on close code and reason
				// IMPORTANT: Only show error if it wasn't a normal closure (user-initiated)
				if (event.code === 1000) {
					// Normal closure - no error (user clicked "End Call" or server closed normally)
					error = null;
				} else if (event.code === 1008 || event.reason?.includes('capability') || event.reason?.includes('Forbidden') || event.reason?.includes('No api:voice')) {
					error = 'Access denied. You don\'t have permission to use the voice assistant. Please contact an administrator to grant access.';
				} else if (event.code === 1001 || event.reason?.includes('Unauthorized') || event.reason?.includes('Authentication') || event.reason?.includes('not authenticated')) {
					error = 'Please sign in to use the voice assistant.';
				} else if (event.code === 1006) {
					// Abnormal closure (1006) - check if we have a reason
					// If the connection was blocked before upgrade, we might not get a reason
					// Check if this was likely a capability/auth denial
					if (event.reason) {
						if (event.reason.includes('capability') || event.reason.includes('Forbidden') || event.reason.includes('Unauthorized')) {
							error = event.reason.includes('capability') || event.reason.includes('Forbidden')
								? 'Access denied. You don\'t have permission to use the voice assistant. Please contact an administrator to grant access.'
								: 'Please sign in to use the voice assistant.';
						} else {
							error = `Connection failed: ${event.reason}`;
						}
					} else {
						// No reason provided - could be blocked before upgrade
						// Don't show generic connection error, show access denied instead
						// (Most likely cause is capability denial if user is authenticated)
						error = 'Access denied. You don\'t have permission to use the voice assistant. Please contact an administrator to grant access.';
					}
				} else if (event.reason) {
					// Use the reason from server
					if (event.reason.includes('capability') || event.reason.includes('Forbidden')) {
						error = 'Access denied. You don\'t have permission to use the voice assistant. Please contact an administrator to grant access.';
					} else if (event.reason.includes('Unauthorized') || event.reason.includes('Authentication')) {
						error = 'Please sign in to use the voice assistant.';
					} else {
						error = event.reason;
					}
				} else {
					// Unknown error - don't show generic connection error
					error = 'Connection error. Please try again.';
				}
				
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

		// Clear error when user initiates disconnect
		error = null;

		if (ws) {
			// Close with normal closure code (1000) to indicate user-initiated disconnect
			ws.close(1000, 'User ended call');
			ws = null;
		}

		status = 'disconnected';
		aiState = 'idle';
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

<div class="relative z-10 mt-8">
	<GlassCard accent={true} hover={true} class="p-6">
		<h3 class="mb-6 text-center text-xl font-bold tracking-tight text-slate-900">Voice Assistant</h3>

	<div class="flex flex-col items-center gap-4">
		<!-- Status indicator -->
		<div class="flex items-center gap-2">
			<div
				class="h-3 w-3 rounded-full {status === 'connected'
					? 'bg-emerald-500'
					: status === 'connecting'
						? 'bg-yellow-400 animate-pulse'
						: 'bg-slate-400'}"
			></div>
			<span class="text-sm font-medium text-slate-600">
				{#if status === 'connected'}
					{#if aiState === 'speaking'}
						<span class="text-emerald-600">Speaking...</span>
					{:else if aiState === 'thinking'}
						<span class="text-blue-600 animate-pulse">Thinking...</span>
					{:else}
						Listening...
					{/if}
				{:else if status === 'connecting'}
					Connecting...
				{:else}
					Disconnected
				{/if}
			</span>
		</div>

		<!-- Error message -->
		{#if error}
			<Alert type="warning" class="w-full p-4">
				<p class="text-sm font-medium">{error}</p>
			</Alert>
		{/if}

		<!-- Call button -->
		<GlassButton
			variant={status === 'connected' ? 'danger' : 'navy'}
			onclick={toggleCall}
			disabled={status === 'connecting'}
			class="w-full items-center justify-center gap-2"
		>
			{status === 'connected' ? 'End Call' : 'Start Call'}
		</GlassButton>
	</div>
	</GlassCard>
</div>

