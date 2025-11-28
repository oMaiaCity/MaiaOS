/**
 * Google Live Voice API WebSocket Proxy
 * 
 * API layer: Handles WebSocket connection, authentication, and message routing
 * Voice logic: Delegated to @hominio/voice package
 */

import { requireWebSocketAuth } from "../../../lib/middleware/ws-auth";
import { checkCapability } from "@hominio/caps";
import type { AuthData } from "../../../lib/auth-context";
import type { Principal } from "@hominio/caps";
import { createVoiceSessionManager } from "@hominio/voice";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!GOOGLE_AI_API_KEY) {
    console.warn("[voice/live] WARNING: GOOGLE_AI_API_KEY not set.");
}

export const voiceLiveHandler = {
    async open(ws: any) {
        console.log("[voice/live] 🔌 Client connected");

        // Handle Auth
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
                console.log(`[voice/live] ✅ Authenticated user: ${authData.sub}`);
            } catch (error) {
                console.error("[voice/live] Authentication failed:", error);
                ws.close(1008, "Authentication failed: Unauthorized");
                return;
            }
        } else {
            console.warn("[voice/live] ⚠️ No request object found, skipping strict auth check (dev mode only)");
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
                    console.error(`[voice/live] ❌ User ${authData.sub} missing voice capability`);
                    ws.close(1008, "Forbidden: No api:voice capability");
                    return;
                }
                console.log(`[voice/live] ✅ Capability check passed`);
            } catch (err) {
                console.error("[voice/live] Capability check error:", err);
            }
        }

        // Extract initial vibeId from query params
        let initialVibeId: string | undefined;
        if (request) {
            const url = new URL(request.url);
            initialVibeId = url.searchParams.get('vibeId') || undefined;
        }

        try {
            // Create voice session manager from hominio-voice package
            const sessionManager = await createVoiceSessionManager({
                apiKey: GOOGLE_AI_API_KEY || "",
                initialVibeId,
                onLog: (message, context) => {
                    ws.send(JSON.stringify({ type: "log", message, context }));
                },
                onToolCall: (toolName, args, result, contextString) => {
                    ws.send(JSON.stringify({
                        type: "toolCall",
                        name: toolName,
                        args,
                        result,
                        contextString
                    }));
                },
                onAudio: (data, mimeType) => {
                    ws.send(JSON.stringify({
                        type: "audio",
                        data,
                        mimeType
                    }));
                },
                onTranscript: (role, text) => {
                    ws.send(JSON.stringify({
                        type: "transcript",
                        role,
                        text
                    }));
                },
                onInterrupted: () => {
                    ws.send(JSON.stringify({ type: "interrupted" }));
                },
                onStatus: (status) => {
                    ws.send(JSON.stringify({ type: "status", status }));
                },
                onError: (error) => {
                    ws.send(JSON.stringify({ type: "error", message: error.message }));
                }
            });

            ws.data.sessionManager = sessionManager;

        } catch (err) {
            console.error("[voice/live] Failed to create voice session:", err);
            ws.close(1011, "Failed to connect to AI");
        }
    },

    async message(ws: any, message: any) {
        const sessionManager = ws.data.sessionManager;
        if (!sessionManager) return;

        try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;

            if (data.type === 'audio' && data.data) {
                // Forward audio to voice session manager
                sessionManager.sendAudio(data.data, data.mimeType || "audio/pcm;rate=16000");
            }
        } catch (e) {
            console.error("[voice/live] Error parsing message:", e);
        }
    },

    async close(ws: any) {
        console.log("[voice/live] 🔌 Client disconnected");
        if (ws.data.sessionManager) {
            ws.data.sessionManager.close();
        }
    }
};
