/**
 * Voice Session Manager
 * Manages Google Live API session with tools and context injection
 */

import { GoogleGenAI, Modality } from '@google/genai'
import { type ContextIngestEvent, ContextIngestService } from './context-injection.js'
import { ToolRegistry, type ToolResult } from './tools/registry.js'

export interface VoiceSessionManagerOptions {
	apiKey: string
	model?: string
	systemInstruction?: string // Optional: custom system instruction (defaults to simple prompt)
	enableTools?: boolean // Optional: enable tools (defaults to false for simple conversation)
	onLog?: (message: string, context?: string) => void
	onToolCall?: (toolName: string, args: any, result: any, contextString?: string) => void
	onContextIngest?: (event: ContextIngestEvent) => void
	onAudio?: (data: string, mimeType?: string) => void
	onTranscript?: (role: 'user' | 'model', text: string) => void
	onInterrupted?: () => void
	onStatus?: (status: 'connected' | 'disconnected') => void
	onError?: (error: Error) => void
}

export interface VoiceSessionManager {
	handleGoogleMessage(message: any): void
	sendAudio(data: string, mimeType?: string): void
	sendText(text: string, turnComplete?: boolean): void
	sendActivityEnd(): void
	getContextIngest(): ContextIngestService
	close(): void
}

export async function createVoiceSessionManager(
	options: VoiceSessionManagerOptions,
): Promise<VoiceSessionManager> {
	const {
		apiKey,
		model = 'gemini-2.5-flash-native-audio-preview-09-2025',
		systemInstruction: customSystemInstruction,
		enableTools = false,
		onLog,
		onToolCall,
		onContextIngest,
		onAudio,
		onTranscript,
		onInterrupted,
		onStatus,
		onError,
	} = options

	if (!apiKey || apiKey.trim().length === 0) {
		throw new Error('Google AI API key is required but not provided')
	}

	const ai = new GoogleGenAI({ apiKey })

	// Use custom system instruction or default simple one
	const systemInstruction =
		customSystemInstruction ||
		'You are a helpful AI assistant. Help users with their questions and tasks. Be conversational and friendly.'

	// Initialize tools only if enabled
	let toolRegistry: ToolRegistry | null = null
	let tools: any[] = []
	if (enableTools) {
		try {
			toolRegistry = new ToolRegistry()
			await toolRegistry.initialize()
			tools = await toolRegistry.buildToolSchemas()
		} catch (err) {
			onLog?.(
				`Warning: Failed to initialize tools: ${err instanceof Error ? err.message : String(err)}. Continuing without tools.`,
			)
			tools = []
			toolRegistry = null
		}
	}

	// Create Google Live API session
	const session = await ai.live.connect({
		model,
		config: {
			responseModalities: [Modality.AUDIO],
			systemInstruction: {
				parts: [{ text: systemInstruction }],
			},
			speechConfig: {
				voiceConfig: {
					prebuiltVoiceConfig: {
						voiceName: 'Sadachbia',
					},
				},
			},
			tools,
		},
		callbacks: {
			onopen: () => {
				console.log(`[VoiceSession] Google Live API connection opened`)
				onStatus?.('connected')
			},
			onmessage: async (message: any) => {
				try {
					// Log ALL messages from Google for debugging
					console.log(`[VoiceSession] Received message from Google:`, JSON.stringify(message, null, 2).substring(0, 500))
					
					// Handle user interruption
					if (message.serverContent?.interrupted) {
						console.log(`[VoiceSession] User interrupted`)
						onInterrupted?.()
					}

					// Handle server content (model responses)
					if (message.serverContent) {
						console.log(`[VoiceSession] Processing serverContent:`, {
							hasModelTurn: !!message.serverContent.modelTurn,
							hasParts: !!message.serverContent.modelTurn?.parts,
							turnComplete: message.serverContent.turnComplete
						})
						
						const parts = message.serverContent?.modelTurn?.parts || []
						
						// Debug: log parts structure
						if (parts.length > 0) {
							console.log(`[VoiceSession] Received ${parts.length} parts from Google`)
							parts.forEach((part: any, idx: number) => {
								console.log(`[VoiceSession] Part ${idx}:`, {
									hasText: !!part.text,
									textPreview: part.text?.substring(0, 50),
									hasInlineData: !!part.inlineData,
									hasFunctionCall: !!part.functionCall,
									inlineDataType: part.inlineData?.mimeType,
									inlineDataLength: part.inlineData?.data?.length,
									partKeys: Object.keys(part)
								})
							})
						} else {
							console.log(`[VoiceSession] No parts found in modelTurn`)
						}

						// Process audio first (highest priority)
						let audioFound = false
						for (const part of parts) {
							if (part.inlineData?.data) {
								audioFound = true
								console.log(`[VoiceSession] ✅ Sending audio to callback: ${part.inlineData.data.length} chars, mimeType: ${part.inlineData.mimeType}`)
								onAudio?.(part.inlineData.data, part.inlineData.mimeType)
							}
						}
						
						if (!audioFound && parts.length > 0) {
							console.log(`[VoiceSession] ⚠️ No audio found in ${parts.length} parts`)
						}

						// Process text transcripts
						const textParts = parts.filter((p: any) => p.text)
						if (textParts.length > 0) {
							const text = textParts.map((p: any) => p.text).join('')
							onTranscript?.('model', text)
						}

						// Handle function calls from parts
						for (const part of parts) {
							if (part.functionCall) {
								// Google GenAI SDK: part.functionCall has { name?, args?, id? } structure
								if (!part.functionCall.name) {
								}
								await handleFunctionCall(part.functionCall)
							}
						}

						// Handle turn complete
						if (message.serverContent.turnComplete) {
							// Turn complete handling if needed
						}
					}

					// Handle user transcripts
					if (message.clientContent?.userTurn) {
						const parts = message.clientContent.userTurn.parts || []
						const text = parts
							.filter((p: any) => p.text)
							.map((p: any) => p.text)
							.join('')
						if (text) {
							onTranscript?.('user', text)
						}
					}

					// Handle top-level tool calls
					if (message.toolCall) {
						const functionCalls = message.toolCall.functionCalls || []
						for (const call of functionCalls) {
							if (!call.name) {
							}
							await handleFunctionCall(call)
						}
					}
				} catch (err) {
					onError?.(err instanceof Error ? err : new Error(String(err)))
				}
			},
			onclose: () => {
				console.log(`[VoiceSession] Google Live API connection closed`)
				onStatus?.('disconnected')
			},
			onerror: (err: any) => {
				const errorMessage = err instanceof Error ? err.message : String(err)
				console.error(`[VoiceSession] Google Live API error:`, errorMessage)
				onError?.(err instanceof Error ? err : new Error(String(err)))
			},
		},
	})

	// Create context ingest service
	const contextIngest = new ContextIngestService({
		session,
		onLog,
		onContextIngest,
	})

	// Function call handler
	async function handleFunctionCall(functionCall: any) {
		// Google GenAI SDK structure: { name?, args?, id? }
		// According to docs, name is optional but we require it for tool execution
		const name = functionCall.name
		const args = functionCall.args || {}
		const id = functionCall.id

		if (!name) {
			// Don't process function calls without names - they're invalid
			return
		}

		// Validate tool call ID - required for sending response
		if (!id) {
			// Still try to send error response, but log the issue
			onLog?.(`⚠️ Tool call ${name} missing ID - response may fail`)
		}

		// Silent - don't log function calls (too verbose)

		// Filter out legacy tools - don't execute or notify frontend
		if (name === 'queryVibeContext' || name === 'actionSkill' || name === 'delegateIntent') {
			onLog?.(`⚠️ Legacy tool ${name} is no longer supported.`)
			// Return error response to AI
			try {
				await contextIngest.ingestToolResponse(
					name,
					{
						error: `Tool ${name} is no longer available. Use queryTodos or createTodo directly.`,
					},
					id || 'unknown',
					'silent',
				)
			} catch (_err) {}
			return
		}

		// Execute tool via registry with proper error handling (only if tools are enabled)
		let toolResult: ToolResult
		if (!toolRegistry) {
			// Tools not enabled - return error
			toolResult = {
				success: false,
				result: { error: 'Tools are not enabled for this session' },
				error: 'Tools are not enabled for this session',
			}
		} else {
			try {
				toolResult = await toolRegistry.executeTool(name, args || {}, {
					session,
					onLog,
					contextIngest, // Pass contextIngest so tools can re-ingest results when done
				})
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error'
				toolResult = {
					success: false,
					result: { error: errorMessage },
					error: errorMessage,
				}
			}
		}

		// Notify frontend of tool call (with result) - this happens AFTER execution
		try {
			onToolCall?.(name, args || {}, toolResult.result, toolResult.contextString)
		} catch (_err) {}

		// ALWAYS send tool response (required by Google API)
		// This is critical - if we don't send a response, the API will hang
		try {
			const ingestMode: 'silent' | 'triggerAnswer' = 'silent'
			await contextIngest.ingestToolResponse(name, toolResult.result, id || 'unknown', ingestMode)
		} catch (err) {
			// Try to send error response as fallback
			try {
				await contextIngest.ingestToolResponse(
					name,
					{
						error: `Failed to process tool: ${err instanceof Error ? err.message : 'Unknown error'}`,
					},
					id || 'unknown',
					'silent',
				)
			} catch (_fallbackErr) {
				onError?.(
					new Error(
						`Failed to send tool response for ${name}: ${err instanceof Error ? err.message : String(err)}`,
					),
				)
			}
		}
	}

	return {
		handleGoogleMessage(_message: any) {
			// This is handled by callbacks, but we can add additional handling here if needed
		},

		sendAudio(data: string, mimeType: string = 'audio/pcm;rate=16000') {
			console.log(`[VoiceSession] sendAudio called: ${data.length} chars, mimeType: ${mimeType}`)
			try {
				session.sendRealtimeInput({
					media: {
						data,
						mimeType,
					},
				})
				console.log(`[VoiceSession] Audio sent to Google Live API successfully`)
			} catch (error) {
				console.error(`[VoiceSession] Error sending audio:`, error)
				throw error
			}
		},

		sendActivityEnd() {
			console.log(`[VoiceSession] Sending activityEnd event to signal turn complete`)
			try {
				// Send activityEnd event to signal that user has finished speaking
				// This triggers Google to process the audio and generate a response
				session.sendRealtimeInput({
					event: 'activityEnd',
				})
				console.log(`[VoiceSession] activityEnd event sent successfully`)
			} catch (error) {
				console.error(`[VoiceSession] Error sending activityEnd:`, error)
				throw error
			}
		},

		sendText(text: string, turnComplete: boolean = false) {
			// Default to silent mode for context updates - set triggerAnswer only for user queries
			const mode = turnComplete ? 'triggerAnswer' : 'silent'
			contextIngest.ingestSystemMessage(text, mode)
		},

		getContextIngest() {
			return contextIngest
		},

		close() {
			session.close()
		},
	}
}
