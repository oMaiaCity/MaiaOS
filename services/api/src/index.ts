/**
 * API Service
 * Unified API proxy for external services (Honcho, RedPill, Google Voice)
 * 
 * REST Endpoints:
 *   POST /api/v0/memory/create-session - Create Honcho session
 *   POST /api/v0/memory/add-message - Add message to Honcho session
 *   POST /api/v0/memory/get-context - Get context from Honcho
 *   POST /api/v0/memory/chat - Chat with Honcho
 *   POST /api/v0/llm/chat - RedPill LLM chat completions
 * 
 * WebSocket Endpoint:
 *   ws://localhost:4201/api/v0/voice/live - Google Live Voice API
 * 
 * Port: From PUBLIC_DOMAIN_API env var (default: 4201)
 */

import { createVoiceSessionManager } from '@MaiaOS/voice-google'
import { Honcho } from '@honcho-ai/sdk'

// Read environment variables
// Bun automatically loads .env from root when using --env-file
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || ''
const HONCHO_API_KEY = process.env.HONCHO_API_KEY || ''
const HONCHO_API_URL = process.env.HONCHO_API_URL || 'https://api.honcho.dev'
const RED_PILL_API_KEY = process.env.RED_PILL_API_KEY || ''
const PUBLIC_DOMAIN_API = process.env.PUBLIC_DOMAIN_API || 'localhost:4201'

// Parse port from PUBLIC_DOMAIN_API (format: "hostname:port" or just "port")
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

const PORT = parsePort(PUBLIC_DOMAIN_API)

console.log('[api] Starting service...')
console.log(`[api] Port: ${PORT}`)
console.log(`[api] Domain: ${PUBLIC_DOMAIN_API}`)

if (!GOOGLE_AI_API_KEY) {
	console.warn('[api] WARNING: GOOGLE_AI_API_KEY not set. Voice API will not work.')
} else {
	console.log('[api] Google AI API key is set')
}

if (!HONCHO_API_KEY) {
	console.warn('[api] WARNING: HONCHO_API_KEY not set. Memory API will not work.')
} else {
	console.log('[api] Honcho API key is set')
}

if (!RED_PILL_API_KEY) {
	console.warn('[api] WARNING: RED_PILL_API_KEY not set. LLM API will not work.')
} else {
	console.log('[api] RedPill API key is set')
}

interface WebSocketData {
	voiceSession?: ReturnType<typeof createVoiceSessionManager> extends Promise<infer T> ? T : never
}

// Helper function to create JSON response
function jsonResponse(data: any, status: number = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	})
}

// Helper function to handle CORS preflight
function handleCORS(): Response {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	})
}

// Helper function to parse JSON body
async function parseJSONBody(req: Request): Promise<any> {
	try {
		return await req.json()
	} catch (error) {
		throw new Error('Invalid JSON body')
	}
}

Bun.serve({
	port: PORT,
	fetch(req: Request, server: any) {
		const url = new URL(req.url)
		
		// Log all incoming requests for debugging
		console.log(`[api] ${req.method} ${url.pathname}`)

		// Handle CORS preflight
		if (req.method === 'OPTIONS') {
			return handleCORS()
		}

		// Health check endpoint
		if (url.pathname === '/health') {
			return jsonResponse({ status: 'ok', service: 'api' })
		}

		// Memory endpoints
		if (url.pathname === '/api/v0/memory/create-session' && req.method === 'POST') {
			return handleCreateSession(req)
		}

		if (url.pathname === '/api/v0/memory/add-message' && req.method === 'POST') {
			return handleAddMessage(req)
		}

		if (url.pathname === '/api/v0/memory/get-context' && req.method === 'POST') {
			return handleGetContext(req)
		}

		if (url.pathname === '/api/v0/memory/chat' && req.method === 'POST') {
			return handleChat(req)
		}

		// LLM endpoint
		if (url.pathname === '/api/v0/llm/chat' && req.method === 'POST') {
			console.log('[api] Handling LLM chat request')
			return handleLLMChat(req)
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
				console.error('[api] Failed to upgrade WebSocket connection')
				return new Response('Failed to upgrade to WebSocket', { status: 500 })
			}

			return undefined
		}

		return new Response('Not Found', { status: 404 })
	},
	websocket: {
		async open(ws: any) {
			console.log('[api] WebSocket connection opened')

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
						console.error('[api] Voice session error:', error)
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
					console.log('[api] Voice session created successfully')
				} else {
					console.log('[api] WebSocket closed before session creation completed, cleaning up')
					voiceSession.close()
				}
			} catch (error) {
				console.error('[api] Failed to create voice session:', error)
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
				console.warn('[api] No voice session available')
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
					console.log('[api] Activity end requested')
				} else {
					console.warn('[api] Unknown message type:', clientMessage.type)
				}
			} catch (error) {
				console.error('[api] Error processing client message:', error)
				ws.send(
					JSON.stringify({
						type: 'error',
						message: 'Failed to process message',
					}),
				)
			}
		},
		async close(ws: any) {
			console.log('[api] WebSocket connection closed')
			const data = ws.data as WebSocketData
			const voiceSession = data.voiceSession

			// Clean up voice session
			if (voiceSession) {
				try {
					voiceSession.close()
				} catch (error) {
					console.error('[api] Error closing voice session:', error)
				}
			}
		},
	},
})

// Memory endpoint handlers

async function handleCreateSession(req: Request): Promise<Response> {
	try {
		if (!HONCHO_API_KEY) {
			return jsonResponse({ error: 'HONCHO_API_KEY not configured' }, 500)
		}

		const body = await parseJSONBody(req)
		const { workspaceId = 'maiaos-dev', peerId, sessionId } = body

		if (!peerId) {
			return jsonResponse({ error: 'peerId is required' }, 400)
		}

		const honcho = new Honcho({
			workspaceId,
			apiKey: HONCHO_API_KEY,
			baseUrl: HONCHO_API_URL,
		})

		// Get or create peers (maia and samuel)
		const maiaPeer = honcho.peer('maia')
		const samuelPeer = honcho.peer('samuel')

		// Create session with specified ID or generate one
		const finalSessionId = sessionId || `session-maia-${Date.now()}`
		const session = honcho.session(finalSessionId)

		// Add both peers to session
		await session.addPeers([maiaPeer, samuelPeer])

		return jsonResponse({ sessionId: finalSessionId, workspaceId, peerId })
	} catch (error) {
		console.error('[api] Error creating session:', error)
		return jsonResponse(
			{
				error: 'Failed to create session',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		)
	}
}

async function handleAddMessage(req: Request): Promise<Response> {
	try {
		if (!HONCHO_API_KEY) {
			return jsonResponse({ error: 'HONCHO_API_KEY not configured' }, 500)
		}

		const body = await parseJSONBody(req)
		const { workspaceId = 'maiaos-dev', sessionId, peerId, content } = body

		if (!sessionId || !peerId || !content) {
			return jsonResponse({ error: 'sessionId, peerId, and content are required' }, 400)
		}

		const honcho = new Honcho({
			workspaceId,
			apiKey: HONCHO_API_KEY,
			baseUrl: HONCHO_API_URL,
		})

		const peer = honcho.peer(peerId)
		const session = honcho.session(sessionId)

		// Add message to session
		await session.addMessages([peer.message(content)])

		return jsonResponse({ success: true, sessionId, peerId, content })
	} catch (error) {
		console.error('[api] Error adding message:', error)
		return jsonResponse(
			{
				error: 'Failed to add message',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		)
	}
}

async function handleGetContext(req: Request): Promise<Response> {
	try {
		if (!HONCHO_API_KEY) {
			return jsonResponse({ error: 'HONCHO_API_KEY not configured' }, 500)
		}

		const body = await parseJSONBody(req)
		const { workspaceId = 'maiaos-dev', peerId, sessionId, query, target } = body

		if (!peerId || !query) {
			return jsonResponse({ error: 'peerId and query are required' }, 400)
		}

		const honcho = new Honcho({
			workspaceId,
			apiKey: HONCHO_API_KEY,
			baseUrl: HONCHO_API_URL,
		})

		const peer = honcho.peer(peerId)

		// Use chat endpoint to get context/insights
		const response = await peer.chat(query, {
			sessionId: sessionId || undefined,
			target: target || undefined,
		})

		// SDK returns string directly or object with content field
		const contextText = typeof response === 'string' ? response : (response?.content || response || '')

		return jsonResponse({ context: contextText })
	} catch (error) {
		console.error('[api] Error getting context:', error)
		return jsonResponse(
			{
				error: 'Failed to get context',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		)
	}
}

async function handleChat(req: Request): Promise<Response> {
	try {
		if (!HONCHO_API_KEY) {
			return jsonResponse({ error: 'HONCHO_API_KEY not configured' }, 500)
		}

		const body = await parseJSONBody(req)
		const { workspaceId = 'maiaos-dev', peerId, sessionId, query, target } = body

		if (!peerId || !query) {
			return jsonResponse({ error: 'peerId and query are required' }, 400)
		}

		const honcho = new Honcho({
			workspaceId,
			apiKey: HONCHO_API_KEY,
			baseUrl: HONCHO_API_URL,
		})

		const peer = honcho.peer(peerId)

		// Use chat endpoint
		const response = await peer.chat(query, {
			sessionId: sessionId || undefined,
			target: target || undefined,
		})

		// SDK returns string directly or object with content field
		const responseText = typeof response === 'string' ? response : (response?.content || response || '')

		return jsonResponse({ response: responseText })
	} catch (error) {
		console.error('[api] Error in chat:', error)
		return jsonResponse(
			{
				error: 'Failed to chat',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		)
	}
}

// LLM endpoint handler

async function handleLLMChat(req: Request): Promise<Response> {
	try {
		if (!RED_PILL_API_KEY) {
			return jsonResponse({ error: 'RED_PILL_API_KEY not configured' }, 500)
		}

		const body = await parseJSONBody(req)
		const { messages, model = 'moonshotai/kimi-k2.5', temperature = 1 } = body

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return jsonResponse({ error: 'messages array is required' }, 400)
		}

		const response = await fetch('https://api.redpill.ai/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${RED_PILL_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model,
				messages,
				temperature,
			}),
		})

		if (!response.ok) {
			const error = await response.text()
			return jsonResponse(
				{
					error: 'RedPill API request failed',
					message: error,
				},
				500,
			)
		}

		const data = await response.json()

		// Extract assistant message from response
		if (data.choices && data.choices.length > 0 && data.choices[0].message) {
			return jsonResponse({
				content: data.choices[0].message.content,
				role: 'assistant',
				usage: data.usage || null,
			})
		}

		return jsonResponse({ error: 'Invalid response format from API' }, 500)
	} catch (error) {
		console.error('[api] Error in LLM chat:', error)
		return jsonResponse(
			{
				error: 'Failed to process LLM request',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		)
	}
}

console.log(`🚀 API service running on port ${PORT}`)
console.log(`   REST endpoints: http://${PUBLIC_DOMAIN_API}/api/v0/{memory,llm}/*`)
console.log(`   WebSocket endpoint: ws://${PUBLIC_DOMAIN_API}/api/v0/voice/live`)
