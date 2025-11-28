/**
 * Voice Session Manager
 * Manages Google Live API session with tools and context injection
 */

import { GoogleGenAI, Modality } from '@google/genai';
import { buildSystemInstruction, buildRepeatedPrompt } from '@hominio/vibes';
import { ToolRegistry } from './tools/registry.js';
import { ContextInjectionService } from './context-injection.js';

export interface VoiceSessionManagerOptions {
	apiKey: string;
	model?: string;
	initialVibeId?: string;
	onLog?: (message: string, context?: string) => void;
	onToolCall?: (toolName: string, args: any, result: any, contextString?: string) => void;
	onAudio?: (data: string, mimeType?: string) => void;
	onTranscript?: (role: 'user' | 'model', text: string) => void;
	onInterrupted?: () => void;
	onStatus?: (status: 'connected' | 'disconnected') => void;
	onError?: (error: Error) => void;
}

export interface VoiceSessionManager {
	handleGoogleMessage(message: any): void;
	sendAudio(data: string, mimeType?: string): void;
	close(): void;
}

export async function createVoiceSessionManager(
	options: VoiceSessionManagerOptions
): Promise<VoiceSessionManager> {
	const {
		apiKey,
		model = 'gemini-2.5-flash-native-audio-preview-09-2025',
		initialVibeId,
		onLog,
		onToolCall,
		onAudio,
		onTranscript,
		onInterrupted,
		onStatus,
		onError
	} = options;

	const ai = new GoogleGenAI({ apiKey });

	// Initialize tool registry
	const toolRegistry = new ToolRegistry();
	await toolRegistry.initialize();

	// Track active vibes
	let activeVibeIds: string[] = [];
	const vibeConfigs = toolRegistry.getVibeConfigs();

	// Load initial vibe if provided
	if (initialVibeId) {
		activeVibeIds.push(initialVibeId);
		toolRegistry.setActiveVibeIds(activeVibeIds);
	}

	// Build system instruction
	let systemInstruction = await buildSystemInstruction({
		activeVibeIds,
		vibeConfigs,
		includeRepeatedPrompt: true
	});

	// Build tool schemas
	const tools = await toolRegistry.buildToolSchemas();

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
				console.log('[hominio-voice] 🤖 Connected to Google Live API');
				onStatus?.('connected');
			},
			onmessage: async (message: any) => {
				try {
					// Handle user interruption
					if (message.serverContent?.interrupted) {
						console.log('[hominio-voice] 🛑 User interrupted AI');
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

						// Handle function calls
						for (const part of parts) {
							if (part.functionCall) {
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
							await handleFunctionCall(call);
						}
					}
				} catch (err) {
					console.error('[hominio-voice] Error handling message:', err);
					onError?.(err instanceof Error ? err : new Error(String(err)));
				}
			},
			onclose: () => {
				console.log('[hominio-voice] 🤖 Disconnected from Google Live API');
				onStatus?.('disconnected');
			},
			onerror: (err: any) => {
				console.error('[hominio-voice] 🤖 Google Error:', err);
				onError?.(err instanceof Error ? err : new Error(String(err)));
			}
		}
	});

	// Create context injection service
	const contextInjection = new ContextInjectionService({
		session,
		onLog
	});

	// Function call handler
	async function handleFunctionCall(functionCall: any) {
		const { name, args, id } = functionCall;
		console.log(`[hominio-voice] 🔧 Function call: ${name}`, JSON.stringify(args));

		// Update active vibes in registry
		toolRegistry.setActiveVibeIds(activeVibeIds);

		// Execute tool via registry
		const toolResult = await toolRegistry.executeTool(name, args || {}, {
			vibeConfigs,
			activeVibeIds,
			session,
			injectContext: (content) => {
				// Context injection with logging
				if (name === 'queryVibeContext') {
					contextInjection.injectVibeContext(args?.vibeId || 'unknown', content.turns);
				} else if (name === 'queryDataContext') {
					// Respect turnComplete from handler (defaults to false if not provided)
					contextInjection.injectDataContext(args?.schemaId || 'unknown', content.turns, content.turnComplete ?? false);
				} else {
					contextInjection.injectContext(content.turns, content.turnComplete);
				}
			},
			onLog
		});

		// Inject repeated prompt to continue the conversation flow
		// After queryDataContext: inject with turnComplete=false to nudge AI to continue with actionSkill
		// After actionSkill: only inject if NOT a create operation (create operations should complete naturally)
		// After queryVibeContext: don't inject (background operation, no follow-up needed)
		if (name === 'queryDataContext') {
			try {
				const repeatedPrompt = await buildRepeatedPrompt();
				await contextInjection.injectRepeatedPrompt(repeatedPrompt);
			} catch (err) {
				console.error('[hominio-voice] Failed to inject repeated prompt:', err);
			}
		} else if (name === 'actionSkill') {
			// Only inject repeated prompt for operations that don't show UI or success confirmations
			// View operations (show-menu, show-wellness, view-calendar) show UI and should complete naturally
			// Mutation operations (create/edit/delete) show success views and should complete naturally
			const skillId = args?.skillId || '';
			const isViewOperation = 
				skillId.includes('show') || skillId.includes('Show') ||
				skillId.includes('view') || skillId.includes('View');
			const isMutationOperation = 
				skillId.includes('create') || skillId.includes('Create') ||
				skillId.includes('edit') || skillId.includes('Edit') ||
				skillId.includes('delete') || skillId.includes('Delete');
			
			// Only inject repeated prompt for operations that don't show UI or success views
			if (!isViewOperation && !isMutationOperation) {
				try {
					const repeatedPrompt = await buildRepeatedPrompt();
					await contextInjection.injectRepeatedPrompt(repeatedPrompt);
				} catch (err) {
					console.error('[hominio-voice] Failed to inject repeated prompt:', err);
				}
			}
		}

		// Notify frontend of tool call
		onToolCall?.(name, args || {}, toolResult.result, toolResult.contextString);

		// Send response back to Google
		session.sendToolResponse({
			functionResponses: [
				{
					id,
					name,
					response: { result: toolResult.result }
				}
			]
		});
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

		close() {
			session.close();
		}
	};
}

