/**
 * Query Vibe Context Tool Handler
 * Loads vibe context and injects it via callback
 */

import { loadVibeConfig } from '@hominio/vibes';
import { buildVibeContextString } from '@hominio/vibes';

export interface QueryVibeContextResult {
	success: boolean;
	vibeId: string;
	contextString?: string; // Returned for logging purposes, but context is injected via injectFn
	error?: string;
}

export async function handleQueryVibeContext(
	vibeId: string,
	vibeConfigs: Record<string, any>,
	activeVibeIds: string[],
	injectFn?: (content: { turns: string; turnComplete: boolean }) => void | Promise<void>
): Promise<QueryVibeContextResult> {
	try {
		// Add to active vibes if not already present
		if (!activeVibeIds.includes(vibeId)) {
			activeVibeIds.push(vibeId);
		}

		// Load vibe config if not already loaded
		if (!vibeConfigs[vibeId]) {
			vibeConfigs[vibeId] = await loadVibeConfig(vibeId);
		}

		// Build vibe context string
		const contextString = await buildVibeContextString(vibeId);

		// Inject context via callback
		// Use turnComplete: false to keep conversation loop open without triggering AI response
		if (injectFn && contextString) {
			await injectFn({
				turns: contextString,
				turnComplete: false
			});
		}

		return {
			success: true,
			vibeId,
			contextString // Return for logging
		};
	} catch (err) {
		console.error(`[hominio-voice] Failed to load vibe context for ${vibeId}:`, err);
		return {
			success: false,
			vibeId,
			error: `Failed to load vibe context: ${vibeId}`
		};
	}
}

