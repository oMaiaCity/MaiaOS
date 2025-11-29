/**
 * delegateIntent Tool Handler
 * Delegates user intents to KaibanJS agent execution environment
 * Directly calls the Kai agent execution function (runs in same process as API service)
 */

import { executeKaiAgent } from "@hominio/vibes";
import type { ToolExecutionContext, ToolResult } from "./registry.js";

export async function handleDelegateIntent(
	args: Record<string, any>,
	context: ToolExecutionContext
): Promise<ToolResult> {
	const { intent } = args || {};

	if (!intent || typeof intent !== "string") {
		return {
			success: false,
			result: { error: "Intent parameter is required and must be a string" },
			error: "Intent parameter is required and must be a string"
		};
	}

	// Get API key from environment (same as API service uses)
	const apiKey = process.env.GOOGLE_AI_API_KEY;

	if (!apiKey) {
		return {
			success: false,
			result: { error: "GOOGLE_AI_API_KEY not configured" },
			error: "GOOGLE_AI_API_KEY not configured"
		};
	}

	try {
		// Track events for activity stream
		const events: Array<{
			type: "state" | "toolCall" | "taskUpdate";
			data: any;
			timestamp: number;
		}> = [];

		// Execute Kai agent directly (we're in the same process as API service)
		const result = await executeKaiAgent(intent, {
			apiKey,
			onTaskCreated: (taskId, intent) => {
				// CRITICAL: Log task creation immediately with intent - THIS FIRES BEFORE EXECUTION STARTS
				const timestamp = new Date().toISOString();
				context.onLog?.(`[${timestamp}] Kai task CREATED: ${taskId} with intent: "${intent}"`);
				// Also log as a special event that frontend can intercept
				context.onLog?.(`KAI_TASK_CREATED:${taskId}:${intent}`);
			},
			onStateChange: (state, taskId) => {
				events.push({
					type: "state",
					data: { state, taskId },
					timestamp: Date.now()
				});
				// Embed intent in the context string so frontend can recover it if other logs are missed
				// Ensure we never send "unknown" as context if we have data
				const safeTaskId = taskId || "overall";
				const safeIntent = intent || "Unknown intent";
				const contextMsg = `task: ${safeTaskId} | intent: "${safeIntent}"`;

				context.onLog?.(`Kai agent state: ${state}`, contextMsg);
			},
			onToolCall: (toolName, toolArgs, toolResult) => {
				events.push({
					type: "toolCall",
					data: { toolName, toolArgs, toolResult },
					timestamp: Date.now()
				});
				context.onLog?.(`Kai tool call: ${toolName}`, JSON.stringify(toolArgs));
			},
			onTaskUpdate: (taskId, status, taskResult) => {
				events.push({
					type: "taskUpdate",
					data: { taskId, status, result: taskResult },
					timestamp: Date.now()
				});
				context.onLog?.(`Kai task update: ${taskId} - ${status}`, JSON.stringify(taskResult));
			}
		});

		if (!result.success) {
			return {
				success: false,
				result: { error: result.error || "Kai agent execution failed" },
				error: result.error || "Kai agent execution failed"
			};
		}

		return {
			success: true,
			result: {
				success: true,
				message: result.result || "Intent executed successfully",
				state: result.state,
				tasks: result.tasks,
				events: events
			}
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error("[delegateIntent] Error:", errorMessage);

		return {
			success: false,
			result: { error: errorMessage },
			error: errorMessage
		};
	}
}

