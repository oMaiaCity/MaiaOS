/**
 * Jazz Query Manager
 * Generic utility for querying entities from Jazz and syncing with compositor data.queries
 * Handles CoValue ↔ plain object conversion and reactive subscriptions
 */

import type { Data } from './dataStore'
import { findNestedSchema, queryEntitiesGeneric } from '@hominio/db'

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
 * Jazz Query Manager - Manages queries and subscriptions for Jazz entities
 */
export class JazzQueryManager {
	private account: any
	private subscriptions: Map<string, () => void> = new Map()
	private entityMap: Map<string, any> = new Map() // id → CoValue

	constructor(account: any) {
		this.account = account
	}

	/**
	 * Query entities by schema name and convert to plain objects
	 * Uses generic queryEntitiesGeneric internally, but preserves entityMap tracking for subscriptions
	 */
	async queryEntitiesBySchema<T extends Record<string, unknown>>(
		schemaName: string,
		converter: (coValue: any) => T,
	): Promise<T[]> {
		if (!this.account) {
			return []
		}

		try {
			// Use generic query function internally - pass entityMap for CoValue tracking
			// This preserves the entityMap needed for reactive subscriptions
			const entities = await queryEntitiesGeneric<T>(
				this.account,
				schemaName,
				converter,
				this.entityMap, // Pass entityMap so CoValues are tracked for subscriptions
			)

			return entities
		} catch (error) {
			console.error('[JazzQueryManager] Error querying entities:', error)
			return []
		}
	}

	/**
	 * Convert CoValue to plain object (generic, works for any schema)
	 */
	coValueToPlainObject(coValue: any): Record<string, unknown> {
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
	applyQueryOptions<T extends Record<string, unknown>>(
		entities: T[],
		options?: QueryOptions,
	): T[] {
		if (!options) {
			return entities
		}

		let result = [...entities]

		// Apply filtering
		if (options.filter) {
			result = this.applyFilter(result, options.filter)
		}

		// Apply sorting
		if (options.sort) {
			result = this.applySort(result, options.sort)
		}

		// Apply offset
		if (options.offset && options.offset > 0) {
			result = result.slice(options.offset)
		}

		// Apply limit
		if (options.limit && options.limit > 0) {
			result = result.slice(0, options.limit)
		}

		return result
	}

	/**
	 * Apply filter conditions to entities
	 */
	private applyFilter<T extends Record<string, unknown>>(
		entities: T[],
		filter: FilterOptions,
	): T[] {
		return entities.filter((entity) => {
			return this.evaluateFilterCondition(entity, filter)
		})
	}

	/**
	 * Evaluate a filter condition against an entity
	 */
	private evaluateFilterCondition(
		entity: Record<string, unknown>,
		filter: FilterOptions | FilterCondition,
	): boolean {
		// Handle AND/OR logic
		if ('and' in filter) {
			const conditions = (filter as { and: FilterCondition[] }).and
			return conditions.every((condition) => this.evaluateFilterCondition(entity, condition))
		}

		if ('or' in filter) {
			const conditions = (filter as { or: FilterCondition[] }).or
			return conditions.some((condition) => this.evaluateFilterCondition(entity, condition))
		}

		// Handle field-based filters
		for (const [field, condition] of Object.entries(filter)) {
			const fieldValue = this.getNestedValue(entity, field)
			
			if (Array.isArray(condition)) {
				// Multiple conditions for same field (AND)
				if (!condition.every((cond) => this.evaluateSingleCondition(fieldValue, cond))) {
					return false
				}
			} else {
				if (!this.evaluateSingleCondition(fieldValue, condition as FilterCondition)) {
					return false
				}
			}
		}

		return true
	}

	/**
	 * Evaluate a single filter condition
	 */
	private evaluateSingleCondition(value: unknown, condition: FilterCondition): boolean {
		if ('eq' in condition) {
			return value === condition.eq
		}
		if ('ne' in condition) {
			return value !== condition.ne
		}
		if ('gt' in condition) {
			return typeof value === 'number' && typeof condition.gt === 'number' && value > condition.gt
		}
		if ('gte' in condition) {
			return typeof value === 'number' && typeof condition.gte === 'number' && value >= condition.gte
		}
		if ('lt' in condition) {
			return typeof value === 'number' && typeof condition.lt === 'number' && value < condition.lt
		}
		if ('lte' in condition) {
			return typeof value === 'number' && typeof condition.lte === 'number' && value <= condition.lte
		}
		if ('in' in condition) {
			return Array.isArray(condition.in) && condition.in.includes(value)
		}
		if ('nin' in condition) {
			return Array.isArray(condition.nin) && !condition.nin.includes(value)
		}
		if ('contains' in condition) {
			const strValue = String(value || '').toLowerCase()
			return strValue.includes(String(condition.contains).toLowerCase())
		}
		if ('startsWith' in condition) {
			const strValue = String(value || '').toLowerCase()
			return strValue.startsWith(String(condition.startsWith).toLowerCase())
		}
		if ('endsWith' in condition) {
			const strValue = String(value || '').toLowerCase()
			return strValue.endsWith(String(condition.endsWith).toLowerCase())
		}
		return true
	}

	/**
	 * Get nested value from object using dot notation
	 */
	private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
		const parts = path.split('.')
		let current: unknown = obj
		for (const part of parts) {
			if (current && typeof current === 'object' && part in current) {
				current = (current as Record<string, unknown>)[part]
			} else {
				return undefined
			}
		}
		return current
	}

	/**
	 * Apply sorting to entities
	 */
	private applySort<T extends Record<string, unknown>>(
		entities: T[],
		sort: SortOptions,
	): T[] {
		const result = [...entities]
		const order = sort.order || 'asc'
		const field = sort.field

		result.sort((a, b) => {
			const aValue = this.getNestedValue(a, field)
			const bValue = this.getNestedValue(b, field)

			// Handle undefined/null
			if (aValue === undefined || aValue === null) return order === 'asc' ? 1 : -1
			if (bValue === undefined || bValue === null) return order === 'asc' ? -1 : 1

			// Compare values
			if (typeof aValue === 'string' && typeof bValue === 'string') {
				return order === 'asc'
					? aValue.localeCompare(bValue)
					: bValue.localeCompare(aValue)
			}
			if (typeof aValue === 'number' && typeof bValue === 'number') {
				return order === 'asc' ? aValue - bValue : bValue - aValue
			}
			if (aValue instanceof Date && bValue instanceof Date) {
				return order === 'asc'
					? aValue.getTime() - bValue.getTime()
					: bValue.getTime() - aValue.getTime()
			}

			// Fallback to string comparison
			const aStr = String(aValue)
			const bStr = String(bValue)
			return order === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
		})

		return result
	}

	/**
	 * Subscribe to entity changes and update data.queries reactively
	 */
	subscribeToEntities(
		schemaName: string,
		queryKey: string, // e.g., "todos" for data.queries.todos
		dataStore: { update: (updater: (data: Data) => Data) => void },
		converter: (coValue: any) => Record<string, unknown>,
		queryOptions?: QueryOptions,
	): () => void {
		// Unsubscribe from previous subscription if exists
		const existingUnsubscribe = this.subscriptions.get(`${schemaName}:${queryKey}`)
		if (existingUnsubscribe) {
			existingUnsubscribe()
		}

		if (!this.account) {
			return () => {}
		}

		let unsubscribe: () => void = () => {}

		// Set up subscription asynchronously
		;(async () => {
			try {
				// Load account root and entities list
				const loadedAccount = await this.account.$jazz.ensureLoaded({
					resolve: { root: { entities: true } },
				})

				if (!loadedAccount.root || !loadedAccount.root.$jazz.has('entities')) {
					return
				}

				const entitiesList = loadedAccount.root.entities
				if (!entitiesList) {
					return
				}

				await entitiesList.$jazz.ensureLoaded()

				// Find the schema CoValue
				const schemaCoValue = await findNestedSchema(this.account, schemaName)
				if (!schemaCoValue) {
					return
				}

				// Subscribe to entities list changes
				const listUnsubscribe = (entitiesList as any).$jazz.subscribe({}, async () => {
					// Capture current entities before async re-query to avoid temporary empty state
					let currentEntities: unknown[] = []
					dataStore.update((data) => {
						const queries = data.queries as Record<string, unknown> | undefined
						currentEntities = (queries?.[queryKey] as unknown[]) || []
						return data // Don't modify, just read
					})
					
					// Re-query entities when list changes
					let entities = await this.queryEntitiesBySchema(schemaName, converter)
					
					// Apply query options if provided
					if (queryOptions) {
						entities = this.applyQueryOptions(entities, queryOptions) as typeof entities
					}
					
					// If query returned empty but we had entities before, preserve current state
					// This prevents temporary empty states during async operations or race conditions
					// Only update if we got results OR if we had no results before (initial load)
					if (entities.length > 0 || currentEntities.length === 0) {
						// Update data.queries reactively
						dataStore.update((data) => {
							const newData = { ...data }
							if (!newData.queries) {
								newData.queries = {}
							}
							const queries = { ...(newData.queries as Record<string, unknown>) }
							queries[queryKey] = entities
							newData.queries = queries
							return newData
						})
					}
					// If query returned empty but we had entities, don't update (preserve current state)
				})

				// Subscribe to individual entity changes
				const entityUnsubscribes: (() => void)[] = []

				const updateEntitySubscriptions = async () => {
					// Unsubscribe from old entities
					entityUnsubscribes.forEach((unsub) => unsub())
					entityUnsubscribes.length = 0

					// Get current entities
					let entities = await this.queryEntitiesBySchema(schemaName, converter)

					// Apply query options if provided
					if (queryOptions) {
						entities = this.applyQueryOptions(entities, queryOptions) as typeof entities
					}

					// Subscribe to each entity
					for (const entity of entities) {
						const entityId = entity.id && typeof entity.id === 'string' ? entity.id : undefined
						const coValue = entityId ? this.entityMap.get(entityId) : undefined
						if (coValue) {
							const entityUnsub = (coValue as any).$jazz.subscribe({}, async () => {
								// Capture current entities before async re-query to avoid temporary empty state
								let currentEntities: unknown[] = []
								dataStore.update((data) => {
									const queries = data.queries as Record<string, unknown> | undefined
									currentEntities = (queries?.[queryKey] as unknown[]) || []
									return data // Don't modify, just read
								})
								
								// Re-query all entities when one changes
								let updatedEntities = await this.queryEntitiesBySchema(
									schemaName,
									converter,
								)
								
								// Apply query options if provided
								if (queryOptions) {
									updatedEntities = this.applyQueryOptions(updatedEntities, queryOptions) as typeof updatedEntities
								}
								
								// If query returned empty but we had entities before, preserve current state
								// This prevents temporary empty states during async operations or race conditions
								// Only update if we got results OR if we had no results before (initial load)
								if (updatedEntities.length > 0 || currentEntities.length === 0) {
									dataStore.update((data) => {
										const newData = { ...data }
										if (!newData.queries) {
											newData.queries = {}
										}
										const queries = { ...(newData.queries as Record<string, unknown>) }
										queries[queryKey] = updatedEntities
										newData.queries = queries
										return newData
									})
								}
								// If query returned empty but we had entities, don't update (preserve current state)
							})
							entityUnsubscribes.push(entityUnsub)
						}
					}
				}

				// Initial subscription setup
				await updateEntitySubscriptions()

				// Re-subscribe to entities when list changes
				const listUnsubWithEntityUpdate = (entitiesList as any).$jazz.subscribe({}, () => {
					updateEntitySubscriptions()
				})

				unsubscribe = () => {
					listUnsubscribe()
					listUnsubWithEntityUpdate()
					entityUnsubscribes.forEach((unsub) => unsub())
				}
			} catch (_error) {
				// Subscription setup failed - silently fail
			}
		})()

		// Store unsubscribe function
		this.subscriptions.set(`${schemaName}:${queryKey}`, unsubscribe)

		return unsubscribe
	}

	/**
	 * Get CoValue reference by ID
	 */
	getCoValueById(id: string): any | undefined {
		return this.entityMap.get(id)
	}

	/**
	 * Cleanup all subscriptions
	 */
	cleanup(): void {
		this.subscriptions.forEach((unsubscribe) => unsubscribe())
		this.subscriptions.clear()
		this.entityMap.clear()
	}
}

