/**
 * Tool Registry
 * Centralized registry for all voice tools
 */

import { listVibes, loadVibeConfig } from '@hominio/vibes';
import { buildActionSkillArgsSchema } from '@hominio/vibes';
import { handleQueryVibeContext } from './query-vibe-context.js';
import { handleActionSkill } from './action-skill.js';
import type { ContextIngestService } from '../context-injection.js';

export interface ToolExecutionContext {
	vibeConfigs: Record<string, any>;
	activeVibeIds: string[];
	session: any; // Google Live API session
	contextIngest: ContextIngestService;
	onLog?: (message: string, context?: string) => void;
}

export interface ToolResult {
	success: boolean;
	result: any;
	contextString?: string;
	error?: string;
}

export class ToolRegistry {
	private vibeConfigs: Record<string, any> = {};
	private activeVibeIds: string[] = [];
	private allSkills: any[] = [];
	private skillToVibeMap: Record<string, string> = {};

	async initialize() {
		// Load all vibe configs
		const vibeIds = await listVibes();
		for (const vibeId of vibeIds) {
			try {
				const vibeConfig = await loadVibeConfig(vibeId);
				this.vibeConfigs[vibeId] = vibeConfig;
				if (vibeConfig.skills) {
					this.allSkills.push(...vibeConfig.skills);
					for (const skill of vibeConfig.skills) {
						this.skillToVibeMap[skill.id] = vibeId;
					}
				}
			} catch (err) {
				console.warn(`[ToolRegistry] Failed to load vibe config for ${vibeId}:`, err);
			}
		}
	}

	getVibeConfigs(): Record<string, any> {
		return this.vibeConfigs;
	}

	getActiveVibeIds(): string[] {
		return this.activeVibeIds;
	}

	setActiveVibeIds(vibeIds: string[]) {
		this.activeVibeIds = vibeIds;
	}

	async buildToolSchemas() {
		const tools: any[] = [];

		// queryVibeContext - static schema
		const availableVibes = Object.keys(this.vibeConfigs);
		tools.push({
			functionDeclarations: [
				{
					name: 'queryVibeContext',
					description: 'Load additional context and tools from a vibe. Use this when you need specific capabilities (e.g., calendar operations → \'karl\', menu/wellness → \'charles\'). You can query multiple vibes simultaneously. Automatically call this when user requests functionality that requires a specific vibe.\n\nCRITICAL: After calling this tool, DO NOT respond to the user. DO NOT say you switched vibes, loaded context, or are seeing the menu. STAY COMPLETELY SILENT. Continue with the next tool call (e.g., actionSkill) without any verbal acknowledgment. The user should not hear any response from you after queryVibeContext - only after the final action tool completes.',
					parameters: {
						type: 'object',
						properties: {
							vibeId: {
								type: 'string',
								description: 'The vibe ID to query (e.g., \'charles\', \'karl\')',
								enum: availableVibes.length > 0 ? availableVibes : ['charles', 'karl']
							}
						},
						required: ['vibeId']
					}
				}
			]
		});

		// actionSkill - dynamic schema
		try {
			if (this.allSkills.length > 0) {
				const actionSkillArgsSchema = buildActionSkillArgsSchema(this.allSkills, this.skillToVibeMap);
				tools.push({
					functionDeclarations: [
						{
							name: 'actionSkill',
							description: 'Execute a skill/action for a vibe. REQUIRED: You MUST use this tool - verbal responses alone are not sufficient.\n\nFor charles vibe:\n1. show-menu: When user asks about menu, food, restaurant, Speisekarte → use skillId: "show-menu"\n2. show-wellness: When user asks about wellness, spa, massages, treatments, wellness program, Wellness-Programm → use skillId: "show-wellness"\n\nFor karl vibe:\n- view-calendar, create-calendar-entry, edit-calendar-entry, delete-calendar-entry\n\nParameters are top-level (no args object).',
							parameters: actionSkillArgsSchema
						}
					]
				});
			}
		} catch (err) {
			console.warn(`[ToolRegistry] Failed to build actionSkill schema:`, err);
		}

		return tools;
	}

	async executeTool(
		toolName: string,
		args: Record<string, any>,
		context: ToolExecutionContext
	): Promise<ToolResult> {
		switch (toolName) {
			case 'queryVibeContext': {
				const vibeId = args?.vibeId || 'unknown';
				// No content ingestion - only tool response will be sent
				const result = await handleQueryVibeContext(
					vibeId,
					context.vibeConfigs,
					context.activeVibeIds,
					undefined // No injectFn - removed content ingestion
				);

				return {
					success: result.success,
					result: result.success
						? {
								success: true,
								message: `Context loaded. DO NOT respond to user. Continue silently with next tool call.`,
								vibeId,
								_silent: true // Internal flag for logging
							}
						: {
								success: false,
								error: result.error || `Failed to load vibe context: ${vibeId}`
							},
					contextString: result.contextString, // For logging
					error: result.error
				};
			}

			case 'actionSkill': {
				const { vibeId, skillId } = args || {};
				const result = await handleActionSkill(vibeId, skillId, args);

				// Action skills are handled by frontend UI - no content ingestion
				// Only tool response will be sent (via ingestToolResponse in session.ts)
				return {
					success: true,
					result: {
						success: true,
						message: result.message,
						vibeId,
						skillId
					}
				};
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

