/**
 * API Service
 * Unified API proxy for external services (RedPill LLM)
 * 
 * REST Endpoints:
 *   POST /api/v0/llm/chat - RedPill LLM chat completions (via Vercel AI SDK)
 * 
 * Port: From PUBLIC_DOMAIN_API env var (default: 4201)
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

// Read environment variables
// Bun automatically loads .env from root when using --env-file
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

if (!RED_PILL_API_KEY) {
	console.warn('[api] WARNING: RED_PILL_API_KEY not set. LLM API will not work.')
} else {
	console.log('[api] RedPill API key is set')
}

// Create RedPill provider instance using Vercel AI SDK
// RedPill is OpenAI-compatible, so we use createOpenAI with custom baseURL
const redpill = RED_PILL_API_KEY
	? createOpenAI({
			apiKey: RED_PILL_API_KEY,
			baseURL: 'https://api.redpill.ai/v1',
	  })
	: null

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

		// LLM endpoint
		if (url.pathname === '/api/v0/llm/chat' && req.method === 'POST') {
			return handleLLMChat(req)
		}

		return new Response('Not Found', { status: 404 })
	},
})

// LLM endpoint handler
// RedPill API endpoint is hardcoded, but model can be configured dynamically per request
// Uses Vercel AI SDK with RedPill provider for better streaming support and unified API

async function handleLLMChat(req: Request): Promise<Response> {
	try {
		if (!RED_PILL_API_KEY || !redpill) {
			return jsonResponse({ error: 'RED_PILL_API_KEY not configured' }, 500)
		}

		const body = await parseJSONBody(req)
		// Model is dynamically configurable via request payload - each tool call can specify which LLM to use
		const { messages, model = 'qwen/qwen3-30b-a3b-instruct-2507', temperature = 1 } = body

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return jsonResponse({ error: 'messages array is required' }, 400)
		}

		// Use Vercel AI SDK generateText with RedPill provider
		const result = await generateText({
			model: redpill(model),
			messages,
			temperature,
		})

		const responseText = result.text || ''

		// Map Vercel AI SDK response to existing format for backwards compatibility
		return jsonResponse({
			content: responseText,
			role: 'assistant',
			usage: result.usage || null,
		})
	} catch (error) {
		console.error('[api/llm] ❌ Error in LLM chat:', error)
		
		// Handle Vercel AI SDK errors
		if (error instanceof Error) {
			return jsonResponse(
				{
					error: 'Failed to process LLM request',
					message: error.message,
				},
				500,
			)
		}

		return jsonResponse(
			{
				error: 'Failed to process LLM request',
				message: 'Unknown error',
			},
			500,
		)
	}
}

console.log(`🚀 API service running on port ${PORT}`)
console.log(`   REST endpoints: http://${PUBLIC_DOMAIN_API}/api/v0/llm/chat`)
