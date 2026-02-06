/**
 * Shared Tool Call Handlers
 * Utilities for handling tool calls consistently across the frontend
 * Pure JavaScript version
 */

/**
 * Dispatch tool call event to window
 * @param {Object} event - Tool call event object
 * @param {string} event.toolName - Name of the tool
 * @param {Object} event.args - Tool arguments
 * @param {string} [event.contextString] - Optional context string
 * @param {*} [event.result] - Optional tool result
 * @param {number} event.timestamp - Event timestamp
 */
export function dispatchToolCallEvent(event) {
	const customEvent = new CustomEvent('toolCall', {
		detail: event,
	})
	window.dispatchEvent(customEvent)
}
