/**
 * TypeScript types for function handlers
 */

export interface FunctionHandler {
	handler: (args: any) => Promise<FunctionResult>;
	uiComponent: () => Promise<any>;
}

export interface FunctionResult {
	success: boolean;
	data?: any;
	error?: string;
}

