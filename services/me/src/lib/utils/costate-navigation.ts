/**
 * Svelte-specific CoState Navigation Utilities
 * 
 * Uses CoState API for reactive loading instead of snapshot-based approach.
 * These utilities work with CoState instances and provide automatic reactivity.
 */

import type { CoID, RawCoValue } from 'cojson'
import { CoMap, CoList } from 'jazz-tools'
import { CoState } from 'jazz-tools/svelte'
import type { CoValueContext, ResolvedCoValueResult } from '@maia/db'

/**
 * Create a CoState for a CoValue (reactive)
 * Returns the CoState instance - components should derive resolved info reactively
 * 
 * @param coValueId - The ID of the CoValue to load
 * @param resolveQuery - Optional resolve query for deep loading (defaults to shallow)
 */
export function createCoValueState(
	coValueId: CoID<RawCoValue>,
	resolveQuery?: any,
): CoState<typeof CoMap> {
	return new CoState(CoMap, coValueId, resolveQuery ? { resolve: resolveQuery } : undefined)
}

/**
 * Derive ResolvedCoValueResult from a CoState (reactive)
 * Use this in Svelte components with $derived to get reactive resolved info
 */
export function deriveResolvedFromCoState(
	coValueState: CoState<typeof CoMap>,
	coValueId: CoID<RawCoValue>,
): ResolvedCoValueResult {
	const coValue = coValueState.current

	if (!coValue.$isLoaded) {
		const loadingState = coValue.$jazz.loadingState
		if (loadingState === 'unavailable') {
			return {
				value: undefined,
				snapshot: 'unavailable',
				type: null,
				extendedType: undefined,
				id: coValueId,
				groupId: undefined,
				headerMeta: undefined,
			}
		} else {
			return {
				value: undefined,
				snapshot: undefined,
				type: undefined,
				extendedType: undefined,
				id: coValueId,
				groupId: undefined,
				headerMeta: undefined,
			}
		}
	}

	// CoValue is loaded - extract information
	const rawValue = coValue.$jazz.raw
	const type = rawValue.type as 'comap' | 'costream' | 'colist' | 'coplaintext'
	
	// Get snapshot (convert CoValue to JSON)
	const snapshot = rawValue.toJSON() as Record<string, any>

	// Determine extended type
	let extendedType: 'image' | 'record' | 'account' | 'group' | 'file' | 'CoPlainText' | 'CoRichText' | 'CoFeed' | undefined

	if (type === 'comap') {
		if (isBrowserImage(snapshot)) {
			extendedType = 'image'
		} else if (rawValue.headerMeta?.type === 'account') {
			extendedType = 'account'
		} else if (rawValue.core.isGroup()) {
			extendedType = 'group'
		}
	} else if (type === 'costream') {
		const coStream = detectCoStreamType(rawValue as any)
		if (coStream.type === 'binary') {
			extendedType = 'file'
		} else if (coStream.type === 'text') {
			if (typeof snapshot === 'string') {
				extendedType = 'CoPlainText'
			} else {
				extendedType = 'CoRichText'
			}
		}
	} else if (type === 'coplaintext') {
		extendedType = 'CoPlainText'
	} else if (type === 'colist') {
		if (snapshot && (snapshot.perAccount || snapshot.perSession || snapshot.byMe)) {
			extendedType = 'CoFeed'
		}
	}

	// Get group ID
	let groupId: CoID<RawCoValue> | undefined
	try {
		groupId = rawValue.group?.id
	} catch (_e) {
		// Ignore if group is not accessible
	}

	return {
		value: rawValue,
		snapshot,
		type,
		extendedType,
		id: coValueId,
		groupId,
		headerMeta: rawValue.headerMeta,
	}
}

/**
 * Derive CoValueContext from a CoState (reactive)
 * Use this in Svelte components with $derived to get reactive context
 */
export function deriveContextFromCoState(
	coValueState: CoState<typeof CoMap>,
	coValueId: CoID<RawCoValue>,
): CoValueContext {
	const coValue = coValueState.current
	const resolved = deriveResolvedFromCoState(coValueState, coValueId)

	const directChildren: Array<{
		key: string
		coValueId: CoID<RawCoValue>
		resolved?: ResolvedCoValueResult
	}> = []

	// Extract children from snapshot (for metadata only)
	// The snapshot is reactive because rawValue comes from coValueState.current
	if (resolved.snapshot && typeof resolved.snapshot === 'object' && resolved.snapshot !== 'unavailable') {
		for (const [key, value] of Object.entries(resolved.snapshot)) {
			if (key.startsWith('$')) continue;

			if (typeof value === 'string' && value.startsWith('co_')) {
				directChildren.push({
					key,
					coValueId: value as CoID<RawCoValue>,
				});
			} else if (Array.isArray(value) && value.length > 0) {
				const allCoIDs = value.every((item) => typeof item === 'string' && item.startsWith('co_'));
				if (allCoIDs) {
					value.forEach((coId, index) => {
						if (typeof coId === 'string' && coId.startsWith('co_')) {
							directChildren.push({
								key: `${key}[${index}]`,
								coValueId: coId as CoID<RawCoValue>,
							});
						}
					});
				}
			}
		}
	}

	return {
		coValueId,
		resolved,
		directChildren,
	}
}

// Helper functions (copied from resolve-covalue.ts for type detection)

type ResolvedImageDefinition = {
	originalSize: [number, number]
	placeholderDataURL?: string
	[res: `${number}x${number}`]: string
}

function isBrowserImage(coValue: Record<string, any>): coValue is ResolvedImageDefinition {
	return 'originalSize' in coValue && 'placeholderDataURL' in coValue
}

function detectCoStreamType(value: any): { type: 'binary' | 'text' | 'unknown' } {
	const firstKey = Object.keys(value.items)[0]
	if (!firstKey) {
		return { type: 'unknown' }
	}

	const items = (value.items as any)[firstKey]?.map((v: any) => v.value)

	if (!items || items.length === 0) {
		return { type: 'unknown' }
	}

	const firstItem = items[0]
	if (
		typeof firstItem === 'object' &&
		firstItem !== null &&
		'type' in firstItem &&
		firstItem.type === 'start'
	) {
		return { type: 'binary' }
	}

	return { type: 'text' }
}

