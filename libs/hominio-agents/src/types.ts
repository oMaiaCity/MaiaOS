/**
 * TypeScript types for agent system
 */

export interface AgentConfig {
	id: string;
	name: string;
	role: string;
	description: string;
	dataContext?: DataContextItem[];
	skills: Skill[];
}

export interface DataContextItem {
	// ID for identifying specific data context items (e.g., "menu")
	id?: string;
	// Simple string instruction
	content?: string;
	// Structured context with title
	title?: string;
	// JSON data (will be stringified)
	data?: any;
	// Description for data context
	description?: string;
}

export interface Skill {
	id: string;
	name: string;
	description: string;
	functionId: string;
	parameters?: Record<string, ParameterDefinition>;
}

export interface ParameterDefinition {
	type: 'string' | 'number' | 'boolean' | 'array' | 'object';
	description: string;
	optional?: boolean;
	enum?: string[];
	default?: any;
}

export interface FunctionHandler {
	handler: (args: any, context: FunctionContext) => Promise<FunctionResult>;
	uiComponent: () => Promise<any>;
	schema: Record<string, any>;
}

export interface FunctionContext {
	dataContext: string; // Formatted string context for LLM prompt
	rawDataContext?: DataContextItem[]; // Raw data context from agent config (for extracting structured data)
	userId?: string;
	agentId: string;
}

export interface FunctionResult {
	success: boolean;
	data?: any;
	error?: string;
}

