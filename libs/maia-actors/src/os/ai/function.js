/**
 * AI Chat Actor - @ai/chat
 *
 * Unified AI chat using Vercel AI SDK (via API service) for LLM interactions.
 * Supports OpenAI-compatible APIs (e.g., RedPill) via local API service proxy.
 *
 * Usage in state machines:
 *   {"actor": "@ai/chat", "payload": {"context": [...], "model": "minimax/minimax-m2.1"}}
 */

import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
} from '@MaiaOS/schemata/operation-result'
import { getApiBaseUrl, toStructuredErrors } from '../../shared/api-helpers.js'

export default {
	async execute(_actor, payload) {
		const context = payload?.context || payload?.messages
		const { model = 'qwen/qwen3-30b-a3b-instruct-2507', temperature = 1 } = payload

		if (!context || !Array.isArray(context) || context.length === 0) {
			return createErrorResult([
				createErrorEntry('structural', '[@ai/chat] context array is required'),
			])
		}

		const apiUrl = `${getApiBaseUrl()}/api/v0/llm/chat`
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, messages: context, temperature }),
		})

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
			return createErrorResult(toStructuredErrors(errorData))
		}

		const data = await response.json()
		const content = typeof data?.content === 'string' ? data.content : ''
		if (!content) {
			return createErrorResult([
				createErrorEntry(
					'structural',
					`[@ai/chat] LLM returned empty content. API status 200 but content missing. Check moai logs if 500 occurs.`,
				),
			])
		}
		return createSuccessResult({
			content,
			model: data.model ?? model,
		})
	},
}
