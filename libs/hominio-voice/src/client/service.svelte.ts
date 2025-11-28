/**
 * Voice Call Service (Client)
 * Voice call service for Google Live API integration
 */

import { dispatchToolCallEvent, type ToolCallEvent } from './tool-handlers.js';

export function createVoiceCallService() {
    let isConnected = $state(false);
    let isRecording = $state(false);
    let isSpeaking = $state(false);
    let isThinking = $state(false);
    let logs = $state<string[]>([]);
    let error = $state<string | null>(null);
    
    let ws: WebSocket | null = null;
    let audioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let processor: ScriptProcessorNode | null = null;
    let input: MediaStreamAudioSourceNode | null = null;
    let nextStartTime = 0;
    let scheduledSources = new Set<AudioBufferSourceNode>();
    let isFirstAudioOfTurn = true;

    function log(msg: string) {
        console.log(`[VoiceCall] ${msg}`);
        logs.push(`${new Date().toISOString().split('T')[1].slice(0, -1)} - ${msg}`);
    }

    async function start(vibeId?: string) {
        try {
            log('Starting...');
            isFirstAudioOfTurn = true;
            
            // Audio Init
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContext = new AudioContextClass({ sampleRate: 24000 }); // Output rate
            log(`AudioContext created: ${audioContext.state}`);

            // WebSocket Init
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname === 'localhost' ? 'localhost:4204' : 'api.hominio.me';
            const wsUrl = vibeId 
                ? `${protocol}//${host}/api/v0/voice/live?vibeId=${encodeURIComponent(vibeId)}`
                : `${protocol}//${host}/api/v0/voice/live`;
            
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                log('WebSocket connected');
                isConnected = true;
            };

            ws.onmessage = async (e) => {
                const msg = JSON.parse(e.data);
                if (msg.type === 'status') log(`Status: ${msg.status}`);
                if (msg.type === 'log') {
                    // Handle context injection logs
                    let logMsg = msg.message;
                    if (msg.context) {
                        const preview = msg.context.substring(0, 200);
                        logMsg += `\n   Context preview: ${preview}${msg.context.length > 200 ? '...' : ''}`;
                    }
                    log(logMsg);
                    
                    // Dispatch log event for activity stream
                    const logEvent = new CustomEvent('voiceLog', {
                        detail: {
                            message: msg.message,
                            context: msg.context,
                            timestamp: Date.now()
                        }
                    });
                    window.dispatchEvent(logEvent);
                }
                if (msg.type === 'transcript') {
                    log(`${msg.role === 'user' ? '👤' : '🤖'} ${msg.text}`);
                    if (msg.role === 'user') {
                        isFirstAudioOfTurn = true; // Reset on user speech
                    }
                    if (msg.role === 'model') {
                        isThinking = false; // Transcript means thinking done/response starting
                    }
                }
                if (msg.type === 'toolCall') {
                    log(`🔧 Tool Call: ${msg.name} ${JSON.stringify(msg.args)}`);
                    if (msg.contextString) {
                        const preview = msg.contextString.substring(0, 200);
                        log(`   Context: ${preview}${msg.contextString.length > 200 ? '...' : ''}`);
                    }
                    isThinking = true;
                    
                    // Dispatch toolCall event for activity stream using shared utility
                    const toolCallEvent: ToolCallEvent = {
                        toolName: msg.name as any,
                        args: msg.args,
                        contextString: msg.contextString,
                        result: msg.result,
                        timestamp: Date.now()
                    };
                    dispatchToolCallEvent(toolCallEvent);
                }
                if (msg.type === 'toolResult') {
                    log(`✅ Tool Result: ${msg.name} ${JSON.stringify(msg.result)}`);
                }
                if (msg.type === 'interrupted') {
                    log('🛑 AI Interrupted');
                    isFirstAudioOfTurn = true; // Reset on interruption
                    isThinking = false;
                    // Stop all scheduled audio sources immediately
                    if (audioContext) {
                        scheduledSources.forEach(source => {
                            try { source.stop(); } catch (e) {}
                        });
                        scheduledSources.clear();
                        nextStartTime = audioContext.currentTime;
                        isSpeaking = false;
                    }
                }
                if (msg.type === 'audio') {
                    if (isThinking) isThinking = false; // Audio means response started
                    if (isFirstAudioOfTurn) {
                        log('🔊 First audio chunk received');
                        isFirstAudioOfTurn = false;
                    }
                    isSpeaking = true;
                    await playAudio(msg.data);
                }
            };

            ws.onerror = (event) => {
                console.error('[VoiceCall] WebSocket error:', event);
                error = 'Connection error. Please try again.';
            };

            ws.onclose = (event) => {
                log('WebSocket closed');
                isConnected = false;
                
                if (event.code === 1008 || event.reason?.includes('capability') || event.reason?.includes('Forbidden')) {
                    error = 'Access denied. You need permission to use voice assistant.';
                } else if (event.code === 1001 || event.reason?.includes('Unauthorized')) {
                    error = 'Please sign in to use voice assistant.';
                } else if (event.code !== 1000) {
                    error = 'Connection error. Please try again.';
                } else {
                    error = null;
                }
                
                stop();
            };

            // Mic Init
            stream = await navigator.mediaDevices.getUserMedia({ audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true
            }});
            
            // Check if stopped during mic init
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                log('Connection closed during mic init, aborting');
                if (stream) stream.getTracks().forEach(t => t.stop());
                return;
            }
            
            const micContext = new AudioContext({ sampleRate: 16000 });
            input = micContext.createMediaStreamSource(stream);
            processor = micContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
                if (!ws || ws.readyState !== WebSocket.OPEN) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Convert Float32 to Int16
                const int16Data = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                
                // Base64 encode
                const base64 = btoa(String.fromCharCode(...new Uint8Array(int16Data.buffer)));
                
                ws.send(JSON.stringify({ type: 'audio', data: base64 }));
            };

            input.connect(processor);
            processor.connect(micContext.destination);
            isRecording = true;
            log('Recording started');

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to start call';
            log(`Error: ${errorMsg}`);
            error = errorMsg;
        }
    }

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

    async function playAudio(base64: string) {
        if (!audioContext) return;
        
        // Resume if suspended
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Int16 to Float32
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for(let i=0; i<int16.length; i++) {
            float32[i] = int16[i] / 32768.0;
        }

        const buffer = audioContext.createBuffer(1, float32.length, 24000);
        buffer.copyToChannel(float32, 0);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        
        const startTime = Math.max(audioContext.currentTime, nextStartTime);
        source.start(startTime);
        nextStartTime = startTime + buffer.duration;
        scheduledSources.add(source);
        
        source.onended = () => {
            scheduledSources.delete(source);
            if (audioContext && audioContext.currentTime >= nextStartTime) {
                isSpeaking = false;
            }
        };
    }

    function stop() {
        log('Stopping...');
        if (ws) ws.close();
        if (stream) stream.getTracks().forEach(t => t.stop());
        if (processor) processor.disconnect();
        if (input) input.disconnect();
        
        scheduledSources.forEach(s => { try { s.stop(); } catch (e) {} });
        scheduledSources.clear();
        
        if (audioContext) audioContext.close();
        
        isConnected = false;
        isRecording = false;
        isSpeaking = false;
        error = null;
        ws = null;
        audioContext = null;
        stream = null;
        processor = null;
        input = null;
        nextStartTime = 0;
    }

    function cleanup() {
        stop();
    }

    return {
        get isConnected() { return isConnected },
        get isRecording() { return isRecording },
        get isSpeaking() { return isSpeaking },
        get isThinking() { return isThinking },
        get logs() { return logs },
        get error() { return error },
        start,
        stop,
        sendTextMessage,
        cleanup
    };
}

