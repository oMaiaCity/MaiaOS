/**
 * Voice Call Service
 * WebSocket proxy for Google Live Voice API
 * 
 * Endpoint: /api/v0/voice/live
 * Port: From PUBLIC_DOMAIN_VOICE env var (default: 4201)
 */

import { createVoiceSessionManager } from '@hominio/voice'

// Read environment variables
// Bun automatically loads .env from root when using --env-file
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || ''
const PUBLIC_DOMAIN_VOICE = process.env.PUBLIC_DOMAIN_VOICE || 'localhost:4201'

// Parse port from PUBLIC_DOMAIN_VOICE (format: "hostname:port" or just "port")
const parsePort = (domain: string): number => {
	const parts = domain.split(':')
	if (parts.length > 1) {
		const port = parseInt(parts[parts.length - 1], 10)
		if (!isNaN(port)) return port
	}
	// If no port specified, try parsing as number
	const port = parseInt(domain, 10)
	return !isNaN(port) ? port : 4201
}

const PORT = parsePort(PUBLIC_DOMAIN_VOICE)

console.log('[voice-call] Starting service...')
console.log(`[voice-call] Port: ${PORT}`)
console.log(`[voice-call] Domain: ${PUBLIC_DOMAIN_VOICE}`)
console.log(`[voice-call] Env PUBLIC_DOMAIN_VOICE: ${process.env.PUBLIC_DOMAIN_VOICE || 'not set (using default)'}`)

if (!GOOGLE_AI_API_KEY) {
	console.warn('[voice-call] WARNING: GOOGLE_AI_API_KEY not set. Voice API will not work.')
} else {
	console.log('[voice-call] Google AI API key is set')
}

interface WebSocketData {
	voiceSession?: ReturnType<typeof createVoiceSessionManager> extends Promise<infer T> ? T : never
}

Bun.serve({
	port: PORT,
	fetch(req: Request, server: any) {
		const url = new URL(req.url)

		// Health check endpoint
		if (url.pathname === '/health') {
			return new Response(JSON.stringify({ status: 'ok', service: 'voice-call' }), {
				headers: { 'Content-Type': 'application/json' },
			})
		}

		// WebSocket upgrade for voice endpoint
		if (url.pathname === '/api/v0/voice/live') {
			// Check if this is a WebSocket upgrade request
			if (req.headers.get('upgrade') !== 'websocket') {
				return new Response('Expected WebSocket upgrade', { status: 426 })
			}

			const upgraded = server.upgrade(req, {
				data: {} as WebSocketData,
			})

			if (!upgraded) {
				console.error('[voice-call] Failed to upgrade WebSocket connection')
				return new Response('Failed to upgrade to WebSocket', { status: 500 })
			}

			return undefined
		}

		return new Response('Not Found', { status: 404 })
	},
	websocket: {
		async open(ws: any) {
			console.log('[voice-call] WebSocket connection opened')

			try {
				// Create voice session manager (simple conversation, no tools)
				const voiceSession = await createVoiceSessionManager({
					apiKey: GOOGLE_AI_API_KEY,
					enableTools: false, // Disable tools for simple conversation
					systemInstruction: 'You are a helpful AI assistant. Help users with their questions and tasks. Be conversational and friendly.',
					onLog: (message: string, context?: string) => {
						// Only send if WebSocket is still open
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(
								JSON.stringify({
									type: 'log',
									message,
									context,
								}),
							)
						}
					},
					onToolCall: (toolName: string, args: any, result: any, contextString?: string) => {
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(
								JSON.stringify({
									type: 'toolCall',
									name: toolName,
									args,
									result,
									contextString,
								}),
							)
						}
					},
					onContextIngest: (event: any) => {
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(
								JSON.stringify({
									type: 'contextIngest',
									event,
								}),
							)
						}
					},
					onAudio: (data: string, mimeType?: string) => {
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(
								JSON.stringify({
									type: 'audio',
									data,
									mimeType,
								}),
							)
						}
					},
					onTranscript: (role: 'user' | 'model', text: string) => {
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(
								JSON.stringify({
									type: 'transcript',
									role,
									text,
								}),
							)
						}
					},
					onInterrupted: () => {
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(
								JSON.stringify({
									type: 'interrupted',
								}),
							)
						}
					},
					onStatus: (status: 'connected' | 'disconnected') => {
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(
								JSON.stringify({
									type: 'status',
									status,
								}),
							)
						}
					},
					onError: (error: Error) => {
						console.error('[voice-call] Voice session error:', error)
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(
								JSON.stringify({
									type: 'error',
									message: error.message || 'Unknown error',
								}),
							)
						}
					},
				})

				// Check if WebSocket is still open before storing session
				if (ws.readyState === WebSocket.OPEN) {
					;(ws.data as WebSocketData).voiceSession = voiceSession
					ws.send(JSON.stringify({ type: 'status', status: 'connected', message: 'Voice session started' }))
					console.log('[voice-call] Voice session created successfully')
				} else {
					console.log('[voice-call] WebSocket closed before session creation completed, cleaning up')
					voiceSession.close()
				}
			} catch (error) {
				console.error('[voice-call] Failed to create voice session:', error)
				if (ws.readyState === WebSocket.OPEN) {
					ws.send(
						JSON.stringify({
							type: 'error',
							message: error instanceof Error ? error.message : 'Failed to create voice session',
						}),
					)
					ws.close(1011, 'Failed to start voice session')
				}
			}
		},
		async message(ws: any, message: string | Buffer) {
			const data = ws.data as WebSocketData
			const voiceSession = data.voiceSession

			if (!voiceSession) {
				console.warn('[voice-call] No voice session available')
				ws.send(
					JSON.stringify({
						type: 'error',
						message: 'Not connected to voice session',
					}),
				)
				return
			}

			try {
				// Parse client message
				let clientMessage: any
				if (typeof message === 'string') {
					clientMessage = JSON.parse(message)
				} else if (message instanceof Buffer) {
					clientMessage = JSON.parse(message.toString())
				} else {
					clientMessage = message
				}

				// Handle different message types from client
				if (clientMessage.type === 'audio' && clientMessage.data) {
					// Forward audio to Google Live API
					voiceSession.sendAudio(
						clientMessage.data,
						clientMessage.mimeType || 'audio/pcm;rate=16000',
					)
				} else if (clientMessage.type === 'text' && clientMessage.text) {
					// Forward text to Google Live API
					voiceSession.sendText(clientMessage.text, clientMessage.turnComplete !== false)
				} else if (clientMessage.type === 'activityEnd') {
					// Signal end of user activity (if supported)
					// Note: This might need to be handled differently depending on the API
					console.log('[voice-call] Activity end requested')
				} else {
					console.warn('[voice-call] Unknown message type:', clientMessage.type)
				}
			} catch (error) {
				console.error('[voice-call] Error processing client message:', error)
				ws.send(
					JSON.stringify({
						type: 'error',
						message: 'Failed to process message',
					}),
				)
			}
		},
		async close(ws: any) {
			console.log('[voice-call] WebSocket connection closed')
			const data = ws.data as WebSocketData
			const voiceSession = data.voiceSession

			// Clean up voice session
			if (voiceSession) {
				try {
					voiceSession.close()
				} catch (error) {
					console.error('[voice-call] Error closing voice session:', error)
				}
			}
		},
	},
})

console.log(`🎤 Voice call service running on port ${PORT}`)
console.log(`   WebSocket endpoint: ws://${PUBLIC_DOMAIN_VOICE}/api/v0/voice/live`)

