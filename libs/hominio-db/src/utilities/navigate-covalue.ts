/**
 * Generic CoValue Navigation Utility
 *
 * Framework-agnostic utility for navigating between CoValue contexts.
 * Always loads only the current CoValue's snapshot and its direct children (CoIDs),
 * without deep nested loading.
 */

import type { CoID, LocalNode, RawCoValue } from 'cojson'
import { type ResolvedCoValueResult, resolveCoValue } from './resolve-covalue.js'

export interface CoValueContext {
	coValueId: CoID<RawCoValue>
	resolved: ResolvedCoValueResult
	directChildren: Array<{
		key: string
		coValueId: CoID<RawCoValue>
		resolved?: ResolvedCoValueResult
	}>
}

/**
 * Navigate to a CoValue context
 * Loads the CoValue and resolves its direct children (CoIDs in snapshot)
 * but does NOT load nested CoValues deeply
 * 
 * NOTE: For Svelte apps, prefer using CoState-based navigation for reactive updates.
 * This function uses snapshot-based loading for framework-agnostic compatibility.
 */
export async function navigateToCoValueContext(
	coValueId: CoID<RawCoValue>,
	node: LocalNode,
): Promise<CoValueContext> {
	// Resolve the main CoValue
	const resolved = await resolveCoValue(coValueId, node)

	if (!resolved.snapshot || resolved.snapshot === 'unavailable') {
		return {
			coValueId,
			resolved,
			directChildren: [],
		}
	}

	// Extract direct children (CoIDs) from snapshot
	const directChildren: Array<{
		key: string
		coValueId: CoID<RawCoValue>
		resolved?: ResolvedCoValueResult
	}> = []

	// Iterate through snapshot entries to find CoIDs
	for (const [key, value] of Object.entries(resolved.snapshot)) {
		// Skip internal properties
		if (key.startsWith('$')) continue

		// Check if value is a CoID (string starting with "co_")
		if (typeof value === 'string' && value.startsWith('co_')) {
			directChildren.push({
				key,
				coValueId: value as CoID<RawCoValue>,
			})
		}
		// Check if value is an array of CoIDs
		else if (Array.isArray(value) && value.length > 0) {
			// Check if all items are CoIDs
			const allCoIDs = value.every((item) => typeof item === 'string' && item.startsWith('co_'))
			if (allCoIDs) {
				// Add each CoID as a child
				value.forEach((coId, index) => {
					if (typeof coId === 'string' && coId.startsWith('co_')) {
						directChildren.push({
							key: `${key}[${index}]`,
							coValueId: coId as CoID<RawCoValue>,
						})
					}
				})
			}
		}
	}

	// Don't resolve children eagerly - lazy loading for performance
	// Children will be resolved when explicitly accessed in the UI

	return {
		coValueId,
		resolved,
		directChildren,
	}
}

/**
 * Check if a value is a CoID
 */
export function isCoID(value: any): value is CoID<RawCoValue> {
	return typeof value === 'string' && value.startsWith('co_')
}
