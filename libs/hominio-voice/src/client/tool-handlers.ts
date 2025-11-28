/**
 * Shared Tool Call Handlers
 * Utilities for handling tool calls consistently across the frontend
 */

export type ToolName = 'queryVibeContext' | 'actionSkill';

export interface ToolCallEvent {
	toolName: ToolName;
	args: Record<string, any>;
	contextString?: string;
	result?: any;
	timestamp: number;
}

export interface ActionSkillArgs {
	vibeId: string;
	skillId: string;
	[key: string]: any; // Additional args
}

export interface QueryVibeContextArgs {
	vibeId: string;
}

/**
 * Check if a tool name is a query tool (background operation)
 */
export function isQueryTool(toolName: string): toolName is 'queryVibeContext' {
	return toolName === 'queryVibeContext';
}

/**
 * Check if a tool name is an action skill (UI operation)
 */
export function isActionSkill(toolName: string): toolName is 'actionSkill' {
	return toolName === 'actionSkill';
}

/**
 * Extract and normalize action skill arguments
 * Handles both flat and nested args structures from LLM
 */
export function extractActionSkillArgs(args: Record<string, any>): ActionSkillArgs {
	const { vibeId, skillId, ...restArgs } = args;
	
	// Handle potential nested args from LLM (hallucination or habit)
	// If restArgs has a single property 'args' which is an object, use that instead
	let skillArgs = restArgs;
	if (Object.keys(restArgs).length === 1 && restArgs.args && typeof restArgs.args === 'object') {
		console.log('[ToolHandlers] ⚠️ Detected nested args object from LLM, flattening...');
		skillArgs = restArgs.args;
	}
	
	return {
		vibeId,
		skillId,
		...skillArgs
	};
}

/**
 * Extract query vibe context arguments
 */
export function extractQueryVibeContextArgs(args: Record<string, any>): QueryVibeContextArgs {
	return {
		vibeId: args.vibeId || 'unknown'
	};
}

/**
 * Create a tool call event from raw data
 */
export function createToolCallEvent(
	toolName: string,
	args: Record<string, any>,
	contextString?: string,
	result?: any
): ToolCallEvent {
	return {
		toolName: toolName as ToolName,
		args,
		contextString,
		result,
		timestamp: Date.now()
	};
}

/**
 * Dispatch tool call event to window
 */
export function dispatchToolCallEvent(event: ToolCallEvent) {
	const customEvent = new CustomEvent('toolCall', {
		detail: event
	});
	window.dispatchEvent(customEvent);
}

/**
 * Dispatch action skill event to window (for legacy support)
 */
export function dispatchActionSkillEvent(args: ActionSkillArgs) {
	const event = new CustomEvent('actionSkill', {
		detail: args
	});
	window.dispatchEvent(event);
}

/**
 * Parse a CustomEvent detail into a ToolCallEvent
 * Used when listening to toolCall events
 */
export function parseToolCallEvent(event: CustomEvent): ToolCallEvent | null {
	const { toolName, args, contextString, result, timestamp } = event.detail;
	
	if (!toolName || !args) {
		console.warn('[ToolHandlers] Invalid tool call event:', event.detail);
		return null;
	}
	
	return {
		toolName: toolName as ToolName,
		args,
		contextString,
		result,
		timestamp: timestamp || Date.now()
	};
}

