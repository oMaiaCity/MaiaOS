/**
 * Kai Agent API Endpoint
 * Proxy endpoint for KaibanJS agent execution
 */

import { executeKaiAgent } from "@hominio/vibes";
import type { AuthData } from "../../../lib/auth-context";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!GOOGLE_AI_API_KEY) {
	console.warn("[kai] WARNING: GOOGLE_AI_API_KEY not set.");
}

export async function handleKaiChat(
	intent: string,
	authData: AuthData | null
): Promise<{
	success: boolean;
	result?: any;
	error?: string;
	state: "working" | "done";
	tasks?: Array<{
		id: string;
		status: string;
		result?: any;
	}>;
	events?: Array<{
		type: "state" | "toolCall" | "taskUpdate";
		data: any;
		timestamp: number;
	}>;
}> {
	if (!GOOGLE_AI_API_KEY) {
		return {
			success: false,
			error: "GOOGLE_AI_API_KEY not configured",
			state: "done"
		};
	}

	// Track events for activity stream
	const events: Array<{
		type: "state" | "toolCall" | "taskUpdate";
		data: any;
		timestamp: number;
	}> = [];

	try {
		const result = await executeKaiAgent(intent, {
			apiKey: GOOGLE_AI_API_KEY,
			onStateChange: (state, taskId) => {
				events.push({
					type: "state",
					data: { state, taskId },
					timestamp: Date.now()
				});
			},
			onToolCall: (toolName, toolArgs, toolResult) => {
				events.push({
					type: "toolCall",
					data: { toolName, toolArgs, toolResult },
					timestamp: Date.now()
				});
			},
			onTaskUpdate: (taskId, status, taskResult) => {
				events.push({
					type: "taskUpdate",
					data: { taskId, status, result: taskResult },
					timestamp: Date.now()
				});
			}
		});

		return {
			...result,
			events
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error("[kai] Execution error:", errorMessage);
		
		return {
			success: false,
			error: errorMessage,
			state: "done"
		};
	}
}

