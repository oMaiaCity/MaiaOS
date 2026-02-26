/**
 * AI Chat Actor - @ai/chat
 *
 * Unified AI chat using OpenAI-compatible API (RedPill via moai proxy).
 * LLM loop runs client-side: Runtime.collectTools + Runtime.executeToolCall.
 * Moai is LLM proxy only (no tool execution).
 *
 * Usage in process:
 *   {"actor": "@ai/chat", "payload": {"context": [...], "model": "qwen/..."}}
 */

import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
} from '@MaiaOS/schemata/operation-result'
import { getApiBaseUrl, toStructuredErrors } from '../../shared/api-helpers.js'

const MAX_TURNS = 4

export default {
	async execute(actor, payload) {
		const context = payload?.context || payload?.messages
		const { model = 'qwen/qwen3-30b-a3b-instruct-2507', temperature = 1 } = payload

		if (!context || !Array.isArray(context) || context.length === 0) {
			return createErrorResult([
				createErrorEntry('structural', '[@ai/chat] context array is required'),
			])
		}

		const runtime = actor?.actorOps?.runtime
		if (!runtime?.collectTools || !runtime?.executeToolCall) {
			return createErrorResult([
				createErrorEntry(
					'structural',
					'[@ai/chat] Runtime.collectTools and executeToolCall required. Ensure Loader has runtime (browser).',
				),
			])
		}

		const apiUrl = `${getApiBaseUrl()}/api/v0/llm/chat`
		const tools = await runtime.collectTools()
		const currentMessages = [...context]

		for (let turn = 0; turn < MAX_TURNS; turn++) {
			const passTools = turn === 0 && tools.length > 0
			const reqBody = {
				model,
				messages: currentMessages,
				temperature,
				...(passTools && { tools }),
			}

			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(reqBody),
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
				return createErrorResult(toStructuredErrors(errorData))
			}

			const data = await response.json()
			const choice = data.choices?.[0]
			const msg = choice?.message

			if (!msg) {
				return createErrorResult([createErrorEntry('structural', '[@ai/chat] LLM returned no message')])
			}

			const toolCalls = msg.tool_calls
			if (!toolCalls || toolCalls.length === 0) {
				const content = typeof msg.content === 'string' ? msg.content : ''
				return createSuccessResult({
					content,
					model: data.model ?? model,
				})
			}

			currentMessages.push({
				role: 'assistant',
				content: msg.content ?? null,
				tool_calls: toolCalls,
			})

			let lastActionSummary = null
			let anyToolFailed = false
			for (const tc of toolCalls) {
				const name = tc.function?.name ?? tc.name
				let raw = tc.function?.arguments ?? tc.arguments ?? '{}'
				if (typeof raw !== 'string') raw = JSON.stringify(raw)
				let args = {}
				try {
					args = JSON.parse(raw)
				} catch {}
				lastActionSummary =
					typeof args.actionSummary === 'string' ? args.actionSummary : lastActionSummary
				const result = await runtime.executeToolCall(actor, name, args)
				if (result?.ok === false) anyToolFailed = true
				currentMessages.push({
					role: 'tool',
					tool_call_id: tc.id,
					content: typeof result === 'string' ? result : JSON.stringify(result ?? {}),
				})
			}

			if (!anyToolFailed && lastActionSummary) {
				return createSuccessResult({
					content: lastActionSummary,
					model: data.model ?? model,
				})
			}
		}

		return createErrorResult([createErrorEntry('structural', '[@ai/chat] Max tool turns reached')])
	},
}
