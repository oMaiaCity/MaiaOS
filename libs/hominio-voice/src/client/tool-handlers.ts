/**
 * Shared Tool Call Handlers
 * Utilities for handling tool calls consistently across the frontend
 */

export type ToolName = 'delegateIntent';

export interface ToolCallEvent {
	toolName: ToolName;
	args: Record<string, any>;
	contextString?: string;
	result?: any;
	timestamp: number;
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

