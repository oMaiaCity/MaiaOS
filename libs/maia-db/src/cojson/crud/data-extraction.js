/**
 * Data Extraction Functions
 *
 * Provides extractCoValueData - single canonical extraction, always outputs flat format for CoMaps.
 */

import { ensureCoValueLoaded } from './collection-helpers.js'

/**
 * Extract CoValue data from CoValueCore as flat object.
 * One format everywhere: flat {key: value} for CoMaps, no properties array.
 * @param {Object} peer - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @param {string} [schemaHint] - Schema hint for special types (@group, @account, @metaSchema)
 * @returns {Object} Flat CoValue data (id, $schema, type, and key-value for CoMaps)
 */
export function extractCoValueData(peer, coValueCore, schemaHint = null) {
	const header = peer.getHeader(coValueCore)
	const headerMeta = header?.meta || null
	const _ruleset = coValueCore.ruleset || header?.ruleset

	const isAccount =
		schemaHint === '@account' ||
		(headerMeta && headerMeta.type === 'account') ||
		(peer.account && peer.account.id === coValueCore.id)

	if (isAccount && peer.account && peer.account.id === coValueCore.id) {
		const schema = headerMeta?.$schema || null
		const result = {
			id: peer.account.id,
			type: 'comap',
			$schema: schema,
		}
		try {
			const keys =
				peer.account.keys && typeof peer.account.keys === 'function'
					? peer.account.keys()
					: Object.keys(peer.account)
			for (const key of keys) {
				try {
					result[key] = peer.account.get(key)
				} catch (_e) {}
			}
		} catch (_e) {}
		return result
	}

	const content = peer.getCurrentContent(coValueCore)
	if (!content) {
		if (isAccount && peer.account && peer.account.id === coValueCore.id) {
			const schema = headerMeta?.$schema || null
			const result = { id: peer.account.id, type: 'comap', $schema: schema }
			try {
				const keys =
					peer.account.keys && typeof peer.account.keys === 'function'
						? peer.account.keys()
						: Object.keys(peer.account)
				for (const key of keys) {
					result[key] = peer.account.get(key)
				}
			} catch (_e) {}
			return result
		}
		const schema = headerMeta?.$schema || null
		return { id: coValueCore.id, type: 'unknown', $schema: schema }
	}

	const rawType = content?.type || 'unknown'
	let schema = headerMeta?.$schema || null

	if (schemaHint === '@group' || (_ruleset && _ruleset.type === 'group')) {
		schema = '@group'
	} else if (schemaHint === '@account' || (headerMeta && headerMeta.type === 'account')) {
		schema = '@account'
	} else if (schemaHint === '@metaSchema' || schema === '@metaSchema') {
		schema = '@metaSchema'
	}

	if (rawType === 'colist' && content && content.toJSON) {
		try {
			const items = content.toJSON()
			const result = {
				id: coValueCore.id,
				cotype: 'colist',
				type: 'colist',
				$schema: schema,
				items,
			}
			try {
				if (typeof peer.getGroupInfo === 'function') {
					const groupInfo = peer.getGroupInfo(coValueCore)
					if (groupInfo) result.groupInfo = groupInfo
				}
			} catch (_e) {}
			return result
		} catch (_e) {
			const result = {
				id: coValueCore.id,
				cotype: 'colist',
				type: 'colist',
				$schema: schema,
				items: [],
			}
			try {
				if (typeof peer.getGroupInfo === 'function') {
					const groupInfo = peer.getGroupInfo(coValueCore)
					if (groupInfo) result.groupInfo = groupInfo
				}
			} catch (_e) {}
			return result
		}
	}

	if (rawType === 'costream' && content) {
		try {
			const streamData = content.toJSON()
			const items = []
			if (streamData && typeof streamData === 'object' && !(streamData instanceof Uint8Array)) {
				for (const sessionKey in streamData) {
					if (Array.isArray(streamData[sessionKey])) {
						items.push(...streamData[sessionKey])
					}
				}
			}
			const result = {
				id: coValueCore.id,
				cotype: 'costream',
				type: 'costream',
				$schema: schema,
				items,
			}
			try {
				if (typeof peer.getGroupInfo === 'function') {
					const groupInfo = peer.getGroupInfo(coValueCore)
					if (groupInfo) result.groupInfo = groupInfo
				}
			} catch (_e) {}
			return result
		} catch (_e) {
			const result = {
				id: coValueCore.id,
				cotype: 'costream',
				type: 'costream',
				$schema: schema,
				items: [],
			}
			try {
				if (typeof peer.getGroupInfo === 'function') {
					const groupInfo = peer.getGroupInfo(coValueCore)
					if (groupInfo) result.groupInfo = groupInfo
				}
			} catch (_e) {}
			return result
		}
	}

	if (content?.get && typeof content.get === 'function') {
		const cotype = content.get('cotype') || rawType
		const result = {
			id: coValueCore.id,
			cotype: cotype === 'comap' ? 'comap' : cotype,
			type: rawType,
			$schema: schema,
		}
		const keys =
			content.keys && typeof content.keys === 'function' ? content.keys() : Object.keys(content)

		const skipJsonParsingFields = ['error', 'message', 'content', 'addAgentError']
		for (const key of keys) {
			let value = content.get(key)
			if (
				typeof value === 'string' &&
				(value.startsWith('{') || value.startsWith('[')) &&
				!skipJsonParsingFields.includes(key)
			) {
				try {
					const parsed = JSON.parse(value)
					value = parseNestedJsonStrings(parsed)
				} catch (_e) {}
			} else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				value = parseNestedJsonStrings(value)
			}
			result[key] = value
		}
		try {
			if (typeof peer.getGroupInfo === 'function') {
				const groupInfo = peer.getGroupInfo(coValueCore)
				if (groupInfo) result.groupInfo = groupInfo
			}
		} catch (_e) {}
		return result
	}

	const fallbackResult = { id: coValueCore.id, type: rawType, $schema: schema }
	try {
		if (typeof peer.getGroupInfo === 'function') {
			const groupInfo = peer.getGroupInfo(coValueCore)
			if (groupInfo) fallbackResult.groupInfo = groupInfo
		}
	} catch (_e) {}
	return fallbackResult
}

/**
 * Recursively parse JSON strings within an object/array
 * Handles cases where nested objects are stored as JSON strings in CoJSON
 * @param {any} data - Data to parse (object, array, or primitive)
 * @returns {any} Data with JSON strings parsed recursively
 */
function parseNestedJsonStrings(data) {
	if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
		try {
			const parsed = JSON.parse(data)
			// Recursively parse nested JSON strings
			return parseNestedJsonStrings(parsed)
		} catch (_e) {
			return data // Keep as string if not valid JSON
		}
	} else if (Array.isArray(data)) {
		return data.map((item) => parseNestedJsonStrings(item))
	} else if (typeof data === 'object' && data !== null) {
		const result = {}
		for (const [key, val] of Object.entries(data)) {
			// CRITICAL: Recursively parse each value - this handles cases where
			// nested properties like 'options' are stored as JSON strings
			result[key] = parseNestedJsonStrings(val)
		}
		return result
	}
	return data // Primitives (numbers, booleans, null) pass through
}

/**
 * Shallow resolve a single co-id: load CoValue and return raw data (nested co-ids stay as strings).
 * Used for map-driven on-demand resolution - only loads this CoValue, no recursive resolution.
 * Content-addressable: lookup by co-id via peer.
 * @param {Object} peer - Backend instance
 * @param {string} coId - Co-id to resolve
 * @param {Object} options - Options { timeoutMs }
 * @param {Set<string>} visited - Set of already visited co-ids (prevents circular references)
 * @returns {Promise<Object>} Raw CoValue data with nested co-ids as strings, or { id: coId } on error/circular
 */
export async function resolveCoIdShallow(peer, coId, options = {}, visited = new Set()) {
	const { timeoutMs = 2000 } = options
	if (visited.has(coId)) return { id: coId }
	visited.add(coId)
	try {
		await ensureCoValueLoaded(peer, coId, { waitForAvailable: true, timeoutMs })
		const coValueCore = peer.getCoValue(coId)
		if (!coValueCore || !peer.isAvailable(coValueCore)) return { id: coId }
		let data = extractCoValueData(peer, coValueCore)
		data = { ...data, id: data.id || coId }
		const header = peer.getHeader(coValueCore)
		const ruleset = coValueCore.ruleset || header?.ruleset
		if (ruleset && ruleset.type === 'group') {
			const groupContent = peer.getCurrentContent(coValueCore)
			if (groupContent && typeof groupContent.addMember === 'function') {
				const { getGroupInfoFromGroup } = await import('../groups/groups.js')
				const groupInfo = getGroupInfoFromGroup(groupContent)
				if (groupInfo) {
					Object.assign(data, {
						accountMembers: groupInfo.accountMembers || [],
						groupMembers: groupInfo.groupMembers || [],
						id: groupInfo.groupId || data.id,
					})
				}
			}
		}
		return data
	} catch (_err) {
		return { id: coId }
	}
}

/**
 * Resolve CoValue references in data object
 * Replaces co-id strings with resolved CoValue objects based on configuration
 * @param {Object} peer - Backend instance
 * @param {any} data - Data object to process (may contain co-id references)
 * @param {Object} options - Resolution options
 * @param {string[]} [options.fields] - Specific field names to resolve (e.g., ['source', 'target']). If not provided, resolves all co-id references
 * @param {string[]} [options.schemas] - Specific schema co-ids to resolve. If not provided, resolves all CoValues
 * @param {Set<string>} visited - Set of already visited co-ids (prevents circular references)
 * @param {number} maxDepth - Maximum recursion depth
 * @param {number} currentDepth - Current recursion depth
 * @returns {Promise<any>} Data object with CoValue references resolved
 */
export async function resolveCoValueReferences(
	peer,
	data,
	options = {},
	visited = new Set(),
	maxDepth = 15,
	currentDepth = 0,
) {
	// TODO: temporarily 15
	const { fields = null, timeoutMs = 2000 } = options

	if (currentDepth > maxDepth) {
		return data // Prevent infinite recursion
	}

	// Handle null/undefined
	if (data === null || data === undefined) {
		return data
	}

	// Handle primitives (strings, numbers, booleans)
	if (typeof data !== 'object') {
		// Check if it's a co-id string that should be resolved
		if (typeof data === 'string' && data.startsWith('co_z')) {
			// CRITICAL: Pass maxDepth and currentDepth to ensure recursive resolution works
			const resolved = await resolveCoId(peer, data, options, visited, maxDepth, currentDepth)
			// resolveCoId always returns an object now, so return it directly
			return resolved
		}
		return data
	}

	// Handle arrays - process each item
	if (Array.isArray(data)) {
		return Promise.all(
			data.map((item) =>
				resolveCoValueReferences(peer, item, options, visited, maxDepth, currentDepth + 1),
			),
		)
	}

	// Handle objects
	const result = {}
	for (const [key, value] of Object.entries(data)) {
		// Always preserve internal properties (don't skip them - they're part of the data)
		// CRITICAL: Preserve ALL properties, including id, $schema, type, etc.
		// Skip resolution for internal properties (they're not co-ids to resolve)
		if (key === 'id' || key === '$schema' || key === 'type' || key === 'loading' || key === 'error') {
			result[key] = value
			continue
		}

		// Check if this field should be resolved
		const shouldResolve = fields === null || fields.includes(key)

		// Handle null/undefined - keep as-is (don't try to resolve)
		if (value === null || value === undefined) {
			result[key] = value
			continue
		}

		if (shouldResolve && typeof value === 'string' && value.startsWith('co_z')) {
			// Resolve this co-id reference (with depth tracking for recursion)
			const resolved = await resolveCoId(
				peer,
				value,
				{ ...options, timeoutMs, maxDepth, currentDepth },
				visited,
				maxDepth,
				currentDepth + 1,
			)
			result[key] = resolved
		} else {
			// Recursively process nested values (preserves non-co-id values like strings, numbers, etc.)
			result[key] = await resolveCoValueReferences(
				peer,
				value,
				options,
				visited,
				maxDepth,
				currentDepth + 1,
			)
		}
	}

	// CRITICAL: Ensure we preserve ALL properties from the original data object
	// This is especially important for actor objects where properties like 'role' must be preserved
	return result
}

/**
 * Resolve a single co-id to its CoValue data using the universal resolver
 * Uses the same read() API as all other co-id resolution in the codebase
 * @param {Object} peer - Backend instance
 * @param {string} coId - Co-id to resolve
 * @param {Object} options - Resolution options
 * @param {string[]} [options.schemas] - Specific schema co-ids to resolve
 * @param {number} [options.timeoutMs=2000] - Timeout for waiting for CoValue to be available
 * @param {Set<string>} visited - Set of already visited co-ids
 * @returns {Promise<any>} Resolved CoValue data or original co-id if not resolved
 */
async function resolveCoId(
	peer,
	coId,
	options = {},
	visited = new Set(),
	maxDepth = 15,
	currentDepth = 0,
) {
	// TODO: temporarily 15
	const { schemas = null, timeoutMs = 2000 } = options

	// CRITICAL: Check visited set first to prevent circular references within this resolution pass
	if (visited.has(coId)) {
		return { id: coId } // Already processing this co-id, return object with id to prevent circular reference
	}

	// CRITICAL OPTIMIZATION: Check cache BEFORE calling peer.read() to prevent expensive re-resolution
	// Use the same cache key format as read.js so we can reuse cached resolved data
	const cache = peer.subscriptionCache
	const cacheOptions = {
		deepResolve: false, // We don't need deep resolution here
		resolveReferences: options, // Use the same resolution options
		map: null, // No map transform in resolveCoId
		maxDepth,
		timeoutMs,
	}
	const cachedResolved = cache.getResolvedData(coId, cacheOptions)

	if (cachedResolved) {
		// Return cached result immediately - no need to re-resolve
		// But we still need to check schema filter if provided
		if (schemas !== null && schemas.length > 0) {
			const dataSchema = cachedResolved.$schema
			if (!schemas.includes(dataSchema)) {
				return { id: coId } // Schema not in filter
			}
		}
		return cachedResolved
	}

	try {
		// Use peer.read() directly (same universal API used everywhere)
		// CRITICAL: Do NOT use resolveReferences here to avoid infinite loop
		// (resolveCoId -> peer.read(resolveReferences) -> resolveCoValueReferences -> resolveCoId)
		const { waitForStoreReady } = await import('./read-operations.js')

		// Read the co-value using peer.read() API (reuses its caching)
		// Use deepResolve: false to get raw data, then we'll resolve nested co-ids ourselves
		const coValueStore = await peer.read(null, coId, null, null, {
			deepResolve: false, // Don't deep resolve here - we'll resolve nested refs ourselves
			timeoutMs,
		})

		if (!coValueStore) {
			return { id: coId }
		}

		// Wait for store to be ready
		try {
			await waitForStoreReady(coValueStore, coId, timeoutMs)
		} catch (_err) {
			return { id: coId }
		}

		const coValueData = coValueStore.value

		// Validate data before processing
		if (!coValueData) {
			return { id: coId }
		}

		// Handle error objects
		if (coValueData.error) {
			return { id: coId, error: coValueData.error }
		}

		// Ensure data is an object
		if (typeof coValueData !== 'object' || Array.isArray(coValueData)) {
			return { id: coId }
		}

		// Check if we should resolve based on schema filter
		if (schemas !== null && schemas.length > 0) {
			const dataSchema = coValueData.$schema
			if (!schemas.includes(dataSchema)) {
				return { id: coId } // Schema not in filter - return object with id
			}
		}

		// Mark as visited to prevent circular references
		visited.add(coId)

		// Resolve nested co-id references recursively
		const resolved = await resolveCoValueReferences(
			peer,
			coValueData,
			options,
			visited,
			maxDepth,
			currentDepth + 1,
		)

		// CRITICAL: If this is a group, automatically include members
		// Check if this is a group by checking the CoValueCore ruleset
		const coValueCore = peer.getCoValue(coId)
		if (coValueCore) {
			const header = peer.getHeader(coValueCore)
			const ruleset = coValueCore.ruleset || header?.ruleset

			if (ruleset && ruleset.type === 'group') {
				// This is a group - automatically extract and include members
				const groupContent = peer.getCurrentContent(coValueCore)
				if (groupContent && typeof groupContent.addMember === 'function') {
					// Import groups helper dynamically to avoid circular dependencies
					const { getGroupInfoFromGroup } = await import('../groups/groups.js')
					const groupInfo = getGroupInfoFromGroup(groupContent)

					if (groupInfo) {
						// Merge group info (members) into resolved data
						Object.assign(resolved, {
							accountMembers: groupInfo.accountMembers || [],
							groupMembers: groupInfo.groupMembers || [],
						})
					}
				}
			}
		}

		// Ensure id is always present
		const finalResolved = {
			...resolved,
			id: resolved.id || coValueData.id || coId,
		}

		// Cache the resolved result for future use (prevents expensive re-resolution)
		cache.setResolvedData(coId, cacheOptions, finalResolved)

		return finalResolved
	} catch (_err) {
		return { id: coId }
	}
}

/**
 * Extract CoStream with session structure preserved and CRDT metadata
 * Backend-to-peer helper for inbox processing
 * @param {Object} peer - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @returns {Object|null} CoStream data with sessions and CRDT metadata, or null if not a CoStream
 */
export function extractCoStreamWithSessions(peer, coValueCore) {
	const content = peer.getCurrentContent(coValueCore)
	const header = peer.getHeader(coValueCore)
	const headerMeta = header?.meta || null
	const rawType = content?.type || 'unknown'

	// Only handle CoStreams
	if (rawType !== 'costream' || !content) {
		return null
	}

	// CoStream content is RawCoStreamView which has items property: { [sessionID]: CoStreamItem[] }
	// Each CoStreamItem has { value, tx, madeAt }
	// If schema specifies items as co-id references ($co), value will be a co-id string
	// Otherwise, value will be the message data (plain object)
	if (content.items && typeof content.items === 'object') {
		const sessions = {}

		// Iterate over each session
		for (const [sessionID, items] of Object.entries(content.items)) {
			if (Array.isArray(items)) {
				// Map items to include message data + CRDT metadata
				// Preserve original item structure to check if value is a co-id reference
				sessions[sessionID] = items.map((item) => {
					// Check if item.value is a co-id reference (starts with co_z)
					const isCoIdReference = typeof item.value === 'string' && item.value.startsWith('co_z')

					if (isCoIdReference) {
						// Item is a co-id reference to a CoMap - return co-id for later reading
						return {
							_coId: item.value, // Message CoMap co-id (native co-id)
							_sessionID: sessionID, // Internal metadata: session ID
							_madeAt: item.madeAt, // Internal metadata: CRDT madeAt timestamp
							_tx: item.tx, // Internal metadata: transaction ID
						}
					} else {
						// Item is plain object (legacy format) - spread message data
						return {
							...item.value, // Message data (type, payload, from, id)
							_sessionID: sessionID, // Internal metadata: session ID
							_madeAt: item.madeAt, // Internal metadata: CRDT madeAt timestamp
							_tx: item.tx, // Internal metadata: transaction ID
						}
					}
				})
			}
		}

		return {
			id: coValueCore.id,
			type: 'costream',
			$schema: headerMeta?.$schema || null,
			sessions: sessions, // Preserve session structure: { sessionID: [messages...] }
		}
	}

	// Fallback: empty stream
	return {
		id: coValueCore.id,
		type: 'costream',
		$schema: headerMeta?.$schema || null,
		sessions: {},
	}
}
