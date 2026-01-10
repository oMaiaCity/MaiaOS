/**
 * Server-side API route to proxy RedPill OpenAI-compatible chat completions
 * Wraps RedPill API with OpenAI-compatible format
 */

import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'

export const POST: RequestHandler = async ({ request }) => {
	const RED_PILL_API_KEY = env.RED_PILL_API_KEY

	if (!RED_PILL_API_KEY) {
		return json({ error: 'RED_PILL_API_KEY not configured' }, { status: 500 })
	}

	try {
		const body = await request.json()

		// Validate request body
		if (!body.messages || !Array.isArray(body.messages)) {
			return json({ error: 'messages array is required' }, { status: 400 })
		}

		// Default model if not specified
		const model = body.model || 'minimax/minimax-m2.1'

		// Forward to RedPill API
		const response = await fetch('https://api.redpill.ai/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${RED_PILL_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model,
				messages: body.messages,
				...(body.cache_control && { cache_control: body.cache_control }),
				...(body.temperature !== undefined && { temperature: body.temperature }),
				...(body.max_tokens !== undefined && { max_tokens: body.max_tokens }),
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			return json(
				{ error: `RedPill API error: ${response.status} ${response.statusText}`, details: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()

		// Return OpenAI-compatible response
		return json(data)
	} catch (error) {
		console.error('[RedPill API] Error:', error)
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 },
		)
	}
}
