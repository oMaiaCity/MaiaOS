<script lang="ts">
	import { onMount } from 'svelte';
	import { GlassCard, LoadingSpinner } from '@hominio/brand';
	import { nanoid } from 'nanoid';
	import { parseToolCallEvent, type ToolCallEvent } from '@hominio/voice';

	// Task-oriented data structure
	type TaskEvent = {
		id: string;
		timestamp: number;
		type: 'state' | 'toolCall' | 'taskUpdate';
		data: any;
	};

	type Task = {
		id: string;
		agentName: string;
		status: 'DOING' | 'DONE' | 'BLOCKED' | 'TODO';
		description?: string;
		result?: any;
		events: TaskEvent[];
		timestamp: number;
		isExpanded: boolean;
	};

	let tasks = $state<Task[]>([]);
	let streamContainer = $state<HTMLElement | undefined>(undefined);
	let logs = $state<Array<{ timestamp: number; message: string; context?: string }>>([]);
	let currentExecutionId = $state<string | null>(null);
	let currentIntent = $state<string | null>(null);
	const intentByTaskId = new Map<string, string>();

	// Helper to get or create task
	function getOrCreateTask(taskId: string, agentName: string = 'Kai', intent?: string): Task {
		let task = tasks.find(t => t.id === taskId);
		if (!task) {
			task = {
				id: taskId,
				agentName,
				status: 'TODO',
				description: intent || currentIntent || undefined,
				events: [],
				timestamp: Date.now(),
				isExpanded: false
			};
			if (intent) {
				intentByTaskId.set(taskId, intent);
			}
			tasks = [...tasks, task];
		} else if (intent && !task.description) {
			// Update description if we have intent and task doesn't have it
			tasks = tasks.map(t => {
				if (t.id === taskId) {
					return { ...t, description: intent };
				}
				return t;
			});
			intentByTaskId.set(taskId, intent);
		}
		return task;
	}

	// Parse log messages for real-time updates
	function parseLogForUpdates(message: string, context?: string) {
			// Parse "Kai task update: {taskId} - {status}"
			const taskUpdateMatch = message.match(/Kai task update: ([a-f0-9-]+) - (DOING|DONE|BLOCKED|TODO)/i);
			if (taskUpdateMatch) {
				const [, taskId, status] = taskUpdateMatch;
				
				// Get intent from multiple sources (in order of priority)
				const intentToUse = currentIntent || intentByTaskId.get(taskId) || 'Unknown intent';
				
				// Check if we have a placeholder task that should be replaced
				const placeholderIndex = tasks.findIndex(t => t.id.startsWith('pending-'));
				let taskWasReplaced = false;
				if (placeholderIndex !== -1) {
					// Replace placeholder with real task, preserving description
					const placeholder = tasks[placeholderIndex];
					const finalIntent = placeholder.description || intentToUse;
					const updatedTasks = [...tasks];
					updatedTasks[placeholderIndex] = {
						id: taskId,
						agentName: 'Kai',
						status: status as 'DOING' | 'DONE' | 'BLOCKED' | 'TODO',
						description: finalIntent, // CRITICAL: Preserve intent
						events: [],
						timestamp: Date.now(),
						isExpanded: placeholder.isExpanded
					};
					tasks = updatedTasks;
					// Store intent for this task ID
					intentByTaskId.set(taskId, finalIntent);
					currentIntent = finalIntent; // Update currentIntent
					taskWasReplaced = true;
				} else {
					// No placeholder - ensure task exists with intent
					const existingTaskIndex = tasks.findIndex(t => t.id === taskId);
					if (existingTaskIndex === -1) {
						// Create new task with intent
						const newTask: Task = {
							id: taskId,
							agentName: 'Kai',
							status: status as 'DOING' | 'DONE' | 'BLOCKED' | 'TODO',
							description: intentToUse,
							events: [],
							timestamp: Date.now(),
							isExpanded: false
						};
						tasks = [...tasks, newTask];
						intentByTaskId.set(taskId, intentToUse);
						if (!currentIntent) {
							currentIntent = intentToUse; // Update currentIntent if not set
						}
					} else {
						// Update existing task - ensure description is set
						const existingTask = tasks[existingTaskIndex];
						if (!existingTask.description || existingTask.description === 'Unknown intent') {
							const updatedTasks = [...tasks];
							updatedTasks[existingTaskIndex] = {
								...existingTask,
								description: intentToUse
							};
							tasks = updatedTasks;
							intentByTaskId.set(taskId, intentToUse);
							if (!currentIntent) {
								currentIntent = intentToUse;
							}
						}
					}
				}
			
			// Get task - if we replaced placeholder, it already exists in tasks array
			// If not replaced, ensure it exists (but don't create duplicates)
			let task = tasks.find(t => t.id === taskId);
			if (!task && !taskWasReplaced) {
				// Only create if we didn't just replace (to avoid duplicates)
				task = getOrCreateTask(taskId, 'Kai', currentIntent || undefined);
			}
			
			// Parse result from context if available
			let result = task?.result;
			if (context && context.trim() !== '' && context !== '{}' && context !== 'unknown' && context !== 'overall') {
				try {
					// Check if it's a preview format like "({...})" or just "{...}"
					let jsonString = context.trim();
					
					// Remove surrounding parentheses if present
					if (jsonString.startsWith('(') && jsonString.endsWith(')')) {
						jsonString = jsonString.slice(1, -1);
					}
					
					// Try to parse as JSON
					const parsed = JSON.parse(jsonString);
					if (parsed && typeof parsed === 'object') {
						result = parsed;
					}
				} catch (e) {
					// If parsing fails, try to extract JSON from preview format
					const previewMatch = context.match(/\((\{.+?\})\)/s);
					if (previewMatch) {
						try {
							const parsed = JSON.parse(previewMatch[1]);
							if (parsed && typeof parsed === 'object') {
								result = parsed;
							}
						} catch (e2) {
							// Ignore parse errors - keep existing result
						}
					}
				}
			}

			// Update task reactively - ensure we create a new array for Svelte reactivity
			// CRITICAL: Always update the task, even if we just replaced the placeholder
			const taskIndex = tasks.findIndex(t => t.id === taskId);
			if (taskIndex !== -1) {
				const taskEvent: TaskEvent = {
					id: nanoid(),
					timestamp: Date.now(),
					type: 'taskUpdate',
					data: { taskId, status, result }
				};
				const updatedTasks = [...tasks];
				const existingTask = updatedTasks[taskIndex];
				// CRITICAL: Always preserve description, and if missing, use currentIntent
				const preservedDescription = existingTask.description || currentIntent || intentByTaskId.get(taskId) || undefined;
				updatedTasks[taskIndex] = {
					...existingTask,
					status: status as 'DOING' | 'DONE' | 'BLOCKED' | 'TODO',
					result: result || existingTask.result,
					description: preservedDescription, // Always preserve/restore description
					events: [...existingTask.events, taskEvent]
				};
				tasks = updatedTasks;
			} else if (task && !taskWasReplaced) {
				// Task exists but wasn't found in array (shouldn't happen, but handle it)
				// Update it directly
				const taskEvent: TaskEvent = {
					id: nanoid(),
					timestamp: Date.now(),
					type: 'taskUpdate',
					data: { taskId, status, result }
				};
				const taskIndex = tasks.findIndex(t => t.id === taskId);
				if (taskIndex !== -1) {
					const updatedTasks = [...tasks];
					updatedTasks[taskIndex] = {
						...tasks[taskIndex],
						status: status as 'DOING' | 'DONE' | 'BLOCKED' | 'TODO',
						result: result || tasks[taskIndex].result,
						events: [...tasks[taskIndex].events, taskEvent]
					};
					tasks = updatedTasks;
				}
			}
		}

		// Parse "Kai agent state: {state}"
		const stateMatch = message.match(/Kai agent state: (working|done)/i);
		if (stateMatch) {
			const [, state] = stateMatch;
			
			// Extract taskId AND intent from context if available
			// Context format: "task: {taskId} | intent: "{intent}""
			let taskIdFromContext: string | null = null;
			let intentFromContext: string | null = null;
			
			if (context && context !== 'unknown' && context !== 'overall' && context.trim() !== '') {
				// Try to extract intent first
				const intentMatch = context.match(/intent:\s*"([^"]+)"/);
				if (intentMatch) {
					intentFromContext = intentMatch[1];
					// Update currentIntent if found
					if (intentFromContext) {
						currentIntent = intentFromContext;
					}
				}
				
				// Extract taskId
				const taskIdMatch = context.match(/task:\s*([a-f0-9-]+)/i) || context.match(/^([a-f0-9-]+)$/);
				if (taskIdMatch) {
					taskIdFromContext = taskIdMatch[1];
				}
			}
			
			// If we have an intent but no task yet, we can create/update here
			if (intentFromContext && taskIdFromContext) {
				// Update intent map
				intentByTaskId.set(taskIdFromContext, intentFromContext);
				
				// Check if we have a placeholder to replace
				const placeholderIndex = tasks.findIndex(t => t.id.startsWith('pending-'));
				if (placeholderIndex !== -1) {
					const placeholder = tasks[placeholderIndex];
					const updatedTasks = [...tasks];
					updatedTasks[placeholderIndex] = {
						id: taskIdFromContext,
						agentName: 'Kai',
						status: 'TODO', // Will be updated by events
						description: intentFromContext,
						events: [...placeholder.events],
						timestamp: Date.now(),
						isExpanded: placeholder.isExpanded
					};
					tasks = updatedTasks;
				} else {
					// Ensure task exists with correct description
					const existingTask = tasks.find(t => t.id === taskIdFromContext);
					if (existingTask) {
						if (!existingTask.description || existingTask.description === 'Unknown intent') {
							const updatedTasks = tasks.map(t => t.id === taskIdFromContext ? { ...t, description: intentFromContext! } : t);
							tasks = updatedTasks;
						}
					} else {
						// Create new task if needed
						const newTask: Task = {
							id: taskIdFromContext,
							agentName: 'Kai',
							status: state === 'working' ? 'DOING' : 'DONE',
							description: intentFromContext,
							events: [],
							timestamp: Date.now(),
							isExpanded: false
						};
						tasks = [...tasks, newTask];
					}
				}
			}

			// Add state event to relevant task(s)
			if (taskIdFromContext) {
				// Add to specific task
				const taskIndex = tasks.findIndex(t => t.id === taskIdFromContext);
				if (taskIndex !== -1) {
					const taskEvent: TaskEvent = {
						id: nanoid(),
						timestamp: Date.now(),
						type: 'state',
						data: { state, taskId: taskIdFromContext }
					};
					const updatedTasks = [...tasks];
					updatedTasks[taskIndex] = {
						...updatedTasks[taskIndex],
						events: [...updatedTasks[taskIndex].events, taskEvent]
					};
					tasks = updatedTasks;
				}
			} else if (tasks.length > 0) {
				// Add to first task as overall state
				const taskEvent: TaskEvent = {
					id: nanoid(),
					timestamp: Date.now(),
					type: 'state',
					data: { state, taskId: null }
				};
				const updatedTasks = [...tasks];
				updatedTasks[0] = {
					...updatedTasks[0],
					events: [...updatedTasks[0].events, taskEvent]
				};
				tasks = updatedTasks;
			}

			// If state is done, mark all DOING tasks as DONE
			if (state === 'done') {
				tasks = tasks.map(t => ({
					...t,
					status: t.status === 'DOING' || t.status === 'TODO' ? 'DONE' : t.status
				}));
			}
		}

		// Parse "Kai tool call: {toolName}"
		const toolCallMatch = message.match(/Kai tool call: (\w+)/i);
		if (toolCallMatch) {
			const [, toolName] = toolCallMatch;
			// Add tool call event to first task
			if (tasks.length > 0) {
				let toolArgs = {};
				let toolResult = null;
				if (context) {
					try {
						const parsed = JSON.parse(context);
						toolArgs = parsed;
					} catch (e) {
						// Ignore parse errors
					}
				}

				const taskEvent: TaskEvent = {
					id: nanoid(),
					timestamp: Date.now(),
					type: 'toolCall',
					data: { toolName, toolArgs, toolResult }
				};
				if (tasks.length > 0) {
					const updatedTasks = [...tasks];
					updatedTasks[0] = {
						...updatedTasks[0],
						events: [...updatedTasks[0].events, taskEvent]
					};
					tasks = updatedTasks;
				}
			}
		}
	}

	function handleToolCall(toolName: string, args: any, contextString?: string, result?: any) {
		// Only handle delegateIntent tool calls
		if (toolName !== 'delegateIntent') {
			return;
		}

		const intent = args?.intent || 'Unknown intent';
		// Note: "delegateIntent called" is already logged at the backend start via context.onLog
		// This function handles the toolCall event which arrives AFTER execution completes
		
		// Start new execution - clear old tasks and store intent
		currentExecutionId = nanoid();
		currentIntent = intent;
		intentByTaskId.clear();
		tasks = [];

		// Process result if available (final state)
		if (result) {
			// Deduplicate tasks by ID
			const seenTaskIds = new Set<string>();
			const uniqueTasks: any[] = [];
			
			if (result.tasks && Array.isArray(result.tasks)) {
				for (const taskData of result.tasks) {
					if (!seenTaskIds.has(taskData.id)) {
						seenTaskIds.add(taskData.id);
						uniqueTasks.push(taskData);
					}
				}
			}

			// Process unique tasks
			for (const taskData of uniqueTasks) {
				const taskId = taskData.id;
				const task = getOrCreateTask(taskId, 'Kai', currentIntent || undefined);
				
				// Update task with final state - ensure reactivity
				const taskIndex = tasks.findIndex(t => t.id === taskId);
				if (taskIndex !== -1) {
					const updatedTasks = [...tasks];
					updatedTasks[taskIndex] = {
						...updatedTasks[taskIndex],
						status: taskData.status || updatedTasks[taskIndex].status,
						result: taskData.result || updatedTasks[taskIndex].result,
						description: currentIntent || updatedTasks[taskIndex].description
					};
					tasks = updatedTasks;
				}
			}

			// Process events from result (for final reconciliation)
			if (result.events && Array.isArray(result.events)) {
				for (const event of result.events) {
					if (event.type === 'taskUpdate' && event.data.taskId) {
						const taskId = event.data.taskId;
						const taskIndex = tasks.findIndex(t => t.id === taskId);
						if (taskIndex !== -1) {
							const updatedTasks = [...tasks];
							// Update result if event has better data
							if (event.data.result && Object.keys(event.data.result).length > 0) {
								updatedTasks[taskIndex] = {
									...updatedTasks[taskIndex],
									result: event.data.result,
									status: event.data.status || updatedTasks[taskIndex].status
								};
								tasks = updatedTasks;
							}
						}
					}
				}
			}

			// Update overall agent state
			if (result.state === 'done') {
				const updatedTasks = tasks.map(t => ({
					...t,
					status: t.status === 'DOING' || t.status === 'TODO' ? 'DONE' : t.status
				}));
				tasks = updatedTasks;
			}

			// Update task results from result.message if available
			if (result.message && tasks.length > 0) {
				const updatedTasks = [...tasks];
				// Add message as result to first task if no result exists
				if (!updatedTasks[0].result || Object.keys(updatedTasks[0].result).length === 0) {
					updatedTasks[0] = {
						...updatedTasks[0],
						result: { message: result.message }
					};
					tasks = updatedTasks;
				}
			}

			if (result.result) {
				addLog(`Result: ${JSON.stringify(result.result)}`);
			}
		}
	}

	// Handle log events from voice service - parse for real-time updates
	function handleVoiceLog(message: string, context?: string) {
		// Only show logs related to Kai/delegateIntent
		const isRelevant = message.includes('Kai') || 
			message.includes('delegateIntent') || 
			message.includes('kai') || 
			message.includes('KAI_TASK_CREATED') ||
			message.includes('task CREATED');
		
		if (isRelevant) {
			addLog(message, context);
			
			// CRITICAL: Check for KAI_TASK_CREATED event - this is fired IMMEDIATELY when task is created in KaibanJS
			// Also check for "task CREATED" log format
			const taskCreatedMatch = message.match(/KAI_TASK_CREATED:([a-f0-9-]+):(.+)/) || 
				message.match(/Kai task CREATED:\s*([a-f0-9-]+)\s+with intent:\s*"(.+)"/);
			if (taskCreatedMatch) {
				const [, taskId, intent] = taskCreatedMatch;
				
				// Set current intent
				currentIntent = intent;
				
				// Check if we have a placeholder task to replace
				const placeholderIndex = tasks.findIndex(t => t.id.startsWith('pending-'));
				if (placeholderIndex !== -1) {
					// Replace placeholder with real task, preserving events if any
					const placeholder = tasks[placeholderIndex];
					const updatedTasks = [...tasks];
					updatedTasks[placeholderIndex] = {
						id: taskId,
						agentName: 'Kai',
						status: 'TODO', // Will be updated by subsequent task update logs
						description: intent, // CRITICAL: Set intent immediately
						events: placeholder.events || [], // Preserve any existing events
						timestamp: placeholder.timestamp, // Preserve original timestamp
						isExpanded: placeholder.isExpanded
					};
					tasks = updatedTasks;
					intentByTaskId.set(taskId, intent);
				} else {
					// Check if task already exists (avoid duplicates)
					const existingTaskIndex = tasks.findIndex(t => t.id === taskId);
					if (existingTaskIndex === -1) {
						// Create new task if no placeholder exists and task doesn't exist
						const intentToUse = intent || currentIntent || 'Unknown intent';
						const newTask: Task = {
							id: taskId,
							agentName: 'Kai',
							status: 'TODO',
							description: intentToUse, // CRITICAL: Set intent immediately
							events: [],
							timestamp: Date.now(),
							isExpanded: false
						};
						tasks = [...tasks, newTask];
						intentByTaskId.set(taskId, intentToUse);
						currentIntent = intentToUse; // Also update currentIntent
					} else {
						// Task already exists, just update description if needed
						if (!tasks[existingTaskIndex].description || tasks[existingTaskIndex].description === 'Unknown intent') {
							const updatedTasks = [...tasks];
							updatedTasks[existingTaskIndex] = {
								...tasks[existingTaskIndex],
								description: intent || currentIntent || 'Unknown intent'
							};
							tasks = updatedTasks;
							intentByTaskId.set(taskId, intent || currentIntent || '');
						}
					}
				}
				return; // Early return - task is created/updated
			}
			
			// Parse log for real-time task updates
			parseLogForUpdates(message, context);
		}
	}

	function addLog(message: string, context?: string) {
		logs = [...logs, { timestamp: Date.now(), message, context }];
		// Keep only last 100 logs
		if (logs.length > 100) {
			logs = logs.slice(-100);
		}
	}

	function toggleExpand(taskId: string) {
		tasks = tasks.map(task => {
			if (task.id === taskId) {
				return { ...task, isExpanded: !task.isExpanded };
			}
			return task;
		});
	}

	function clearActivities() {
		tasks = [];
		logs = [];
	}

	onMount(() => {
		// Listen for toolCall events from voice service (filter for delegateIntent)
		const handleToolCallEvent = (event: Event) => {
			const customEvent = event as CustomEvent;
			const toolCall = parseToolCallEvent(customEvent);
			
			if (!toolCall) {
				return;
			}
			
			const { toolName, args, contextString, result } = toolCall;
			
			// Only handle delegateIntent tool calls
			if (toolName === 'delegateIntent') {
				// CRITICAL: Extract intent IMMEDIATELY from toolCall event
				const intent = args?.intent;
				if (intent && typeof intent === 'string') {
					// Check if this is early notification: result has __earlyNotification flag
					const isEarlyNotification = result && typeof result === 'object' && (result as any).__earlyNotification === true;
					currentIntent = intent;
					
					// If this is an early notification (before execution), create placeholder immediately
					if (isEarlyNotification) {
						currentExecutionId = nanoid();
						intentByTaskId.clear();
						
						// Clear old tasks and create fresh placeholder
						const placeholderTaskId = `pending-${currentExecutionId}`;
						const placeholderTask: Task = {
							id: placeholderTaskId,
							agentName: 'Kai',
							status: 'TODO',
							description: intent, // CRITICAL: Set intent immediately
							events: [],
							timestamp: Date.now(),
							isExpanded: false
						};
						tasks = [placeholderTask]; // Clear and set new task
						intentByTaskId.set(placeholderTaskId, intent);
						return; // Early return - don't process further
					} else {
						// Late notification (after execution) - update existing tasks
						const updatedTasks = tasks.map(task => {
							if (!task.description || task.description === 'Unknown intent') {
								return {
									...task,
									description: intent
								};
							}
							return task;
						});
						
						if (updatedTasks.some((t, i) => t.description !== tasks[i]?.description)) {
							tasks = updatedTasks;
						}
					}
				}
				
				// Only call handleToolCall for final notification (with result)
				if (result !== undefined) {
					handleToolCall(toolName, args, contextString, result);
				}
			}
		};

		// Listen for log events from voice service
		const handleVoiceLogEvent = (event: Event) => {
			const customEvent = event as CustomEvent;
			const { message, context } = customEvent.detail;
			handleVoiceLog(message, context);
		};

		window.addEventListener('toolCall', handleToolCallEvent);
		window.addEventListener('voiceLog', handleVoiceLogEvent);

		return () => {
			window.removeEventListener('toolCall', handleToolCallEvent);
			window.removeEventListener('voiceLog', handleVoiceLogEvent);
		};
	});
</script>

<div class="min-h-screen bg-glass-gradient p-4 md:p-8">
	<div class="max-w-6xl mx-auto space-y-6">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-slate-800">Kai Agent</h1>
				<p class="text-slate-600 mt-1">KaibanJS Agent Execution Environment - Triggered via Voice System</p>
			</div>
			<button
				onclick={clearActivities}
				class="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium transition-colors"
			>
				Clear
			</button>
		</div>

		<!-- Info Card -->
		<GlassCard class="p-6">
			<p class="text-slate-700">
				This page displays activity from <code class="bg-slate-100 px-2 py-1 rounded">delegateIntent</code> tool calls triggered by the voice system.
				Use the voice interface to delegate intents to the Kai agent.
			</p>
		</GlassCard>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Activity Stream -->
            <div class="space-y-4">
                <h2 class="text-xl font-semibold text-slate-800">Activity Stream</h2>
                {#if tasks.length === 0}
                    <GlassCard class="p-8 text-center text-slate-500">
                        <p>No tasks yet. Use the voice interface to trigger delegateIntent tool calls.</p>
                    </GlassCard>
                {:else}
                    <div bind:this={streamContainer} class="space-y-3">
                        {#each tasks as task (task.id)}
                            <GlassCard class="overflow-hidden border-l-4 {task.status === 'DONE' ? 'border-l-green-400' : task.status === 'DOING' ? 'border-l-blue-400' : 'border-l-slate-400'}" lifted={true}>
                                <!-- Task Header -->
                                <button 
                                    class="flex justify-between items-center p-4 w-full text-left border-b transition-colors cursor-pointer border-slate-100/10 hover:bg-slate-50/30"
                                    onclick={() => toggleExpand(task.id)}
                                >
                                    <div class="flex gap-3 items-center">
                                        <div class="flex justify-center items-center w-10 h-10 text-indigo-600 bg-indigo-100 rounded-full shadow-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="m4.93 19.07 4.24-4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="M14.83 9.17 19.07 4.93"/><path d="M14.83 9.17 19.07 4.93"/><path d="M4.93 19.07 9.17 14.83"/><path d="M9.17 14.83 4.93 19.07"/><path d="M14.83 9.17 9.17 14.83"/><path d="M9.17 14.83 14.83 9.17"/><circle cx="12" cy="12" r="10"/></svg>
                                        </div>
                                        <div>
                                            <div class="text-sm font-semibold tracking-wide text-slate-800">{task.agentName}</div>
                                            {#if task.description || currentIntent}
                                                <div class="text-xs text-slate-600 italic">"{task.description || currentIntent}"</div>
                                            {/if}
                                            <div class="text-xs text-slate-500 font-mono">Task {task.id.substring(0, 8)}...</div>
                                        </div>
                                        <span class="ml-2 text-[10px] px-2 py-1 rounded-full {task.status === 'DONE' ? 'bg-green-100 text-green-700' : task.status === 'DOING' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}">
                                            {task.status}
                                        </span>
                                    </div>
                                    <div class="flex gap-3 items-center">
                                        <div class="text-xs tabular-nums text-slate-400">
                                            {new Date(task.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div class="transition-transform duration-300 text-slate-400" class:rotate-180={task.isExpanded}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                        </div>
                                    </div>
                                </button>

                                <!-- Expanded Content -->
                                {#if task.isExpanded}
                                    {@const { result, ...taskDetails } = task}
                                    <div class="p-4 bg-slate-50/30 space-y-4">
                                        <!-- Task Details (without result) -->
                                        <div>
                                            <h4 class="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-700">Task Details</h4>
                                            <pre class="overflow-x-auto overflow-y-auto p-3 max-h-96 text-xs rounded border bg-slate-50 border-slate-200">{JSON.stringify(taskDetails, null, 2)}</pre>
                                        </div>

                                        <!-- Task Result -->
                                        {#if task.result}
                                            <div>
                                                <h4 class="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-700">Task Result</h4>
                                                <pre class="overflow-x-auto overflow-y-auto p-3 max-h-96 text-xs rounded border bg-slate-50 border-slate-200">{JSON.stringify(task.result, null, 2)}</pre>
                                            </div>
                                        {/if}

                                        <!-- Mini Events -->
                                        {#if task.events.length > 0}
                                            <div>
                                                <h4 class="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-700">Events ({task.events.length})</h4>
                                                <div class="space-y-2">
                                                    {#each task.events as event (event.id)}
                                                        <div class="p-2 bg-white rounded border border-slate-200">
                                                            <div class="flex items-center gap-2 mb-1">
                                                                <span class="text-[9px] px-1.5 py-0.5 rounded {event.type === 'state' ? 'bg-purple-100 text-purple-700' : event.type === 'toolCall' ? 'bg-violet-100 text-violet-700' : 'bg-cyan-100 text-cyan-700'}">
                                                                    {event.type}
                                                                </span>
                                                                <span class="text-[9px] text-slate-400">
                                                                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <pre class="overflow-x-auto text-[10px] text-slate-600">{JSON.stringify(event.data, null, 2)}</pre>
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </GlassCard>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Logs Section -->
            <div class="space-y-4">
                <h2 class="text-xl font-semibold text-slate-800">Logs</h2>
                <GlassCard class="p-4">
                    <div class="max-h-[calc(100vh-300px)] overflow-y-auto space-y-1 font-mono text-sm">
                        {#if logs.length === 0}
                            <p class="text-slate-500">No logs yet.</p>
                        {:else}
                            {#each logs as log (log.timestamp)}
                                <div class="text-slate-600">
                                    <span class="text-slate-400">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span class="ml-2">{log.message}</span>
                                    {#if log.context}
                                        <span class="text-slate-400 ml-2">({log.context.substring(0, 50)}...)</span>
                                    {/if}
                                </div>
                            {/each}
                        {/if}
                    </div>
                </GlassCard>
            </div>
        </div>
	</div>
</div>
