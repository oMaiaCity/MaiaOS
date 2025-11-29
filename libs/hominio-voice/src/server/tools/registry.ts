/**
 * Tool Registry
 * Centralized registry for all voice tools
 */

import { handleQueryTodos } from './query-todos.js';
import { handleCreateTodo } from './create-todo.js';

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
					description: 'Query and display all todos from the todo list. Use this when the user asks to see todos, show todos, display todos, view todos, or check todos. This tool requires no parameters.',
					parameters: {
						type: 'object',
						properties: {},
						required: []
					}
				},
				{
					name: 'createTodo',
					description: 'Create a new todo item. Use this when the user asks to create a todo, add a todo, make a todo, or add a task. Requires a title parameter.',
					parameters: {
						type: 'object',
						properties: {
							title: {
								type: 'string',
								description: 'The title of the todo item to create'
							}
						},
						required: ['title']
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

			default:
				return {
					success: false,
					result: { error: `Unknown tool: ${toolName}` },
					error: `Unknown tool: ${toolName}`
				};
		}
	}
}

