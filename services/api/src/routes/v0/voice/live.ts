/**
 * Google Live Voice API WebSocket Proxy
 * 
 * Server-to-server proxy pattern:
 * Frontend → Elysia WebSocket → Google Live API WebSocket
 * 
 * Handles bidirectional audio streaming:
 * - Client audio (16-bit PCM, 16kHz) → Google Live API
 * - Google audio responses (24kHz) → Client
 */

import { GoogleGenAI, Modality } from "@google/genai";
import { requireWebSocketAuth } from "../../../lib/middleware/ws-auth";
import type { AuthData } from "../../../lib/auth-context";
import { checkCapability } from "@hominio/caps";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";

if (!GOOGLE_AI_API_KEY) {
    console.warn("[voice/live] WARNING: GOOGLE_AI_API_KEY not set. Voice API will not work.");
}

// Initialize Google GenAI client
const ai = new GoogleGenAI({
    apiKey: GOOGLE_AI_API_KEY || "",
});

/**
 * Google Live API WebSocket handler configuration
 * 
 * Endpoint: /api/v0/voice/live
 * 
 * Authentication: Required (Better Auth cookies)
 * 
 * Message Format:
 * - Client → Server: JSON with audio data (base64 encoded PCM)
 * - Server → Client: JSON with audio data (base64 encoded PCM) or status messages
 */
export const voiceLiveHandler = {
    // Handle WebSocket connection open
    async open(ws: any) {
        // Try to get request from WebSocket data (Elysia may provide this)
        // If not available, try to access from WebSocket instance properties
        let request: Request | null = null;
        
        // Try different ways to access the upgrade request
        if (ws.data?.request) {
            request = ws.data.request as Request;
        } else if ((ws as any).data?.headers) {
            // Reconstruct request from headers if available
            const headers = (ws as any).data.headers;
            request = new Request("http://localhost", { headers });
        } else {
            // Last resort: try to access from WebSocket internal properties
            // In Bun, WebSocket upgrade request might be accessible differently
            console.warn("[voice/live] Could not access upgrade request, attempting to authenticate without it");
        }

        let authData: AuthData | null = null;
        if (request) {
            try {
                authData = await requireWebSocketAuth(request);
            } catch (error) {
                console.error("[voice/live] Authentication failed:", error);
                ws.close(1008, "Authentication failed: Unauthorized");
                return;
            }
        } else {
            // If we can't get the request, we can't authenticate
            // This is a fallback - in production, Elysia should provide the request
            console.error("[voice/live] Cannot authenticate: No request available");
            ws.close(1008, "Authentication failed: No request data");
            return;
        }
        
        // Store authData for later use
        ws.data.authData = authData;
        
        // Check capability: require api:voice capability (default deny)
        const principal = `user:${authData.sub}`;
        console.log(`[voice/live] 🔍 Checking capability for user ${authData.sub} (principal: ${principal})`);
        
        let hasVoiceCapability = false;
        try {
            hasVoiceCapability = await checkCapability(
                principal,
                { type: 'api', namespace: 'voice' },
                'read'
            );
            console.log(`[voice/live] 🔍 Capability check result: ${hasVoiceCapability}`);
        } catch (error) {
            console.error(`[voice/live] ❌ Error checking capability:`, error);
            // Default deny on error
            hasVoiceCapability = false;
        }
        
        if (!hasVoiceCapability) {
            console.log(`[voice/live] ❌ BLOCKED WebSocket connection - user ${authData.sub} does not have api:voice capability`);
            ws.close(1008, "Forbidden: No api:voice capability. Access denied by default.");
            return;
        }
        
        console.log(`[voice/live] ✅ ALLOWED WebSocket connection - user ${authData.sub} has api:voice capability`);

        // Connect to Google Live API
        try {
            const config = {
                responseModalities: [Modality.AUDIO],
                systemInstruction: "You are a helpful assistant and answer in a friendly tone.",
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: "Sadachbia",
                        },
                    },
                },
                tools: [
                    {
                        functionDeclarations: [
                            {
                                name: "get_name",
                                description: "Get the name of the assistant",
                            }
                        ]
                    }
                ],
            };

            const session = await ai.live.connect({
                model: MODEL,
                callbacks: {
                    onopen: () => {
                        // Send connection status to client
                        ws.send(JSON.stringify({
                            type: "status",
                            status: "connected",
                            message: "Connected to Google Live API",
                        }));
                    },
                    onmessage: (message: any) => {
                        // Forward Google messages to client
                        try {
                            // Handle different message types from Google Live API
                            if (message.serverContent) {
                                // Check for audio in modelTurn.parts
                                const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                                if (audioData) {
                                    // Audio data chunk from Google
                                    ws.send(JSON.stringify({
                                        type: "audio",
                                        data: audioData,
                                        mimeType: message.serverContent.modelTurn.parts[0].inlineData.mimeType || "audio/pcm;rate=24000",
                                    }));
                                } else {
                                    // Check for functionCall inside serverContent (Multimodal Live API structure)
                                    const parts = message.serverContent?.modelTurn?.parts || [];
                                    const functionCallPart = parts.find((p: any) => p.functionCall);

                                    if (functionCallPart) {
                                        // Handle function call from serverContent
                                        const functionCall = functionCallPart.functionCall;
                                        console.log("[voice/live] Handling function call:", JSON.stringify(functionCall));
                                        
                                        ws.send(JSON.stringify({
                                            type: "toolCall",
                                            data: functionCall,
                                        }));

                                        let response = { error: "Unknown tool" };
                                        if (functionCall.name === "get_name") {
                                            response = { name: "hominio" };
                                        }

                                        // Construct tool response
                                        // For Multimodal Live, we send toolResponse in clientContent
                                        // Note: sendToolResponse is not directly on session in some versions, 
                                        // or requires specific structure. 
                                        // Based on reference, sendToolResponse takes { functionResponses: [...] }
                                        
                                        console.log("[voice/live] Sending tool response:", JSON.stringify(response));
                                        
                                        session.sendToolResponse({
                                            functionResponses: [
                                                {
                                                    id: functionCall.id,
                                                    name: functionCall.name,
                                                    response: { result: response } // Wrap in 'result' object as per reference
                                                }
                                            ]
                                        });
                                    } else {
                                        // Other server content (turn complete, etc.)
                                        ws.send(JSON.stringify({
                                            type: "serverContent",
                                            data: message.serverContent,
                                        }));
                                    }
                                }
                            } else if (message.data) {
                                // Direct audio data chunk (fallback)
                                ws.send(JSON.stringify({
                                    type: "audio",
                                    data: message.data,
                                    mimeType: message.mimeType || "audio/pcm;rate=24000",
                                }));
                            } else if (message.setupComplete) {
                                // Setup complete message
                                ws.send(JSON.stringify({
                                    type: "serverContent",
                                    data: { setupComplete: message.setupComplete },
                                }));
                            } else if (message.toolCall) {
                                // Handle top-level toolCall (if SDK abstracts it this way)
                                console.log("[voice/live] Received top-level tool call:", JSON.stringify(message.toolCall));
                                
                                // Notify frontend
                                ws.send(JSON.stringify({
                                    type: "toolCall",
                                    data: message.toolCall,
                                }));

                                const functionCalls = message.toolCall.functionCalls;
                                const responses = functionCalls.map((fc: any) => {
                                    if (fc.name === "get_name") {
                                        return {
                                            name: "get_name",
                                            response: { result: { name: "hominio" } }, // Wrap in result
                                            id: fc.id 
                                        };
                                    }
                                    return {
                                        name: fc.name,
                                        response: { result: { error: "Unknown tool" } }, // Wrap in result
                                        id: fc.id
                                    };
                                });

                                console.log("[voice/live] Sending top-level tool response:", JSON.stringify(responses));
                                session.sendToolResponse({
                                    functionResponses: responses
                                });
                            }
                        } catch (error) {
                            console.error("[voice/live] Error forwarding message to client:", error);
                            ws.send(JSON.stringify({
                                type: "error",
                                message: "Failed to process server message",
                            }));
                        }
                    },
                    onerror: (error: Error) => {
                        console.error(`[voice/live] Google Live API error for user ${authData.sub}:`, error);
                        ws.send(JSON.stringify({
                            type: "error",
                            message: error.message || "Google Live API error",
                        }));
                    },
                    onclose: (event: CloseEvent) => {
                        ws.send(JSON.stringify({
                            type: "status",
                            status: "disconnected",
                            message: event.reason || "Connection closed",
                        }));
                    },
                },
                config: config,
            });

            // Store session in WebSocket data for cleanup
            ws.data.googleSession = session;

        } catch (error) {
            console.error(`[voice/live] Failed to connect to Google Live API for user ${authData.sub}:`, error);
            ws.send(JSON.stringify({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to connect to Google Live API",
            }));
            ws.close(1011, "Failed to connect to Google Live API");
        }
    },

    // Handle messages from client
    async message(ws: any, message: string | Buffer) {
        const authData = ws.data.authData as AuthData;
        const session = ws.data.googleSession;

        if (!session) {
            console.warn(`[voice/live] No Google session for user ${authData.sub}`);
            ws.send(JSON.stringify({
                type: "error",
                message: "Not connected to Google Live API",
            }));
            return;
        }

        try {
            // Parse client message - Elysia WebSocket messages are already parsed or strings
            let clientMessage: any;
            if (typeof message === "string") {
                try {
                    clientMessage = JSON.parse(message);
                } catch (e) {
                    console.error("[voice/live] Failed to parse message as JSON:", e);
                    return;
                }
            } else if (Buffer.isBuffer(message)) {
                try {
                    clientMessage = JSON.parse(message.toString());
                } catch (e) {
                    console.error("[voice/live] Failed to parse Buffer message as JSON:", e);
                    return;
                }
            } else {
                // Already an object
                clientMessage = message;
            }

            // Handle different message types from client
            if (clientMessage.type === "audio" && clientMessage.data) {
                // Forward audio to Google Live API
                session.sendRealtimeInput({
                    media: {
                        data: clientMessage.data,
                        mimeType: clientMessage.mimeType || "audio/pcm;rate=16000",
                    },
                });
            } else if (clientMessage.type === "text" && clientMessage.text) {
                // Forward text to Google Live API
                session.sendClientContent({
                    turns: clientMessage.text,
                    turnComplete: clientMessage.turnComplete !== false,
                });
            } else if (clientMessage.type === "activityEnd") {
                // Signal end of user activity
                session.sendRealtimeInput({
                    activityEnd: {},
                });
            } else {
                // Unknown message type - log and ignore
                console.warn(`[voice/live] Unknown message type from client:`, clientMessage.type);
            }
        } catch (error) {
            console.error(`[voice/live] Error processing client message for user ${authData.sub}:`, error);
            ws.send(JSON.stringify({
                type: "error",
                message: "Failed to process message",
            }));
        }
    },

    // Handle WebSocket connection close
    async close(ws: any) {
        const authData = ws.data.authData as AuthData;
        const session = ws.data.googleSession;

        // Clean up Google Live API session
        if (session) {
            try {
                session.close();
            } catch (error) {
                console.error(`[voice/live] Error closing Google session for user ${authData.sub}:`, error);
            }
        }
    },
};

