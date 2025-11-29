/**
 * Voice Session Manager
 * Manages Google Live API session with tools and context injection
 */

import { GoogleGenAI, Modality } from '@google/genai';
import { buildSystemInstruction } from '@hominio/vibes';
import { ToolRegistry, type ToolResult } from './tools/registry.js';
import { ContextIngestService, type ContextIngestEvent } from './context-injection.js';

export interface VoiceSessionManagerOptions {
	apiKey: string;
	model?: string;
	onLog?: (message: string, context?: string) => void;
	onToolCall?: (toolName: string, args: any, result: any, contextString?: string) => void;
	onContextIngest?: (event: ContextIngestEvent) => void;
	onAudio?: (data: string, mimeType?: string) => void;
	onTranscript?: (role: 'user' | 'model', text: string) => void;
	onInterrupted?: () => void;
	onStatus?: (status: 'connected' | 'disconnected') => void;
	onError?: (error: Error) => void;
}

export interface VoiceSessionManager {
	handleGoogleMessage(message: any): void;
	sendAudio(data: string, mimeType?: string): void;
	sendText(text: string, turnComplete?: boolean): void;
	getContextIngest(): ContextIngestService;
	close(): void;
}

export async function createVoiceSessionManager(
	options: VoiceSessionManagerOptions
): Promise<VoiceSessionManager> {
	const {
		apiKey,
		model = 'gemini-2.5-flash-native-audio-preview-09-2025',
		onLog,
		onToolCall,
		onContextIngest,
		onAudio,
		onTranscript,
		onInterrupted,
		onStatus,
		onError
	} = options;

	if (!apiKey || apiKey.trim().length === 0) {
		throw new Error('Google AI API key is required but not provided');
	}

	const ai = new GoogleGenAI({ apiKey });

	// Initialize tool registry
	const toolRegistry = new ToolRegistry();
	await toolRegistry.initialize();

	// Build system instruction
	let systemInstruction: string;
	try {
		systemInstruction = await buildSystemInstruction();
		if (!systemInstruction || systemInstruction.trim().length === 0) {
			throw new Error('System instruction is empty');
		}
	} catch (err) {
		console.error('[hominio-voice] Failed to build system instruction:', err);
		throw new Error(`Failed to build system instruction: ${err instanceof Error ? err.message : String(err)}`);
	}

	// Build tool schemas
	const tools = await toolRegistry.buildToolSchemas();
	if (!tools || tools.length === 0) {
		console.warn('[hominio-voice] No tools registered');
	}

	// Create Google Live API session
	const session = await ai.live.connect({
		model,
		config: {
			responseModalities: [Modality.AUDIO],
			systemInstruction: {
				parts: [{ text: systemInstruction }]
			},
			speechConfig: {
				voiceConfig: {
					prebuiltVoiceConfig: {
						voiceName: 'Sadachbia'
					}
				}
			},
			tools
		},
		callbacks: {
			onopen: () => {
				// Silent - don't log (too verbose)
				onStatus?.('connected');
			},
			onmessage: async (message: any) => {
				try {
					// Handle user interruption
					if (message.serverContent?.interrupted) {
						// Silent - don't log (too verbose)
						onInterrupted?.();
					}

					// Handle server content (model responses)
					if (message.serverContent) {
						const parts = message.serverContent?.modelTurn?.parts || [];

						// Process audio first (highest priority)
						for (const part of parts) {
							if (part.inlineData?.data) {
								onAudio?.(part.inlineData.data, part.inlineData.mimeType);
							}
						}

						// Process text transcripts
						const textParts = parts.filter((p: any) => p.text);
						if (textParts.length > 0) {
							const text = textParts.map((p: any) => p.text).join('');
							onTranscript?.('model', text);
						}

						// Handle function calls from parts
						for (const part of parts) {
							if (part.functionCall) {
								// Google GenAI SDK: part.functionCall has { name?, args?, id? } structure
								if (!part.functionCall.name) {
									console.error(`[hominio-voice] ⚠️ Function call in part missing name:`, JSON.stringify(part.functionCall, null, 2));
								}
								await handleFunctionCall(part.functionCall);
							}
						}

						// Handle turn complete
						if (message.serverContent.turnComplete) {
							// Turn complete handling if needed
						}
					}

					// Handle user transcripts
					if (message.clientContent?.userTurn) {
						const parts = message.clientContent.userTurn.parts || [];
						const text = parts.filter((p: any) => p.text).map((p: any) => p.text).join('');
						if (text) {
							onTranscript?.('user', text);
						}
					}

					// Handle top-level tool calls
					if (message.toolCall) {
						const functionCalls = message.toolCall.functionCalls || [];
						for (const call of functionCalls) {
							if (!call.name) {
								console.error(`[hominio-voice] ⚠️ Function call in toolCall missing name:`, JSON.stringify(call, null, 2));
								console.error(`[hominio-voice] ⚠️ Available keys:`, Object.keys(call));
							}
							await handleFunctionCall(call);
						}
					}
				} catch (err) {
					console.error('[hominio-voice] Error handling message:', err);
					onError?.(err instanceof Error ? err : new Error(String(err)));
				}
			},
			onclose: () => {
				// Silent - don't log (too verbose)
				onStatus?.('disconnected');
			},
			onerror: (err: any) => {
				console.error('[hominio-voice] 🤖 Google Live API Error:', err);
				const errorMessage = err instanceof Error ? err.message : String(err);
				console.error('[hominio-voice] Error details:', { 
					message: errorMessage,
					error: err,
					apiKeyPresent: !!apiKey,
					apiKeyLength: apiKey?.length || 0
				});
				onError?.(err instanceof Error ? err : new Error(String(err)));
			}
		}
	});

	// Create context ingest service
	const contextIngest = new ContextIngestService({
		session,
		onLog,
		onContextIngest
	});

	// Function call handler
	async function handleFunctionCall(functionCall: any) {
		// Google GenAI SDK structure: { name?, args?, id? }
		// According to docs, name is optional but we require it for tool execution
		const name = functionCall.name;
		const args = functionCall.args || {};
		const id = functionCall.id;

		if (!name) {
			console.error(`[hominio-voice] ⚠️ Function call missing name. Full structure:`, JSON.stringify(functionCall, null, 2));
			console.error(`[hominio-voice] ⚠️ Available keys:`, Object.keys(functionCall));
			// Don't process function calls without names - they're invalid
			return;
		}

		// Validate tool call ID - required for sending response
		if (!id) {
			console.error(`[hominio-voice] ⚠️ Function call missing ID. Tool: ${name}. Full structure:`, JSON.stringify(functionCall, null, 2));
			// Still try to send error response, but log the issue
			onLog?.(`⚠️ Tool call ${name} missing ID - response may fail`);
		}

		// Silent - don't log function calls (too verbose)

		// Filter out legacy tools - don't execute or notify frontend
		if (name === 'queryVibeContext' || name === 'actionSkill' || name === 'delegateIntent') {
			onLog?.(`⚠️ Legacy tool ${name} is no longer supported.`);
			// Return error response to AI
			try {
				await contextIngest.ingestToolResponse(name, {
					error: `Tool ${name} is no longer available. Use queryTodos or createTodo directly.`
				}, id || 'unknown', 'silent');
			} catch (err) {
				console.error(`[hominio-voice] Failed to send legacy tool error response:`, err);
			}
			return;
		}

		// Execute tool via registry with proper error handling
		let toolResult: ToolResult;
		try {
			toolResult = await toolRegistry.executeTool(name, args || {}, {
				session,
				onLog,
				contextIngest // Pass contextIngest so tools can re-ingest results when done
			});
		} catch (err) {
			console.error(`[hominio-voice] Error executing tool ${name}:`, err);
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			toolResult = {
				success: false,
				result: { error: errorMessage },
				error: errorMessage
			};
		}

		// Notify frontend of tool call (with result) - this happens AFTER execution
		try {
			onToolCall?.(name, args || {}, toolResult.result, toolResult.contextString);
		} catch (err) {
			console.error(`[hominio-voice] Error notifying frontend of tool call:`, err);
		}

		// ALWAYS send tool response (required by Google API)
		// This is critical - if we don't send a response, the API will hang
		try {
			const ingestMode: 'silent' | 'triggerAnswer' = 'silent';
			await contextIngest.ingestToolResponse(name, toolResult.result, id || 'unknown', ingestMode);
		} catch (err) {
			console.error(`[hominio-voice] CRITICAL: Failed to send tool response for ${name}:`, err);
			// Try to send error response as fallback
			try {
				await contextIngest.ingestToolResponse(name, {
					error: `Failed to process tool: ${err instanceof Error ? err.message : 'Unknown error'}`
				}, id || 'unknown', 'silent');
			} catch (fallbackErr) {
				console.error(`[hominio-voice] CRITICAL: Failed to send fallback error response:`, fallbackErr);
				onError?.(new Error(`Failed to send tool response for ${name}: ${err instanceof Error ? err.message : String(err)}`));
			}
		}
	}

	return {
		handleGoogleMessage(message: any) {
			// This is handled by callbacks, but we can add additional handling here if needed
		},

		sendAudio(data: string, mimeType: string = 'audio/pcm;rate=16000') {
			session.sendRealtimeInput({
				media: {
					data,
					mimeType
				}
			});
		},

		sendText(text: string, turnComplete: boolean = false) {
			// Default to silent mode for context updates - set triggerAnswer only for user queries
			const mode = turnComplete ? 'triggerAnswer' : 'silent';
			contextIngest.ingestSystemMessage(text, mode);
		},

		getContextIngest() {
			return contextIngest;
		},

		close() {
			session.close();
		}
	};
}

