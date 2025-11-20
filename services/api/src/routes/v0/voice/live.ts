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
import { loadAgentConfig } from "@hominio/agents";

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

        // Extract agentId from query params if present
        let initialAgentId: string | null = null;
        if (request) {
            const url = new URL(request.url);
            initialAgentId = url.searchParams.get('agentId');
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
            // Store current agent ID in session
            // Initialize with initialAgentId if provided (from query param when starting call from agent route)
            let currentAgentId: string | null = initialAgentId || null;
            let currentAgentConfig: any = null;

            // Load agent config if initialAgentId is provided
            let systemInstruction = "Du bist ein hilfreicher KI-Assistent. Wenn Benutzer darum bitten, zum Dashboard oder zur Agentenansicht zu wechseln, verwende das switchAgent-Tool, um sie dorthin zu navigieren.";
            if (initialAgentId) {
                try {
                    const agentConfig = await loadAgentConfig(initialAgentId);
                    currentAgentConfig = agentConfig; // Store config for later use
                    const skillsDesc = agentConfig.skills.map((skill: any) =>
                        `- **${skill.name}** (skillId: "${skill.id}"): ${skill.description}`
                    ).join('\n');

                    // Load data context for background knowledge
                    const { loadDataContext } = await import('@hominio/agents');
                    const dataContextString = await loadDataContext(agentConfig);

                    systemInstruction = `Du bist ${agentConfig.name}, ${agentConfig.role}. ${agentConfig.description}

Verfügbare Funktionen, die du mit actionSkill ausführen kannst:
${skillsDesc}

Wenn der Benutzer nach etwas fragt, verwende die entsprechende skillId mit dem actionSkill-Tool. Zum Beispiel: Wenn er nach dem Menü fragt, verwende actionSkill mit skillId: "show-menu". Für show-menu kannst du optional args.category verwenden, um nach Kategorie zu filtern (z.B. "appetizers", "mains", "desserts", "drinks").

${dataContextString ? `\nHintergrundwissen:\n${dataContextString}` : ''}`;

                    console.log(`[voice/live] ✅ Loaded initial agent context: ${initialAgentId}`);
                } catch (err) {
                    console.error(`[voice/live] Failed to load initial agent config:`, err);
                }
            }

            const config = {
                responseModalities: [Modality.AUDIO],
                systemInstruction: systemInstruction,
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
                                name: "switchAgent",
                                description: "Navigate to a specific agent view or the dashboard. Use 'dashboard' to go to the main agents list, or specify an agent ID like 'charles' to go to that agent's page.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        agentId: {
                                            type: "string",
                                            description: "The agent ID to navigate to (e.g., 'charles') or 'dashboard' to go to the main agents list",
                                            enum: ["dashboard", "charles"]
                                        }
                                    },
                                    required: ["agentId"]
                                }
                            },
                            {
                                name: "actionSkill",
                                description: "Execute a skill/action for the current agent. Use this to perform actions like showing menus, booking services, or accessing information. For show-menu skill, you can filter by category using args.category (e.g., 'appetizers', 'mains', 'desserts', 'drinks').",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        agentId: {
                                            type: "string",
                                            description: "The agent ID (e.g., 'charles')",
                                            enum: ["charles"]
                                        },
                                        skillId: {
                                            type: "string",
                                            description: "The skill ID to execute (e.g., 'show-menu')"
                                        },
                                        args: {
                                            type: "object",
                                            description: "Arguments for the skill. For show-menu: { category?: 'appetizers' | 'mains' | 'desserts' | 'drinks' } - Optional category filter to show only specific menu category.",
                                            properties: {
                                                category: {
                                                    type: "string",
                                                    description: "Menu category filter (only for show-menu skill). Options: 'appetizers', 'mains', 'desserts', 'drinks'",
                                                    enum: ["appetizers", "mains", "desserts", "drinks"]
                                                }
                                            },
                                            additionalProperties: true
                                        }
                                    },
                                    required: ["agentId", "skillId"]
                                }
                            }
                        ]
                    }
                ],
            };

            // Debug: Log currentAgentId after initialization
            console.log(`[voice/live] 🔍 DEBUG: currentAgentId after initialization: ${currentAgentId}, initialAgentId: ${initialAgentId}`);

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
                    onmessage: async (message: any) => {
                        // Forward Google messages to client
                        try {
                            // Debug: Log currentAgentId at start of onmessage callback
                            console.log(`[voice/live] 🔍 DEBUG onmessage start: currentAgentId=${currentAgentId}, initialAgentId was=${initialAgentId}`);

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

                                        // Send tool call to frontend for client-side handling
                                        ws.send(JSON.stringify({
                                            type: "toolCall",
                                            toolName: functionCall.name,
                                            args: functionCall.args || {},
                                        }));

                                        let response = { error: "Unknown tool" };
                                        if (functionCall.name === "get_name") {
                                            response = { name: "hominio" };
                                        } else if (functionCall.name === "switchAgent") {
                                            // Handle agent switch: load config and update system context
                                            const agentId = functionCall.args?.agentId || 'unknown';
                                            console.log(`[voice/live] 🔄 Switching agent to: "${agentId}" (serverContent handler)`);

                                            if (agentId === 'dashboard') {
                                                currentAgentId = null;
                                                currentAgentConfig = null;
                                                session.sendClientContent({
                                                    turns: `[System] Du befindest Dich jetzt auf dem Haupt-Dashboard. Verwende switchAgent, um zu einem bestimmten Agenten zu navigieren.`,
                                                    turnComplete: true,
                                                });
                                                response = { success: true, message: "Switched to dashboard", agentId: 'dashboard' };
                                            } else {
                                                // Load agent config and update context
                                                try {
                                                    const config = await loadAgentConfig(agentId);
                                                    currentAgentId = agentId;
                                                    currentAgentConfig = config;

                                                    const skillsDesc = config.skills.map((skill: any) =>
                                                        `- **${skill.name}** (skillId: "${skill.id}"): ${skill.description}`
                                                    ).join('\n');

                                                    // Load data context for background knowledge
                                                    const { loadDataContext } = await import('@hominio/agents');
                                                    const dataContextString = await loadDataContext(config);

                                                    const contextMessage = `[System] Du bist jetzt ${config.name}, ${config.role}. ${config.description}

Verfügbare Funktionen, die du mit actionSkill ausführen kannst:
${skillsDesc}

Wenn der Benutzer nach etwas fragt, verwende die entsprechende skillId mit dem actionSkill-Tool. Zum Beispiel: Wenn er nach dem Menü fragt, verwende actionSkill mit skillId: "show-menu". Für show-menu kannst du optional args.category verwenden, um nach Kategorie zu filtern (z.B. "appetizers", "mains", "desserts", "drinks").

${dataContextString ? `\nHintergrundwissen:\n${dataContextString}` : ''}`;

                                                    session.sendClientContent({
                                                        turns: contextMessage,
                                                        turnComplete: true,
                                                    });
                                                    console.log(`[voice/live] ✅ Updated AI context for agent: ${agentId} (serverContent handler)`);
                                                    response = { success: true, message: `Switched to ${agentId}`, agentId: agentId };
                                                } catch (err) {
                                                    console.error(`[voice/live] Failed to load agent config:`, err);
                                                    response = { success: false, error: `Failed to load agent config: ${agentId}` };
                                                }
                                            }
                                        } else if (functionCall.name === "actionSkill") {
                                            // Handle actionSkill tool call
                                            const { agentId, skillId, args } = functionCall.args || {};
                                            console.log(`[voice/live] ✅ Handling actionSkill tool call: agent="${agentId}", skill="${skillId}", args:`, args);

                                            // Check if we're in the right agent context
                                            if (!currentAgentId || currentAgentId !== agentId) {
                                                session.sendClientContent({
                                                    turns: `[System] Entschuldigung, ich habe diese Funktion nicht verfügbar. Bitte wechsle zu einem Agenten, der diese Funktion unterstützt.`,
                                                    turnComplete: true,
                                                });
                                                response = { success: false, error: `Skill "${skillId}" not available in current context. Current agent: ${currentAgentId || 'dashboard'}, requested agent: ${agentId}` };
                                            } else {
                                                // Provide dynamic context knowledge when menu tool is called
                                                if (skillId === "show-menu") {
                                                    loadAgentConfig(agentId).then(async config => {
                                                        const skill = config.skills?.find((s: any) => s.id === 'show-menu');
                                                        let menuContextItem = null;
                                                        if (skill?.dataContext) {
                                                            const skillDataContext = Array.isArray(skill.dataContext) ? skill.dataContext : [skill.dataContext];
                                                            menuContextItem = skillDataContext.find((item: any) => item.id === 'menu');
                                                        }
                                                        if (!menuContextItem) {
                                                            menuContextItem = config.dataContext?.find((item: any) => item.id === 'menu');
                                                        }

                                                        if (menuContextItem && menuContextItem.data) {
                                                            const { getMenuContextString } = await import('@hominio/agents');
                                                            const menuContext = getMenuContextString(menuContextItem.data, menuContextItem);
                                                            session.sendClientContent({
                                                                turns: menuContext,
                                                                turnComplete: true,
                                                            });
                                                            console.log(`[voice/live] ✅ Injected menu context for show-menu tool call (from skill dataContext)`);
                                                        }
                                                    }).catch(err => {
                                                        console.error(`[voice/live] Error loading menu context:`, err);
                                                    });
                                                }
                                                response = { success: true, message: `Executing skill ${skillId} for agent ${agentId}`, agentId, skillId };
                                            }
                                        }

                                        console.log("[voice/live] Sending tool response:", JSON.stringify(response));

                                        session.sendToolResponse({
                                            functionResponses: [
                                                {
                                                    id: functionCall.id,
                                                    name: functionCall.name,
                                                    response: { result: response }
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

                                const functionCalls = message.toolCall.functionCalls;

                                // Send each tool call to frontend for client-side handling
                                functionCalls.forEach((fc: any) => {
                                    ws.send(JSON.stringify({
                                        type: "toolCall",
                                        toolName: fc.name,
                                        args: fc.args || {},
                                        // Also include data format for compatibility
                                        data: {
                                            functionCalls: [{
                                                name: fc.name,
                                                args: fc.args || {},
                                                id: fc.id
                                            }]
                                        }
                                    }));
                                });

                                // Send success responses back to Google (frontend handles the actual work)
                                const responses = functionCalls.map((fc: any) => {
                                    const toolName = fc.name;
                                    console.log(`[voice/live] 🔧 Processing tool call: "${toolName}"`, JSON.stringify(fc.args));

                                    // Handle known tools
                                    if (toolName === "get_name") {
                                        console.log(`[voice/live] ✅ Responding to get_name`);
                                        return {
                                            name: "get_name",
                                            response: { result: { name: "hominio" } },
                                            id: fc.id
                                        };
                                    }

                                    if (toolName === "switchAgent") {
                                        // Handle agent switch: load config and update system context
                                        const agentId = fc.args?.agentId || 'unknown';
                                        console.log(`[voice/live] 🔄 Switching agent to: "${agentId}"`);

                                        if (agentId === 'dashboard') {
                                            currentAgentId = null;
                                            currentAgentConfig = null;
                                            // Send text message to update AI context
                                            session.sendClientContent({
                                                turns: `[System] Du befindest Dich jetzt auf dem Haupt-Dashboard. Verwende switchAgent, um zu einem bestimmten Agenten zu navigieren.`,
                                                turnComplete: true,
                                            });
                                        } else {
                                            // Load agent config
                                            loadAgentConfig(agentId).then(async config => {
                                                currentAgentId = agentId;
                                                currentAgentConfig = config;

                                                // Build skills description for AI
                                                const skillsDesc = config.skills.map((skill: any) =>
                                                    `- **${skill.name}** (skillId: "${skill.id}"): ${skill.description}`
                                                ).join('\n');

                                                // Load data context for background knowledge
                                                const { loadDataContext } = await import('@hominio/agents');
                                                const dataContextString = await loadDataContext(config);

                                                // Update AI context with agent info, available skills, and data context
                                                const contextMessage = `[System] Du bist jetzt ${config.name}, ${config.role}. ${config.description}

Verfügbare Funktionen, die du mit actionSkill ausführen kannst:
${skillsDesc}

Wenn der Benutzer nach etwas fragt, verwende die entsprechende skillId mit dem actionSkill-Tool. Zum Beispiel: Wenn er nach dem Menü fragt, verwende actionSkill mit skillId: "show-menu". Für show-menu kannst du optional args.category verwenden, um nach Kategorie zu filtern (z.B. "appetizers", "mains", "desserts", "drinks").

${dataContextString ? `\nHintergrundwissen:\n${dataContextString}` : ''}`;

                                                session.sendClientContent({
                                                    turns: contextMessage,
                                                    turnComplete: true,
                                                });
                                                console.log(`[voice/live] ✅ Updated AI context for agent: ${agentId}`);
                                            }).catch(err => {
                                                console.error(`[voice/live] Failed to load agent config:`, err);
                                            });
                                        }

                                        return {
                                            name: "switchAgent",
                                            response: { result: { success: true, message: `Switched to ${agentId}`, agentId: agentId } },
                                            id: fc.id
                                        };
                                    }

                                    if (toolName === "actionSkill") {
                                        // Frontend handles actionSkill execution, just acknowledge
                                        const { agentId, skillId, args } = fc.args || {};
                                        console.log(`[voice/live] ✅ Handling actionSkill tool call: agent="${agentId}", skill="${skillId}", args:`, args);
                                        console.log(`[voice/live] 🔍 DEBUG toolCall handler: currentAgentId=${currentAgentId}, agentId=${agentId}, initialAgentId was=${initialAgentId}`);

                                        // Check if we're in the right agent context
                                        // If currentAgentId is null (dashboard) or doesn't match, reject the skill call
                                        if (!currentAgentId || currentAgentId !== agentId) {
                                            // Send error message to LLM that this skill is not available
                                            session.sendClientContent({
                                                turns: `[System] Entschuldigung, ich habe diese Funktion nicht verfügbar. Bitte wechsle zu einem Agenten, der diese Funktion unterstützt.`,
                                                turnComplete: true,
                                            });

                                            return {
                                                name: "actionSkill",
                                                response: { result: { success: false, error: `Skill "${skillId}" not available in current context. Current agent: ${currentAgentId || 'dashboard'}, requested agent: ${agentId}` } },
                                                id: fc.id
                                            };
                                        }

                                        // Provide dynamic context knowledge when menu tool is called
                                        // Send as text message to conversation (same way as agent switch context)
                                        // Menu data comes from agent config's dataContext (single source of truth)
                                        if (skillId === "show-menu") {
                                            // Use same pattern as switchAgent - load config and send context
                                            loadAgentConfig(agentId).then(async config => {
                                                // Find show-menu skill
                                                const skill = config.skills?.find((s: any) => s.id === 'show-menu');

                                                // Get menu data from skill-specific dataContext (preferred)
                                                let menuContextItem = null;
                                                if (skill?.dataContext) {
                                                    const skillDataContext = Array.isArray(skill.dataContext) ? skill.dataContext : [skill.dataContext];
                                                    menuContextItem = skillDataContext.find((item: any) => item.id === 'menu');
                                                }

                                                // Fallback to agent-level dataContext (for backwards compatibility)
                                                if (!menuContextItem) {
                                                    menuContextItem = config.dataContext?.find((item: any) => item.id === 'menu');
                                                }

                                                if (menuContextItem && menuContextItem.data) {
                                                    // Import menu context generator
                                                    const { getMenuContextString } = await import('@hominio/agents');
                                                    // Pass both menu data and full config (for instructions, categoryNames, currency, reminder)
                                                    const menuContext = getMenuContextString(menuContextItem.data, menuContextItem);

                                                    // Send menu context as text message to conversation using sendClientContent
                                                    session.sendClientContent({
                                                        turns: menuContext,
                                                        turnComplete: true,
                                                    });
                                                    console.log(`[voice/live] ✅ Injected menu context for show-menu tool call (from skill dataContext)`);
                                                } else {
                                                    console.warn(`[voice/live] ⚠️ Menu data not found in skill or agent config`);
                                                }
                                            }).catch(err => {
                                                console.error(`[voice/live] Error loading menu context:`, err);
                                            });
                                        }

                                        return {
                                            name: "actionSkill",
                                            response: { result: { success: true, message: `Executing skill ${skillId} for agent ${agentId}`, agentId, skillId } },
                                            id: fc.id
                                        };
                                    }

                                    // Unknown tool
                                    console.warn(`[voice/live] ⚠️ Unknown tool: "${toolName}"`);
                                    return {
                                        name: toolName,
                                        response: { result: { error: `Unknown tool: ${toolName}` } },
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

