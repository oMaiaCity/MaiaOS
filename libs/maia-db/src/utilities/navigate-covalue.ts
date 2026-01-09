/**
 * CoValue Navigation Types and Utilities
 *
 * Defines the CoValueContext interface used by CoState-based navigation.
 * For Svelte apps, use CoState-based navigation utilities from services/me/src/lib/utils/costate-navigation.ts
 */

import type { CoID, RawCoValue } from 'cojson'
import type { ResolvedCoValueResult } from './resolve-covalue.js'

/**
 * CoValueContext interface - used by both snapshot-based and CoState-based navigation
 */
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
 * Check if a value is a CoID
 */
export function isCoID(value: any): value is CoID<RawCoValue> {
	return typeof value === 'string' && value.startsWith('co_')
}
