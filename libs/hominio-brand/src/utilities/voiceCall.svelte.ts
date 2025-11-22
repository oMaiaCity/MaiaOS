/**
 * Voice Call Service - Reusable Google Live Voice API client
 * Uses Svelte 5 runes for reactive state management
 */

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type AIState = 'listening' | 'thinking' | 'speaking' | 'idle';
export type ToolCallHandler = (toolName: string, args: any) => void;

export function createVoiceCallService(options?: { 
	onToolCall?: ToolCallHandler;
	initialAgentId?: string; // Agent ID to load context for at conversation start
}) {
	// Reactive state using Svelte 5 runes
	let status = $state<ConnectionStatus>('disconnected');
	let aiState = $state<AIState>('idle');
	let error = $state<string | null>(null);
	let isWaitingForPermission = $state(false);
	
	// Private internal state
	let ws: WebSocket | null = null;
	let inputAudioContext: AudioContext | null = null;
	let outputAudioContext: AudioContext | null = null;
	let mediaStream: MediaStream | null = null;
	let processorRef: AudioWorkletNode | null = null;
	let inputSourceRef: MediaStreamAudioSourceNode | null = null;
	let nextStartTime = 0;
	let playingSources = new Set<AudioBufferSourceNode>();
	let isRecording = false;

	// Get API URL from environment or default
	function getApiUrl() {
		const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
		const apiDomain = isProduction ? 'api.hominio.me' : 'localhost:4204';
		const protocol = apiDomain.startsWith('localhost') || apiDomain.startsWith('127.0.0.1') ? 'ws' : 'wss';
		const url = `${protocol}://${apiDomain}`;
		console.log('[VoiceCall] WebSocket URL:', url, '(production:', isProduction, ')');
		return url;
	}

	// Initialize audio contexts
	async function initAudio() {
		try {
			const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
			inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
			outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
			console.log('[VoiceCall] Audio contexts initialized');
		} catch (err) {
			console.error('[VoiceCall] Failed to initialize audio:', err);
			error = 'Failed to initialize audio';
		}
	}

	// Resume audio contexts (must be called from user gesture)
	async function resumeAudioContexts() {
		if (!inputAudioContext || !outputAudioContext) {
			await initAudio();
		}
		
		if (inputAudioContext?.state === 'suspended') {
			await inputAudioContext.resume();
		}
		if (outputAudioContext?.state === 'suspended') {
			await outputAudioContext.resume();
		}
	}

	// Start recording from microphone
	async function startRecording() {
		if (!inputAudioContext || isRecording) return;

		try {
			// Request microphone permission
			mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			inputSourceRef = inputAudioContext.createMediaStreamSource(mediaStream);

			// Add AudioWorklet processor
			if (!inputAudioContext.audioWorklet) {
				throw new Error('AudioWorklet not supported');
			}

			// Inline processor (we'll use ScriptProcessor as fallback)
			const processor = inputAudioContext.createScriptProcessor(4096, 1, 1);
			processor.onaudioprocess = (e) => {
				if (!ws || ws.readyState !== WebSocket.OPEN) return;
				
				const input = e.inputBuffer.getChannelData(0);
				const int16 = new Int16Array(input.length);
				for (let i = 0; i < input.length; i++) {
					int16[i] = Math.max(-32768, Math.min(32767, Math.floor(input[i] * 32768)));
				}
				
				const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
				ws.send(JSON.stringify({ type: 'audio', data: base64 }));
			};

			inputSourceRef.connect(processor);
			processor.connect(inputAudioContext.destination);
			processorRef = processor as any;
			isRecording = true;
			console.log('[VoiceCall] Recording started');
		} catch (err) {
			console.error('[VoiceCall] Failed to start recording:', err);
			error = 'Microphone access denied';
			isWaitingForPermission = false;
		}
	}

	// Stop recording
	function stopRecording() {
		if (processorRef) {
			processorRef.disconnect();
			processorRef = null;
		}
		if (inputSourceRef) {
			inputSourceRef.disconnect();
			inputSourceRef = null;
		}
		if (mediaStream) {
			mediaStream.getTracks().forEach(track => track.stop());
			mediaStream = null;
		}
		isRecording = false;
		console.log('[VoiceCall] Recording stopped');
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

	// Decode audio data (exact implementation from original VoiceCall.svelte)
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

	// Play audio from base64 PCM data (exact implementation from original VoiceCall.svelte)
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
	async function connect(agentId?: string) {
		if (ws && ws.readyState === WebSocket.OPEN) {
			console.log('[VoiceCall] Already connected');
			return;
		}

		status = 'connecting';
		error = null;

		try {
			const apiUrl = getApiUrl();
			// Use provided agentId or fall back to initialAgentId from options
			const effectiveAgentId = agentId || options?.initialAgentId;
			const wsUrl = effectiveAgentId 
				? `${apiUrl}/api/v0/voice/live?agentId=${encodeURIComponent(effectiveAgentId)}`
				: `${apiUrl}/api/v0/voice/live`;
			
			console.log('[VoiceCall] Connecting to WebSocket:', wsUrl);
			ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				console.log('[VoiceCall] WebSocket connected');
				status = 'connecting';
			};

			ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);

					switch (message.type) {
						case 'status':
							if (message.status === 'connected') {
								status = 'connected';
								aiState = 'listening';
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
							aiState = 'speaking';
							playAudio(message.data, 24000);
							break;

						case 'toolCall':
							aiState = 'thinking';
							// Handle tool call on client side
							// Support multiple formats:
							// 1. Direct format: {type: 'toolCall', toolName: '...', args: {...}}
							// 2. Function calls array: {type: 'toolCall', data: {functionCalls: [{name: '...', args: {...}}]}}
							// 3. Single function call: {type: 'toolCall', data: {name: '...', args: {...}}}
							
							let toolName: string | null = null;
							let toolArgs: any = {};
							
							// Format 1: Direct toolName/args
							if (message.toolName) {
								toolName = message.toolName;
								toolArgs = message.args || {};
							}
							// Format 2: Function calls array (from Google Live API)
							else if (message.data?.functionCalls && Array.isArray(message.data.functionCalls) && message.data.functionCalls.length > 0) {
								const functionCall = message.data.functionCalls[0];
								toolName = functionCall.name;
								toolArgs = functionCall.args || {};
							}
							// Format 3: Single function call object
							else if (message.data?.name) {
								toolName = message.data.name;
								toolArgs = message.data.args || {};
							}
							
							if (options?.onToolCall && toolName) {
								try {
									console.log('[VoiceCall] Executing tool call:', toolName, toolArgs);
									options.onToolCall(toolName, toolArgs);
								} catch (toolErr) {
									console.error('[VoiceCall] Tool call handler error:', toolErr);
								}
							} else {
								console.warn('[VoiceCall] Tool call received but no handler or invalid format:', message);
							}
							break;

						case 'error':
							console.error('[VoiceCall] Server error:', message.message);
							error = message.message;
							aiState = 'idle';
							break;

						case 'serverContent':
							if (message.data?.interrupted) {
								playingSources.forEach(s => {
									try { s.stop(); } catch (e) {}
								});
								playingSources.clear();
								nextStartTime = 0;
								aiState = 'listening';
							}
							break;
					}
				} catch (err) {
					console.error('[VoiceCall] Failed to parse message:', err);
				}
			};

			ws.onerror = (event) => {
				console.error('[VoiceCall] WebSocket error:', event);
				console.error('[VoiceCall] WebSocket state:', ws?.readyState, 'URL:', wsUrl);
				status = 'disconnected';
				stopRecording();
			};

			ws.onclose = (event) => {
				console.log('[VoiceCall] WebSocket closed:', event.code, event.reason, 'URL:', wsUrl);
				console.log('[VoiceCall] Close wasClean:', event.wasClean, 'code:', event.code);
				status = 'disconnected';
				stopRecording();
				
				if (event.code === 1000) {
					error = null;
				} else if (event.code === 1008 || event.reason?.includes('capability') || event.reason?.includes('Forbidden')) {
					error = 'Access denied. You need permission to use voice assistant.';
				} else if (event.code === 1001 || event.reason?.includes('Unauthorized')) {
					error = 'Please sign in to use voice assistant.';
				} else {
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

		playingSources.forEach(source => {
			try { source.stop(); } catch (e) {}
		});
		playingSources.clear();
		nextStartTime = 0;

		error = null;

		if (ws) {
			ws.close(1000, 'User ended call');
			ws = null;
		}

		status = 'disconnected';
		aiState = 'idle';
	}

	// Start call
	async function startCall(agentId?: string) {
		isWaitingForPermission = true;
		try {
			await resumeAudioContexts();
			// Use provided agentId or fall back to initialAgentId from options
			const effectiveAgentId = agentId || options?.initialAgentId;
			await connect(effectiveAgentId);
			isWaitingForPermission = false;
		} catch (err) {
			console.error('[VoiceCall] Failed to start call:', err);
			error = err instanceof Error ? err.message : 'Failed to start call';
			isWaitingForPermission = false;
			status = 'disconnected';
		}
	}

	// End call
	function endCall() {
		disconnect();
	}

	// Cleanup
	function cleanup() {
		disconnect();
		playingSources.forEach(source => {
			try { source.stop(); } catch (e) {}
		});
		playingSources.clear();
		
		if (inputAudioContext?.state !== 'closed') {
			inputAudioContext?.close();
		}
		if (outputAudioContext?.state !== 'closed') {
			outputAudioContext?.close();
		}
	}

	// Send text message (context update) to server
	function sendTextMessage(text: string, turnComplete: boolean = true) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			console.warn('[VoiceCall] Cannot send text: WebSocket not connected');
			return;
		}
		
		ws.send(JSON.stringify({
			type: "text",
			text,
			turnComplete
		}));
	}

	// Return reactive state and actions
	return {
		// Reactive getters using $derived
		get status() { return status; },
		get aiState() { return aiState; },
		get error() { return error; },
		get isWaitingForPermission() { return isWaitingForPermission; },
		get isCallActive() { return status === 'connected'; },
		get isConnecting() { return status === 'connecting'; },
		
		// Actions
		startCall,
		endCall,
		cleanup,
		sendTextMessage,
	};
}

