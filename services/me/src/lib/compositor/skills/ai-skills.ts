/**
 * AI Skills - Skills for interacting with AI models via RedPill API
 * 
 * JAZZ-NATIVE ARCHITECTURE:
 * - Skills accept actor: any (Jazz CoMap instance)
 * - Skills mutate Jazz CoValues directly
 * - UI updates reactively via useQuery
 */

import type { Skill } from './types'
import { CoState } from 'jazz-tools/svelte'
import { Actor } from '@maia/db'
import { createActorLogger } from '../utilities/logger'

/**
 * Build conversation history from in-memory messages array
 * Reads from messagesListActor.context.messages
 */
async function buildConversationHistory(
	messagesListActor: any,
	systemPrompt?: string,
): Promise<Array<{ role: string; content: string }>> {
	const messages: Array<{ role: string; content: string }> = []

	// Add system prompt first
	if (systemPrompt) {
		messages.push({ role: 'system', content: systemPrompt })
	}

	// Get messages from actor context (in-memory array)
	const contextMessages = messagesListActor?.context?.messages || []
	
	// Convert to OpenAI message format
	for (const msg of contextMessages) {
		if (msg.role && msg.content) {
			messages.push({
				role: msg.role, // 'user' or 'assistant'
				content: msg.content,
			})
		}
	}

	return messages
}

/**
 * Chat with RedPill AI
 * Sends user message, gets AI response, stores both as ChatMessage entities
 */
const chatRedPillSkill: Skill = {
	metadata: {
		id: '@ai/chatRedPill',
		name: 'Chat with RedPill AI',
		description: 'Sends a message to RedPill AI and stores the conversation',
		category: 'ai',
		parameters: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					description: 'The user message to send',
					required: true,
				},
				conversationId: {
					type: 'string',
					description: 'Optional: Group messages by conversation ID',
					required: false,
				},
				model: {
					type: 'string',
					description: 'Optional: Override default model (default: minimax/minimax-m2.1)',
					required: false,
				},
				systemPrompt: {
					type: 'string',
					description: 'Optional: System instruction for the AI',
					required: false,
				},
			},
			required: ['message'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any, message?: any) => {
		const payloadData = (payload as {
			message?: string
			conversationId?: string
			model?: string
			systemPrompt?: string
		}) || {}

		const userMessage = payloadData.message
		if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
			actor.context.error = 'Message is required'
			await actor.$jazz.waitForSync()
			return
		}

		// Prevent duplicate requests - check if already processing
		if (actor.context.isProcessing) {
			console.log('[ai-skills] Already processing a request, skipping duplicate')
			return
		}

		// Find child actors from root context
		let messagesListActor: any = null
		let inputSectionActor: any = null
		let processingIndicatorActor: any = null
		let errorDisplayActor: any = null

		// Get actor IDs from root context
		if (actor.context?.messagesListActorId) {
			const messagesCoState = new CoState(Actor, actor.context.messagesListActorId)
			messagesListActor = messagesCoState.current
		}
		if (actor.context?.inputSectionActorId) {
			const inputCoState = new CoState(Actor, actor.context.inputSectionActorId)
			inputSectionActor = inputCoState.current
		}
		if (actor.context?.processingIndicatorActorId) {
			const processingCoState = new CoState(Actor, actor.context.processingIndicatorActorId)
			processingIndicatorActor = processingCoState.current
		}
		if (actor.context?.errorDisplayActorId) {
			const errorCoState = new CoState(Actor, actor.context.errorDisplayActorId)
			errorDisplayActor = errorCoState.current
		}

		// Mark as processing
		if (actor.context) {
			actor.context.isProcessing = true
			actor.context.error = null
			await actor.$jazz.waitForSync()
		}
		if (inputSectionActor?.context) {
			inputSectionActor.context.isProcessing = true
			await inputSectionActor.$jazz.waitForSync()
		}
		if (processingIndicatorActor?.context) {
			processingIndicatorActor.context.isProcessing = true
			await processingIndicatorActor.$jazz.waitForSync()
		}
		if (errorDisplayActor?.context) {
			errorDisplayActor.context.error = null
			await errorDisplayActor.$jazz.waitForSync()
		}

		try {
			// Build conversation history from in-memory messages
			const conversationHistory = await buildConversationHistory(
				messagesListActor,
				payloadData.systemPrompt ||
					'You are Maia AI, helping users create vibes and build the future. Be helpful, creative, and inspiring.',
			)

			// Add current user message
			const trimmedMessage = userMessage.trim()
			conversationHistory.push({
				role: 'user',
				content: trimmedMessage,
			})

			// Call RedPill API via server route
			const response = await fetch('/api/redpill/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: payloadData.model || 'minimax/minimax-m2.1',
					messages: conversationHistory,
				}),
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
				
				// Provide helpful error messages for common status codes
				let errorMessage = errorData.error || `API error: ${response.status}`
				
				if (response.status === 402) {
					errorMessage = 'Payment Required: Your RedPill account needs credits. Please add credits to your RedPill account.'
				} else if (response.status === 401) {
					errorMessage = 'Unauthorized: Invalid API key. Please check your RED_PILL_API_KEY.'
				} else if (response.status === 429) {
					errorMessage = 'Rate Limit Exceeded: Too many requests. Please try again later.'
				}
				
				throw new Error(errorMessage)
			}

			const data = await response.json()
			let assistantMessage = data.choices?.[0]?.message?.content

			if (!assistantMessage) {
				throw new Error('No response from AI')
			}

			// Strip leading/trailing whitespace and normalize newlines
			assistantMessage = assistantMessage.trim().replace(/^\n+/, '')

			// Add messages to in-memory array
			if (messagesListActor?.context) {
				const currentMessages = messagesListActor.context.messages || []
				const updatedMessages = [
					...currentMessages,
					{ role: 'user', content: trimmedMessage },
					{ role: 'assistant', content: assistantMessage }
				]
				messagesListActor.context.messages = updatedMessages
				await messagesListActor.$jazz.waitForSync()
			}

			// Clear input field and reset processing flags
			if (inputSectionActor?.context) {
				inputSectionActor.context.inputText = ''
				inputSectionActor.context.isProcessing = false
				await inputSectionActor.$jazz.waitForSync()
			}
			if (processingIndicatorActor?.context) {
				processingIndicatorActor.context.isProcessing = false
				await processingIndicatorActor.$jazz.waitForSync()
			}
			if (actor.context) {
				actor.context.isProcessing = false
				actor.context.error = null
				await actor.$jazz.waitForSync()
			}
		} catch (error) {
			console.error('[ai-skills] @ai/chatRedPill error:', error)
			const errorMessage = error instanceof Error ? error.message : 'Failed to chat with AI'
			
			// Set error and reset processing flags
			if (errorDisplayActor?.context) {
				errorDisplayActor.context.error = errorMessage
				await errorDisplayActor.$jazz.waitForSync()
			}
			if (inputSectionActor?.context) {
				inputSectionActor.context.isProcessing = false
				await inputSectionActor.$jazz.waitForSync()
			}
			if (processingIndicatorActor?.context) {
				processingIndicatorActor.context.isProcessing = false
				await processingIndicatorActor.$jazz.waitForSync()
			}
			if (actor.context) {
				actor.context.error = errorMessage
				actor.context.isProcessing = false
				await actor.$jazz.waitForSync()
			}
		}
	},
}

export const aiSkills: Record<string, Skill> = {
	'@ai/chatRedPill': chatRedPillSkill,
}
