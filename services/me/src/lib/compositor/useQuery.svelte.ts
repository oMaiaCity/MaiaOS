/**
 * useQuery Hook - Clean CoState-based reactive query subscription
 * 
 * This follows the data explorer pattern:
 * - Access accountCoState.current inside $derived.by() to establish reactivity
 * - Synchronously filter and convert entities (no async queries)
 * - CoState automatically triggers re-evaluation when entities change
 * - All operations are synchronous for immediate reactivity
 * 
 * Note: This hook is designed to be used in Svelte components with runes ($state, $derived)
 */

// ========== QUERY OPTIONS TYPES ==========

/**
 * Query options for filtering, sorting, and pagination
 */
export interface QueryOptions {
	filter?: FilterOptions
	sort?: SortOptions
	limit?: number
	offset?: number
}

export interface FilterOptions {
	[field: string]: FilterCondition | FilterCondition[]
}

export type FilterCondition =
	| { eq: unknown }
	| { ne: unknown }
	| { gt: unknown }
	| { gte: unknown }
	| { lt: unknown }
	| { lte: unknown }
	| { in: unknown[] }
	| { nin: unknown[] }
	| { contains: string }
	| { startsWith: string }
	| { endsWith: string }
	| { and: FilterCondition[] }
	| { or: FilterCondition[] }

export interface SortOptions {
	field: string
	order?: 'asc' | 'desc'
}

/**
 * Convert CoValue to plain object (generic, works for any schema)
 */
function coValueToPlainObject(coValue: any): Record<string, unknown> {
	// Get ID
	const id = coValue.$jazz?.id || ''
	
	// Build result object with ID first
	const result: Record<string, unknown> = {
		id,
		_coValueId: id,
	}

	// Try to get snapshot first (most reliable method)
	let snapshot: Record<string, unknown> | null = null
	try {
		const jsonSnapshot = coValue.$jazz?.raw?.toJSON?.() || coValue.toJSON?.()
		if (jsonSnapshot && typeof jsonSnapshot === 'object') {
			snapshot = jsonSnapshot as Record<string, unknown>
		}
	} catch (_e) {
		// Snapshot access failed, will try direct access
	}

	// If we have a snapshot, use it (most reliable)
	if (snapshot) {
		for (const key in snapshot) {
			if (
				key !== 'id' &&
				key !== '_coValueId' &&
				!key.startsWith('_') &&
				key !== '$jazz'
			) {
				result[key] = snapshot[key]
			}
		}
	} else {
		// Fallback: Try direct property access
		try {
			// Try direct property access (works for CoMap properties)
			// Get all enumerable properties, excluding internal Jazz properties
			for (const key in coValue) {
				if (
					key !== '$jazz' &&
					key !== 'id' &&
					key !== '_coValueId' &&
					typeof coValue[key] !== 'function' &&
					!key.startsWith('_')
				) {
					const value = coValue[key]
					// Include all values including null, but skip undefined
					if (value !== undefined) {
						result[key] = value
					}
				}
			}
		} catch (_e) {
			// Direct access failed
		}
	}

	return result
}

/**
 * Apply query options (filter, sort, limit, offset) to entities
 */
function applyQueryOptions<T extends Record<string, unknown>>(
	entities: T[],
	options?: QueryOptions,
): T[] {
	let result = entities

	// Apply filters
	if (options?.filter) {
		result = result.filter((entity) => matchesFilter(entity, options.filter!))
	}

	// Apply sorting
	if (options?.sort) {
		const { field, order = 'asc' } = options.sort
		result = result.sort((a, b) => {
			const aVal = a[field]
			const bVal = b[field]
			
			if (aVal === bVal) return 0
			if (aVal == null) return 1
			if (bVal == null) return -1
			
			let comparison = 0
			if (typeof aVal === 'string' && typeof bVal === 'string') {
				comparison = aVal.localeCompare(bVal)
			} else if (typeof aVal === 'number' && typeof bVal === 'number') {
				comparison = aVal - bVal
			} else {
				comparison = String(aVal).localeCompare(String(bVal))
			}
			
			return order === 'asc' ? comparison : -comparison
		})
	}

	// Apply offset
	if (options?.offset) {
		result = result.slice(options.offset)
	}

	// Apply limit
	if (options?.limit) {
		result = result.slice(0, options.limit)
	}

	return result
}

/**
 * Check if entity matches filter conditions
 */
function matchesFilter(
	entity: Record<string, unknown>,
	filter: FilterOptions,
): boolean {
	for (const [field, condition] of Object.entries(filter)) {
		if (Array.isArray(condition)) {
			// Multiple conditions for same field (AND logic)
			if (!condition.every((c) => matchesSingleCondition(entity, field, c))) {
				return false
			}
		} else {
			if (!matchesSingleCondition(entity, field, condition)) {
				return false
			}
		}
	}
	return true
}

/**
 * Check if entity matches a single filter condition
 */
function matchesSingleCondition(
	entity: Record<string, unknown>,
	field: string,
	condition: FilterCondition,
): boolean {
	const value = entity[field]

	if ('eq' in condition) return value === condition.eq
	if ('ne' in condition) return value !== condition.ne
	if ('gt' in condition) return value != null && value > condition.gt
	if ('gte' in condition) return value != null && value >= condition.gte
	if ('lt' in condition) return value != null && value < condition.lt
	if ('lte' in condition) return value != null && value <= condition.lte
	if ('in' in condition) return condition.in.includes(value)
	if ('nin' in condition) return !condition.nin.includes(value)
	
	if ('contains' in condition) {
		return typeof value === 'string' && value.includes(condition.contains)
	}
	if ('startsWith' in condition) {
		return typeof value === 'string' && value.startsWith(condition.startsWith)
	}
	if ('endsWith' in condition) {
		return typeof value === 'string' && value.endsWith(condition.endsWith)
	}
	
	if ('and' in condition) {
		return condition.and.every((c) => matchesSingleCondition(entity, field, c))
	}
	if ('or' in condition) {
		return condition.or.some((c) => matchesSingleCondition(entity, field, c))
	}

	return false
}

// ========== USE QUERY HOOK ==========

/**
 * Reactive query hook using CoState for subscriptions + queryEntitiesGeneric for query logic
 * 
 * This is the proper "CoState native way":
 * 1. Use CoState to subscribe to account.root.entities (reactive list subscription)
 * 2. When list changes, call queryEntitiesGeneric to query/filter entities (proven logic)
 * 3. Apply additional query options (filter, sort, limit, offset)
 * 4. Return reactive entities array
 * 
 * @param account - Jazz account (or account.current)
 * @param schemaName - Schema name to query (e.g., "Todo")
 * @param queryOptions - Optional filter/sort/limit/offset options
 * @returns Reactive object with entities array, loading state
 */
export function useQuery(
	accountCoState: any,
	schemaName: string,
	queryOptions?: QueryOptions,
): {
	entities: Array<Record<string, unknown>>
	isLoading: boolean
	loadingState: 'loading' | 'loaded' | 'unauthorized' | 'unavailable'
} {
	// CLEAN COSTATE PATTERN (like data explorer):
	// Access account.current inside $derived.by() to establish reactive subscriptions
	// When entities are added/updated/deleted, CoState triggers re-evaluation automatically
	const entities = $derived.by(() => {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:entities-start',message:'Entities derived running',data:{hasAccountCoState:!!accountCoState,schemaName},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'J'})}).catch(()=>{});
		// #endregion
		
		if (!accountCoState) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:no-accountcostate',message:'No accountCoState',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'J'})}).catch(()=>{});
			// #endregion
			return []
		}
		
		// Access .current to get live CoValue (establishes reactivity)
		const account = accountCoState.current
		if (!account?.$isLoaded) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:account-not-loaded',message:'Account not loaded',data:{hasAccount:!!account,isLoaded:account?.$isLoaded},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'J'})}).catch(()=>{});
			// #endregion
			return []
		}
		
		const root = account.root
		if (!root?.$isLoaded) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:root-not-loaded',message:'Root not loaded',data:{hasRoot:!!root,isLoaded:root?.$isLoaded},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'J'})}).catch(()=>{});
			// #endregion
			return []
		}
		
		const entitiesList = root.entities
		if (!entitiesList?.$isLoaded) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:entities-not-loaded',message:'Entities list not loaded',data:{hasList:!!entitiesList,isLoaded:entitiesList?.$isLoaded},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'J'})}).catch(()=>{});
			// #endregion
			return []
		}
		
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:entities-loaded',message:'Entities list loaded',data:{listLength:entitiesList.length,schemaName},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'M'})}).catch(()=>{});
		// #endregion
		
		// Step 1: Find target schema ID by name
		const schemata = root.schemata
		if (!schemata?.$isLoaded) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:schemata-not-loaded',message:'Schemata not loaded',data:{schemaName},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'O'})}).catch(()=>{});
			// #endregion
			return []
		}
		
		// Debug: log all schema names
		const allSchemaNames: any[] = []
		for (const schema of schemata) {
			if (!schema?.$isLoaded) continue
			
			// Access schema properties via snapshot (toJSON)
			const schemaSnapshot = schema.$jazz?.raw?.toJSON()
			allSchemaNames.push({
				isLoaded: schema.$isLoaded,
				name: schemaSnapshot?.name,
				id: schema.$jazz?.id,
				snapshot: schemaSnapshot
			})
		}
		
		let targetSchemaId: string | null = null
		for (const schema of schemata) {
			if (!schema?.$isLoaded) continue
			
			// Access schema name via snapshot
			const schemaSnapshot = schema.$jazz?.raw?.toJSON()
			if (schemaSnapshot?.name === schemaName) {
				targetSchemaId = schema.$jazz?.id
				break
			}
		}
		
		if (!targetSchemaId) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:schema-not-found',message:'Target schema not found',data:{schemaName,schemataCount:schemata.length,allSchemaNames},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'O'})}).catch(()=>{});
			// #endregion
			return []
		}
		
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:schema-found',message:'Target schema found',data:{schemaName,targetSchemaId},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'M'})}).catch(()=>{});
		// #endregion
		
		// Step 2: Filter entities by comparing @schema IDs
		const results: Array<Record<string, unknown>> = []
		let matchCount = 0
		let skipCount = 0
		let debugInfo: any[] = []
		
		for (const entity of entitiesList) {
			if (!entity?.$isLoaded) {
				skipCount++
				continue
			}
			
			// Get entity's @schema ID from snapshot (most reliable way)
			const snapshot = entity.$jazz?.raw?.toJSON()
			const entitySchemaId = snapshot?.['@schema']
			
			if (!entitySchemaId || typeof entitySchemaId !== 'string') {
				skipCount++
				continue
			}
			
			if (debugInfo.length < 3) {
				debugInfo.push({ entitySchemaId, targetSchemaId, matches: entitySchemaId === targetSchemaId })
			}
			
			if (entitySchemaId === targetSchemaId) {
				matchCount++
				results.push(coValueToPlainObject(entity))
			} else {
				skipCount++
			}
		}
		
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:filtering-complete',message:'Entity filtering complete',data:{schemaName,matchCount,skipCount,totalResults:results.length,debugInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'M'})}).catch(()=>{});
		// #endregion
		
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useQuery:results',message:'Entities filtered by direct schema.name check',data:{schemaName,matchCount,skipCount,resultsCount:results.length,totalEntities:entitiesList.length},timestamp:Date.now(),sessionId:'debug-session',runId:'final',hypothesisId:'K'})}).catch(()=>{});
		// #endregion
		
		return applyQueryOptions(results, queryOptions)
	})
	
	const isLoaded = $derived(
		accountCoState?.current?.$isLoaded === true &&
		accountCoState?.current?.root?.$isLoaded === true
	)
	const loadingState = $derived(isLoaded ? 'loaded' as const : 'loading' as const)
	const isLoading = $derived(!isLoaded)

	// Return reactive result with getter to preserve reactivity
	return {
		get entities() {
			return entities
		},
		get isLoading() {
			return isLoading
		},
		get loadingState() {
			return loadingState
		},
	}
}
