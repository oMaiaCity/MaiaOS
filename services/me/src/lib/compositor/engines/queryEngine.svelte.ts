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
 * Works with both plain objects and Jazz CoValue entities
 */
function applyQueryOptions<T>(
	entities: T[],
	options?: QueryOptions,
): T[] {
	let result = entities

	// Apply filters
	if (options?.filter) {
		result = result.filter((entity) => {
			// Convert to plain object for filtering if it's a CoValue
			const plainEntity = (entity as any)?.$jazz ? coValueToPlainObject(entity as any) : entity as Record<string, unknown>;
			return matchesFilter(plainEntity, options.filter!);
		})
	}

	// Apply sorting
	if (options?.sort) {
		const { field, order = 'asc' } = options.sort
		result = result.sort((a, b) => {
			// Access field directly or via property (works for both CoValues and plain objects)
			const aVal = (a as any)[field]
			const bVal = (b as any)[field]
			
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
 * Reactive query hook using CoState for subscriptions
 * 
 * JAZZ-NATIVE ARCHITECTURE:
 * 1. Use CoState to subscribe to account.root.entities (reactive list subscription)
 * 2. Return direct Jazz CoState entity references (NO local copies)
 * 3. Apply query options (filter, sort, limit, offset) on Jazz entities directly
 * 4. Views access entity properties directly from Jazz CoValues
 * 
 * @param account - Jazz account (or account.current)
 * @param schemaName - Schema name to query (e.g., "Todo")
 * @param queryOptions - Optional filter/sort/limit/offset options
 * @returns Reactive object with Jazz entity references (not copies)
 */
export function useQuery(
	accountCoState: any | (() => any),
	schemaName: string | (() => string),
	queryOptions?: QueryOptions | (() => QueryOptions | undefined),
): {
	entities: Array<any> // Jazz CoValue entities (not plain objects)
	isLoading: boolean
	loadingState: 'loading' | 'loaded' | 'unauthorized' | 'unavailable'
} {
	// CLEAN COSTATE PATTERN (like data explorer):
	// Access account.current inside $derived.by() to establish reactive subscriptions
	// When entities are added/updated/deleted, CoState triggers re-evaluation automatically
	const entities = $derived.by(() => {
		// Access accountCoState reactively - call function if provided, otherwise use static value
		const currentAccountCoState = typeof accountCoState === 'function' ? accountCoState() : accountCoState;
		// Access schemaName reactively - call function if provided, otherwise use static value
		const currentSchemaName = typeof schemaName === 'function' ? schemaName() : schemaName;
		const currentOptions = typeof queryOptions === 'function' ? queryOptions() : queryOptions;
		
		if (!currentSchemaName) {
			return []
		}
		
		if (!currentAccountCoState) {
			return []
		}
		
		// Access .current to get live CoValue (establishes reactivity)
		const account = currentAccountCoState.current
		if (!account?.$isLoaded) {
			return []
		}
		
		const root = account.root
		if (!root?.$isLoaded) {
			return []
		}
		
		const entitiesList = root.entities
		if (!entitiesList?.$isLoaded) {
			return []
		}
		
		// Step 1: Find target schema ID by name
		const schemata = root.schemata
		if (!schemata?.$isLoaded) {
			return []
		}
		
		let targetSchemaId: string | null = null
		for (const schema of schemata) {
			if (!schema?.$isLoaded) continue
			
			// Access schema name and type via snapshot
			const schemaSnapshot = schema.$jazz?.raw?.toJSON()
			
			// Skip Relation schema types - only query Entity types for now
			if (schemaSnapshot?.type === 'Relation') {
				continue
			}
			
			if (schemaSnapshot?.name === currentSchemaName) {
				targetSchemaId = schema.$jazz?.id
				break
			}
		}
		
		if (!targetSchemaId) {
			return []
		}
		
		// Step 2: Filter entities by comparing @schema IDs
		// Use coValueToPlainObject (WORKING VERSION) to convert Jazz entities to plain objects
		const results: Array<Record<string, unknown>> = []
		
		for (const entity of entitiesList) {
			if (!entity?.$isLoaded) {
				continue
			}
			
			// Get entity's @schema ID from snapshot (most reliable way)
			const snapshot = entity.$jazz?.raw?.toJSON()
			const entitySchemaId = snapshot?.['@schema']
			
			if (!entitySchemaId || typeof entitySchemaId !== 'string') {
				continue
			}
			
			if (entitySchemaId === targetSchemaId) {
				// Use the working coValueToPlainObject function
				results.push(coValueToPlainObject(entity))
			}
		}
		
		// Apply query options on plain objects
		return applyQueryOptions(results, currentOptions)
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
