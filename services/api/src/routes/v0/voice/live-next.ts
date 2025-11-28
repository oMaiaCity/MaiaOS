/**
 * Google Live Voice API WebSocket Proxy - NEXT (Clean Implementation)
 * 
 * Minimal implementation for debugging and testing.
 * No complex auth, no tools, no system prompts.
 */

import { GoogleGenAI, Modality } from "@google/genai";
import { requireWebSocketAuth } from "../../../lib/middleware/ws-auth";
import { checkCapability } from "@hominio/caps";
import type { AuthData } from "../../../lib/auth-context";
import type { Principal } from "@hominio/caps";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";

if (!GOOGLE_AI_API_KEY) {
    console.warn("[voice/live-next] WARNING: GOOGLE_AI_API_KEY not set.");
}

const ai = new GoogleGenAI({
    apiKey: GOOGLE_AI_API_KEY || "",
});

export const voiceLiveNextHandler = {
    async open(ws: any) {
        console.log("[voice/live-next] 🔌 Client connected");

        // Handle Auth manually since this is a clean implementation
        let request: Request | null = null;
        if (ws.data?.request) {
            request = ws.data.request as Request;
        } else if ((ws as any).data?.headers) {
            const headers = (ws as any).data.headers;
            request = new Request("http://localhost", { headers });
        }

        let authData: AuthData | null = null;
        if (request) {
            try {
                authData = await requireWebSocketAuth(request);
                console.log(`[voice/live-next] ✅ Authenticated user: ${authData.sub}`);
            } catch (error) {
                console.error("[voice/live-next] Authentication failed:", error);
                ws.close(1008, "Authentication failed: Unauthorized");
                return;
            }
        } else {
            console.warn("[voice/live-next] ⚠️ No request object found, skipping strict auth check (dev mode only)");
            // ws.close(1008, "Authentication failed: No request data");
            // return;
        }

        // Check Capability if authenticated
        if (authData) {
            const principal = `user:${authData.sub}` as Principal;
            try {
                const hasAccess = await checkCapability(
                    principal,
                    { type: 'api', namespace: 'voice' },
                    'read'
                );
                if (!hasAccess) {
                    console.error(`[voice/live-next] ❌ User ${authData.sub} missing voice capability`);
                    ws.close(1008, "Forbidden: No api:voice capability");
                    return;
                }
                console.log(`[voice/live-next] ✅ Capability check passed`);
            } catch (err) {
                console.error("[voice/live-next] Capability check error:", err);
            }
        }

        try {
            // Connect to Google Live API
            const session = await ai.live.connect({
                model: MODEL,
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: {
                        parts: [{ text: `You are Hominio. You DO NOT have a name until you call the 'get_name' tool.
                        
                        When the user asks for your name, you MUST call the 'get_name' tool immediately. 
                        Do not answer "My name is..." or "I am..." until you have received the result from the 'get_name' tool.
                        
                        User: "What is your name?"
                        Model: (Calls get_name)
                        System: { "result": { "name": "Hominio Guardian" } }
                        Model: "My name is Hominio Guardian."` }]
                    },
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
                                    description: "Get the name of the AI assistant",
                                    parameters: {
                                        type: "object",
                                        properties: {},
                                    } as any
                                }
                            ]
                        }
                    ]
                },
                callbacks: {
                    onopen: () => {
                        console.log("[voice/live-next] 🤖 Connected to Google");
                        ws.send(JSON.stringify({ type: "status", status: "connected" }));
                    },
                    onmessage: (message: any) => {
                        // Forward from Google to Client
                        try {
                            // Log message structure for debugging - DISABLED for performance
                            // console.log('[voice/live-next] 📨 Msg Keys:', Object.keys(message));
                            // if (message.serverContent) {
                            //     console.log('[voice/live-next] 📨 ServerContent Keys:', Object.keys(message.serverContent));
                            //     if (message.serverContent.modelTurn) {
                            //         console.log('[voice/live-next] 📨 ModelTurn Parts:', message.serverContent.modelTurn.parts?.length);
                            //     }
                            // }

                            // Handle User Interruption
                            if (message.serverContent?.interrupted) {
                                console.log("[voice/live-next] 🛑 User interrupted AI");
                                ws.send(JSON.stringify({ type: "interrupted" }));
                            }

                            if (message.serverContent) {
                                const parts = message.serverContent?.modelTurn?.parts || [];
                                for (const part of parts) {
                                    if (part.inlineData?.data) {
                                        ws.send(JSON.stringify({
                                            type: "audio",
                                            data: part.inlineData.data,
                                            mimeType: part.inlineData.mimeType
                                        }));
                                    }
                                    if (part.text) {
                                        // console.log("[voice/live-next] 🤖 Text:", part.text);
                                        ws.send(JSON.stringify({
                                            type: "transcript",
                                            role: "model",
                                            text: part.text
                                        }));
                                    }

                                    if (part.functionCall) {
                                        console.log("[voice/live-next] 🔧 Function Call in Part:", JSON.stringify(part.functionCall));
                                        const call = part.functionCall;

                                        // Notify frontend
                                        ws.send(JSON.stringify({
                                            type: "toolCall",
                                            name: call.name,
                                            args: call.args,
                                            id: call.id
                                        }));

                                        // Execute (Simple implementation)
                                        let result = {};
                                        if (call.name === "get_name") {
                                            result = { name: "Hominio Guardian" };
                                        }
                                        console.log("[voice/live-next] ✅ Tool Execution Result:", JSON.stringify(result));

                                        // Notify frontend of result
                                        ws.send(JSON.stringify({
                                            type: "toolResult",
                                            name: call.name,
                                            result: result,
                                            id: call.id
                                        }));

                                        // Respond to Google
                                        console.log("[voice/live-next] 🔧 Sending Tool Response");
                                        session.sendToolResponse({
                                            functionResponses: [{
                                                id: call.id,
                                                name: call.name,
                                                response: { result }
                                            }]
                                        });
                                    }
                                }

                                if (message.serverContent.turnComplete) {
                                    ws.send(JSON.stringify({ type: "turnComplete" }));
                                }
                            }

                            // Handle User Transcripts
                            if (message.clientContent?.userTurn) {
                                const parts = message.clientContent.userTurn.parts || [];
                                const text = parts.filter((p: any) => p.text).map((p: any) => p.text).join("");
                                if (text) {
                                    console.log("[voice/live-next] 👤 User:", text);
                                    ws.send(JSON.stringify({
                                        type: "transcript",
                                        role: "user",
                                        text: text
                                    }));
                                }
                            }

                            // Handle Tool Calls
                            if (message.toolCall) {
                                console.log("[voice/live-next] 🔧 Tool Call:", JSON.stringify(message.toolCall));
                                const functionCalls = message.toolCall.functionCalls || [];

                                for (const call of functionCalls) {
                                    // Notify frontend
                                    ws.send(JSON.stringify({
                                        type: "toolCall",
                                        name: call.name,
                                        args: call.args,
                                        id: call.id
                                    }));

                                    // Execute (Simple implementation)
                                    let result = {};
                                    if (call.name === "get_name") {
                                        result = { name: "Hominio Guardian" };
                                    }
                                    console.log("[voice/live-next] ✅ RESULT:", JSON.stringify(result));

                                    // Notify frontend of result
                                    ws.send(JSON.stringify({
                                        type: "toolResult",
                                        name: call.name,
                                        result: result,
                                        id: call.id
                                    }));

                                    // Respond to Google
                                    console.log("[voice/live-next] 🔧 Sending Tool Response");
                                    session.sendToolResponse({
                                        functionResponses: [{
                                            id: call.id,
                                            name: call.name,
                                            response: { result }
                                        }]
                                    });
                                }
                            }
                        } catch (e) {
                            console.error("[voice/live-next] Error forwarding to client:", e);
                        }
                    },
                    onclose: () => {
                        console.log("[voice/live-next] 🤖 Disconnected from Google");
                        ws.send(JSON.stringify({ type: "status", status: "disconnected" }));
                    },
                    onerror: (err: any) => {
                        console.error("[voice/live-next] 🤖 Google Error:", err);
                        ws.send(JSON.stringify({ type: "error", message: err.message }));
                    }
                }
            });

            ws.data.session = session;

        } catch (err) {
            console.error("[voice/live-next] Failed to connect to Google:", err);
            ws.close(1011, "Failed to connect to AI");
        }
    },

    async message(ws: any, message: any) {
        const session = ws.data.session;
        if (!session) return;

        try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;

            if (data.type === 'audio' && data.data) {
                // Forward audio to Google
                session.sendRealtimeInput({
                    media: {
                        data: data.data,
                        mimeType: "audio/pcm;rate=16000"
                    }
                });
            }
        } catch (e) {
            console.error("[voice/live-next] Error parsing message:", e);
        }
    },

    async close(ws: any) {
        console.log("[voice/live-next] 🔌 Client disconnected");
        if (ws.data.session) {
            ws.data.session.close();
        }
    }
};
