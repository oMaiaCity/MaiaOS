/**
 * useQuery Hook - MaiaScript-based reactive query subscription
 * 
 * This follows the data explorer pattern:
 * - Access accountCoState.current inside $derived.by() to establish reactivity
 * - Synchronously filter and convert entities (no async queries)
 * - CoState automatically triggers re-evaluation when entities change
 * - All operations are synchronous for immediate reactivity
 * - Uses MaiaScript DSL for query operations
 * 
 * Note: This hook is designed to be used in Svelte components with runes ($state, $derived)
 */

import { safeEvaluate } from '@maia/script'
import type { QueryConfig } from '../tools/types'
import type { EvaluationContext } from '@maia/script'

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
 * Execute MaiaScript query operations on entities
 */
function executeQueryOperations(
	entities: Array<Record<string, unknown>>,
	operations: any,
	ctx: EvaluationContext
): Array<Record<string, unknown>> {
	if (!operations) {
		// No operations - return all entities
		return entities
	}

	// Check if operations is a $pipe expression
	if (operations.$pipe && Array.isArray(operations.$pipe)) {
		// $pipe expects: [operationsArray, entities]
		const result = safeEvaluate(
			{ $pipe: [operations.$pipe, entities] },
			ctx
		)
		return Array.isArray(result) ? result : entities
	}

	// Check if operations is a single operation object (e.g., { "$filter": { ... } })
	const opKeys = Object.keys(operations)
	if (opKeys.length === 1 && opKeys[0].startsWith('$')) {
		const opKey = opKeys[0]
		const opConfig = operations[opKey]
		
		// Execute single operation: operation expects [config, entities]
		const result = safeEvaluate(
			{ [opKey]: [opConfig, entities] },
			ctx
		)
		return Array.isArray(result) ? result : entities
	}

	// Unknown format - return entities as-is
	return entities
}

// ========== USE QUERY HOOK ==========

/**
 * Reactive query hook using CoState for subscriptions with MaiaScript operations
 * 
 * JAZZ-NATIVE ARCHITECTURE:
 * 1. Use CoState to subscribe to account.root.entities (reactive list subscription)
 * 2. Return plain objects (converted from Jazz CoValues)
 * 3. Apply MaiaScript query operations (filter, sort, paginate, pipe)
 * 4. Views access entity properties from plain objects
 * 
 * @param accountCoState - Jazz account CoState
 * @param queryConfig - Query configuration with schemaName and optional MaiaScript operations
 * @returns Reactive object with plain entity objects
 */
export function useQuery(
	accountCoState: any | (() => any),
	queryConfig: QueryConfig | (() => QueryConfig | undefined),
): {
	entities: Array<Record<string, unknown>>
	isLoading: boolean
	loadingState: 'loading' | 'loaded' | 'unauthorized' | 'unavailable'
} {
	// CLEAN COSTATE PATTERN (like data explorer):
	// Access account.current inside $derived.by() to establish reactive subscriptions
	// When entities are added/updated/deleted, CoState triggers re-evaluation automatically
	const entities = $derived.by(() => {
		// Access accountCoState reactively - call function if provided, otherwise use static value
		const currentAccountCoState = typeof accountCoState === 'function' ? accountCoState() : accountCoState
		// Access queryConfig reactively - call function if provided, otherwise use static value
		const currentQueryConfig = typeof queryConfig === 'function' ? queryConfig() : queryConfig
		
		if (!currentQueryConfig?.schemaName) {
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
			
			if (schemaSnapshot?.name === currentQueryConfig.schemaName) {
				targetSchemaId = schema.$jazz?.id
				break
			}
		}
		
		if (!targetSchemaId) {
			return []
		}
		
		// Step 2: Filter entities by comparing @schema IDs and convert to plain objects
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
				// Convert to plain object
				results.push(coValueToPlainObject(entity))
			}
		}
		
		// Step 3: Apply MaiaScript query operations if provided
		if (currentQueryConfig.operations) {
			const evalCtx: EvaluationContext = {
				context: {},
				dependencies: {},
				item: {}
			}
			
			return executeQueryOperations(results, currentQueryConfig.operations, evalCtx)
		}
		
		// No operations - return all entities
		return results
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
