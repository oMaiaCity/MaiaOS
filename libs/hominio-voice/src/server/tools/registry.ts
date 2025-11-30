/**
 * Tool Registry
 * Centralized registry for all voice tools
 */

import { handleQueryTodos } from './query-todos.js';
import { handleCreateTodo } from './create-todo.js';
import { handleEditTodo } from './edit-todo.js';

export interface ToolExecutionContext {
	session: any; // Google Live API session
	onLog?: (message: string, context?: string) => void;
	contextIngest?: any; // ContextIngestService for re-ingesting results when tasks complete
}

export interface ToolResult {
	success: boolean;
	result: any;
	contextString?: string;
	error?: string;
}

export class ToolRegistry {
	async initialize() {
		// No initialization needed - tools are defined statically
	}

	async buildToolSchemas() {
		const tools: any[] = [];

		// queryTodos - query all todos
		tools.push({
			functionDeclarations: [
				{
					name: 'queryTodos',
					description: 'Query and display all todos from the todo list. Use this when the user asks to see todos, show todos, display todos, view todos, or check todos. Also use this tool if you need to get todo IDs before editing them. This tool requires no parameters.',
					parameters: {
						type: 'object',
						properties: {},
						required: []
					}
				},
				{
					name: 'createTodo',
					description: 'Create one or more new todo items. Use this when the user asks to create a todo, add a todo, make a todo, or add a task. Supports batch creation by passing an array of titles. Requires a title parameter (string or array of strings). IMPORTANT: For batch operations, pass all titles in a single array - do NOT make multiple separate tool calls.',
					parameters: {
						type: 'object',
						properties: {
							title: {
								oneOf: [
									{
								type: 'string',
										description: 'The title of a single todo item to create.'
									},
									{
										type: 'array',
										items: { type: 'string' },
										description: 'Array of todo titles for batch creation (e.g., ["Todo 1", "Todo 2", "Todo 3"]). Use this when creating multiple todos at once.'
									}
								],
								description: 'The title(s) of the todo item(s) to create. Can be a single string for one todo, or an array of strings for batch creation.'
							}
						},
						required: ['title']
					}
				},
				{
					name: 'editTodo',
					description: 'Edit one or more existing todo items. Use this when the user asks to edit a todo, update a todo, change a todo, mark a todo as complete/incomplete, or rename a todo. Supports batch editing by passing an array of IDs. If you don\'t know the todo IDs, use queryTodos first to get them. Requires an id parameter (string or array of strings) and at least one field to update (title or completed). IMPORTANT: For batch operations, pass all IDs in a single array - do NOT make multiple separate tool calls.',
					parameters: {
						type: 'object',
						properties: {
							id: {
								oneOf: [
									{
										type: 'string',
										description: 'The ID of a single todo item to edit.'
									},
									{
										type: 'array',
										items: { type: 'string' },
										description: 'Array of todo IDs for batch editing (e.g., ["id1", "id2", "id3"]). Use this when editing multiple todos at once.'
									}
								],
								description: 'The ID(s) of the todo item(s) to edit. Can be a single string for one todo, or an array of strings for batch editing. If you don\'t know the IDs, use queryTodos first to retrieve them.'
							},
							title: {
								type: 'string',
								description: 'The new title for the todo(s). Optional - only include if you want to change the title. When batch editing, this title will be applied to all specified todos.'
							},
							completed: {
								type: 'boolean',
								description: 'The new completion status for the todo(s). Optional - only include if you want to change the completion status. Use true to mark as complete, false to mark as incomplete. When batch editing, this status will be applied to all specified todos.'
							}
						},
						required: ['id']
					}
				}
			]
		});

		return tools;
	}

	async executeTool(
		toolName: string,
		args: Record<string, any>,
		context: ToolExecutionContext
	): Promise<ToolResult> {
		switch (toolName) {
			case 'queryTodos': {
				const result = await handleQueryTodos(args, context);
				return result;
			}
			case 'createTodo': {
				const result = await handleCreateTodo(args, context);
				return result;
			}
			case 'editTodo': {
				const result = await handleEditTodo(args, context);
				return result;
			}

			default:
				return {
					success: false,
					result: { error: `Unknown tool: ${toolName}` },
					error: `Unknown tool: ${toolName}`
				};
		}
	}
}

