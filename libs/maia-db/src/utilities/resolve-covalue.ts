/**
 * Generic CoValue Resolver - Framework-agnostic utility
 *
 * Similar to Jazz inspector's resolveCoValue, but framework-agnostic.
 * Can be used in any context (React, Svelte, vanilla JS, etc.)
 */

import type { CoID, LocalNode, RawBinaryCoStream, RawCoStream, RawCoValue } from 'cojson'

export type CoJsonType = 'comap' | 'costream' | 'colist' | 'coplaintext'
export type ExtendedCoJsonType =
	| 'image'
	| 'record'
	| 'account'
	| 'group'
	| 'file'
	| 'CoPlainText'
	| 'CoRichText'
	| 'CoFeed'

type JSON = string | number | boolean | null | JSON[] | { [key: string]: JSON }
type JSONObject = { [key: string]: JSON }

type ResolvedImageDefinition = {
	originalSize: [number, number]
	placeholderDataURL?: string
	[res: `${number}x${number}`]: RawBinaryCoStream['id']
}

// Type guard for browser image
export const isBrowserImage = (coValue: JSONObject): coValue is ResolvedImageDefinition => {
	return 'originalSize' in coValue && 'placeholderDataURL' in coValue
}

export type ResolvedGroup = {
	readKey: string
	[key: string]: JSON
}

export const isGroup = (coValue: JSONObject): coValue is ResolvedGroup => {
	return 'readKey' in coValue
}

export type ResolvedAccount = {
	profile: {
		name: string
	}
	[key: string]: JSON
}

// Detect CoStream type (binary vs text)
function detectCoStreamType(value: RawCoStream | RawBinaryCoStream): {
	type: 'binary' | 'text' | 'unknown'
} {
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

export type ResolvedCoValueResult =
	| {
			value: RawCoValue
			snapshot: JSONObject
			type: CoJsonType | null
			extendedType: ExtendedCoJsonType | undefined
			id: CoID<RawCoValue>
			groupId: CoID<RawCoValue> | undefined
			headerMeta: any
	  }
	| {
			value: undefined
			snapshot: 'unavailable'
			type: null
			extendedType: undefined
			id: CoID<RawCoValue>
			groupId: undefined
			headerMeta: undefined
	  }
	| {
			value: undefined
			snapshot: undefined
			type: undefined
			extendedType: undefined
			id: CoID<RawCoValue> | undefined
			groupId: undefined
			headerMeta: undefined
	  }

/**
 * Resolve a CoValue by ID (matches inspector's resolveCoValue)
 * Returns full metadata including type, extendedType, id, groupId, headerMeta
 */
export async function resolveCoValue(
	coValueId: CoID<RawCoValue>,
	node: LocalNode,
): Promise<ResolvedCoValueResult> {
	const value = await node.load(coValueId)

	if (value === 'unavailable') {
		return {
			value: undefined,
			snapshot: 'unavailable',
			type: null,
			extendedType: undefined,
			id: coValueId,
			groupId: undefined,
			headerMeta: undefined,
		}
	}

	const snapshot = value.toJSON() as JSONObject
	const type = value.type as CoJsonType

	// Determine extended type
	let extendedType: ExtendedCoJsonType | undefined

	if (type === 'comap') {
		if (isBrowserImage(snapshot)) {
			extendedType = 'image'
		} else if (value.headerMeta?.type === 'account') {
			extendedType = 'account'
		} else if (value.core.isGroup()) {
			extendedType = 'group'
		}
	} else if (type === 'costream') {
		// In our app, ALL costreams are CoFeeds (actor inboxes)
		// No need for complex detection - just mark as CoFeed
		extendedType = 'CoFeed'
	} else if (type === 'coplaintext') {
		extendedType = 'CoPlainText'
	} else if (type === 'colist') {
		// Check if it's a CoFeed (has perAccount, perSession, byMe)
		if (snapshot && (snapshot.perAccount || snapshot.perSession || snapshot.byMe)) {
			extendedType = 'CoFeed'
		}
	}

	// Get group ID
	let groupId: CoID<RawCoValue> | undefined
	try {
		groupId = value.group?.id
	} catch (_e) {
		// Ignore if group is not accessible
	}

	return {
		value,
		snapshot,
		type,
		extendedType,
		id: coValueId,
		groupId,
		headerMeta: value.headerMeta,
	}
}

/**
 * Resolve multiple CoValues by ID
 */
export async function resolveCoValues(
	coValueIds: CoID<RawCoValue>[],
	node: LocalNode,
): Promise<ResolvedCoValueResult[]> {
	return Promise.all(coValueIds.map((id) => resolveCoValue(id, node)))
}
