/**
 * Kai Agent Logic for KaibanJS
 * Centralized agent execution with state tracking
 */

import { Agent, Task, Team } from "kaibanjs";
import { GetNameTool } from "./getNameTool.js";

export interface KaiAgentOptions {
	apiKey: string;
	onStateChange?: (state: "working" | "done", taskId?: string) => void;
	onToolCall?: (toolName: string, args: any, result: any) => void;
	onTaskUpdate?: (taskId: string, status: string, result?: any) => void;
	onTaskCreated?: (taskId: string, intent: string) => void; // NEW: Callback when task is created
}

export interface KaiExecutionResult {
	success: boolean;
	result?: any;
	error?: string;
	state: "working" | "done";
	tasks?: Array<{
		id: string;
		status: string;
		result?: any;
	}>;
}

/**
 * Execute Kai agent with user intent
 */
export async function executeKaiAgent(
	intent: string,
	options: KaiAgentOptions
): Promise<KaiExecutionResult> {
	const { apiKey, onStateChange, onToolCall, onTaskUpdate, onTaskCreated } = options;

	try {
		// Log intent interception point
		console.log(`[Kai Agent] Intercepting intent: "${intent}"`);

		// Create getName tool
		const getNameTool = new GetNameTool();

		// Create Kai agent with Gemini 1.5 Flash (as per KaibanJS docs)
		const kaiAgent = new Agent({
			name: "Kai",
			role: "AI Agent Assistant",
			goal: "Execute user intents efficiently using available tools. Provide direct, concise answers without unnecessary iterations. IMPORTANT: When asked about the system name, use the getName tool and return the exact result from that tool (which is 'Hominio'), NOT your own name 'Kai'.",
			background: "An AI agent that helps users by executing tasks quickly and directly. When asked about names, always use the getName tool and return its result.",
			tools: [getNameTool],
			llmConfig: {
				provider: "google",
				model: "gemini-2.5-flash",
				// @ts-ignore - KaibanJS types might be outdated, but this works at runtime
				apiKey: apiKey,
				maxRetries: 1  // Limit retries to reduce iterations
			}
		});

		// Create task from user intent with maxIterations limit
		const task = new Task({
			description: intent,
			expectedOutput: "A direct, concise response addressing the user's intent. If asked about the system name, use the getName tool and return its result ('Hominio'), not your own name ('Kai').",
			agent: kaiAgent
		});

		// CRITICAL: Notify frontend IMMEDIATELY when task is created, before execution starts
		// Get the task ID (it's generated when Task is created)
		// Try multiple ways to get the ID
		const taskId = (task as any).id || task.id || (task as any).referenceId || "pending-task";
		console.error(`[Kai Agent] 🔵🔵🔵 TASK CREATED IMMEDIATELY! ID: ${taskId}, intent: "${intent}"`);
		console.log(`[Kai Agent] ✅ Task created! ID: ${taskId}, intent: "${intent}"`);
		console.log(`[Kai Agent] Task object:`, task);
		console.log(`[Kai Agent] Task keys:`, Object.keys(task));

		// Call callback immediately - THIS MUST HAPPEN BEFORE team.start()
		if (onTaskCreated) {
			console.error(`[Kai Agent] 🔵🔵🔵 CALLING onTaskCreated NOW! taskId: ${taskId}, intent: "${intent}"`);
			onTaskCreated(taskId, intent);
		} else {
			console.error(`[Kai Agent] ❌❌❌ onTaskCreated callback NOT PROVIDED!`);
		}

		// Create team with maxIterations configuration (if supported)
		const team = new Team({
			name: "Kai Execution Team",
			agents: [kaiAgent],
			tasks: [task],
			env: {
				GOOGLE_API_KEY: apiKey  // KaibanJS expects GOOGLE_API_KEY, not GOOGLE_AI_API_KEY
			},
			// Try maxIterations at team level (if supported by KaibanJS)
			maxIterations: 1
		} as any);

		// Track state changes
		let currentState: "working" | "done" = "working";
		const tasks: Array<{ id: string; status: string; result?: any }> = [];

		// Subscribe to workflow status changes
		team.onWorkflowStatusChange((status) => {
			if (status === "FINISHED") {
				currentState = "done";
				onStateChange?.("done", taskId);
			} else {
				currentState = "working";
				onStateChange?.("working", taskId);
			}
		});

		// Subscribe to workflow logs for task updates
		const teamStore = team.useStore();
		let previousLogsLength = 0;

		const unsubscribe = teamStore.subscribe(() => {
			const state = teamStore.getState();
			const workflowLogs = state.workflowLogs || [];

			// Process new logs
			if (workflowLogs.length > previousLogsLength) {
				const newLogs = workflowLogs.slice(previousLogsLength);
				previousLogsLength = workflowLogs.length;

				for (const log of newLogs) {
					if (log.logType === "TaskStatusUpdate") {
						const taskStatus = log.task?.status || "UNKNOWN";
						const taskId = log.task?.referenceId || log.task?.id || "unknown";

						// Check if we already tracked this task
						const existingTask = tasks.find(t => t.id === taskId);
						if (!existingTask) {
							tasks.push({
								id: taskId,
								status: taskStatus,
								result: log.metadata
							});
						} else {
							// Update existing task
							existingTask.status = taskStatus;
							existingTask.result = log.metadata;
						}

						onTaskUpdate?.(taskId, taskStatus, log.metadata);
					}

					// Track tool calls
					if (log.logType === "ToolCall") {
						onToolCall?.(
							log.toolCall?.name || "unknown",
							log.toolCall?.args || {},
							log.toolCall?.result
						);
					}
				}
			}
		});

		// Start execution
		console.log(`[Kai Agent] Starting execution for task ${taskId}`);
		onStateChange?.("working", taskId); // Pass taskId to link state to task

		const output = await team.start();

		// Unsubscribe from store updates
		unsubscribe?.();

		// Get final state from store
		const finalState = teamStore.getState();
		const finalLogs = finalState.workflowLogs || [];
		const completedTasks = finalLogs
			.filter((log: any) => log.logType === "TaskStatusUpdate" && log.task?.status === "DONE")
			.map((log: any) => ({
				id: log.task?.referenceId || log.task?.id || "unknown",
				status: log.task?.status || "DONE",
				result: log.metadata
			}));

		return {
			success: true,
			result: output.result,
			state: "done",
			tasks: completedTasks.length > 0 ? completedTasks : tasks
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		const errorStack = error instanceof Error ? error.stack : undefined;
		console.error("[Kai Agent] Execution error:", errorMessage);
		console.error("[Kai Agent] Error stack:", errorStack);
		console.error("[Kai Agent] Full error:", error);

		return {
			success: false,
			error: errorMessage,
			state: "done"
		};
	}
}

