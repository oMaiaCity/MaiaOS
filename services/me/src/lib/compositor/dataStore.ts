/**
 * Unified Reactive Data Store
 * Single DRY interface for all data management - no distinction between states, context, or data types
 * Fully reactive, generic, and error-prone
 */

import { type Writable, writable } from 'svelte/store'
import type { QueryOptions } from './jazz-query-manager'

// ========== TYPES ==========

/**
 * Unified Data Interface - Everything is just data
 * No distinction between state, context, todos, etc.
 */
export type Data = Record<string, unknown>

/**
 * Action function - operates on unified data
 * Can be loaded from tool registry
 */
export type Action = (data: Data, payload?: unknown) => void | Promise<void>

/**
 * State Machine Config - simplified, unified
 * Actions are referenced by tool ID (loaded from registry)
 */
export interface StateMachineConfig {
	initial: string
	states: Record<
		string,
		{
			on?: Record<string, string | { target: string; actions?: string[] }>
			entry?: string[]
			exit?: string[]
		}
	>
	data?: Data
	/**
	 * Actions can be provided directly or loaded from tool registry
	 * If using tool registry, actions should be referenced by tool ID in state config
	 */
	actions?: Record<string, Action>
}

/**
 * Unified Data Store - Single reactive interface
 */
export interface DataStore extends Writable<Data> {
	send: (event: string, payload?: unknown) => void
	update: (updater: (data: Data) => Data) => void
	reset: () => void
	getState: () => string
	jazzQueryManager?: any // JazzQueryManager instance (optional)
}

// ========== STATE MACHINE CLASS ==========

class UnifiedDataStore {
	private config: StateMachineConfig
	private _data: Data
	private _state: string
	private subscribers: Set<(data: Data) => void> = new Set()

	constructor(config: StateMachineConfig) {
		this.config = config
		this._state = config.initial
		this._data = config.data ? { ...config.data, _state: config.initial } : { _state: config.initial }
	}

	/**
	 * Get current data (fully reactive)
	 */
	get data(): Data {
		return this._data
	}

	/**
	 * Get current state
	 */
	get state(): string {
		return this._state
	}

	/**
	 * Subscribe to data changes
	 */
	subscribe(callback: (data: Data) => void): () => void {
		this.subscribers.add(callback)
		callback(this._data)
		return () => {
			this.subscribers.delete(callback)
		}
	}

	/**
	 * Send an event
	 */
	send(event: string, payload?: unknown): void {
		const currentStateConfig = this.config.states[this._state]

		if (!currentStateConfig?.on?.[event]) {
			return
		}

		// Execute exit actions (fire and forget for async)
		if (currentStateConfig.exit) {
			this.executeActions(currentStateConfig.exit, payload).catch((error) => {
				console.error('[DataStore] Error in exit actions:', error)
			})
		}

		const nextStateConfig = currentStateConfig.on[event]
		const target = typeof nextStateConfig === 'string' ? nextStateConfig : nextStateConfig.target
		const actions = typeof nextStateConfig === 'object' ? nextStateConfig.actions : undefined

		// Execute transition asynchronously (fire and forget for async actions)
		this.transition(target, actions, payload).catch((error) => {
			console.error('[DataStore] Error in transition:', error)
		})
	}

	/**
	 * Transition to a new state
	 */
	private async transition(nextStateVal: string, actions?: string[], payload?: unknown): Promise<void> {
		// Update state
		this._state = nextStateVal
		this._data = { ...this._data, _state: nextStateVal }

		// Execute entry actions
		const nextStateConfig = this.config.states[nextStateVal]
		if (nextStateConfig?.entry) {
			await this.executeActions(nextStateConfig.entry, payload)
		}

		// Execute transition actions
		if (actions) {
			await this.executeActions(actions, payload)
		}

		this.notifySubscribers()
	}

	/**
	 * Execute actions on unified data
	 */
	private async executeActions(actionNames: string[], payload?: unknown): Promise<void> {
		if (!this.config.actions) return

		for (const actionName of actionNames) {
			const action = this.config.actions?.[actionName]
			if (action) {
				try {
					const result = action(this._data, payload)
					// If action returns a Promise, await it
					if (result instanceof Promise) {
						await result
					}
					// Create new data object with deep copy of nested objects to trigger reactivity
					// This ensures nested changes (like data.view.newTodoText) are detected
					const newData: Data = { ...this._data }
					
					// Deep copy nested objects if they exist and are objects
					const queries = this._data.queries
					if (queries && typeof queries === 'object' && !Array.isArray(queries)) {
						const queriesObj = queries as Record<string, unknown>
						newData.queries = { ...queriesObj }
					}
					const view = this._data.view
					if (view && typeof view === 'object' && !Array.isArray(view)) {
						const viewObj = view as Record<string, unknown>
						newData.view = { ...viewObj }
					}
					
					this._data = newData
					this.notifySubscribers()
				} catch (_error) {}
			}
		}
	}

	/**
	 * Notify subscribers
	 */
	private notifySubscribers(): void {
		this.subscribers.forEach((callback) => {
			try {
				callback(this._data)
			} catch (_error) {}
		})
	}

	/**
	 * Update data directly
	 */
	update(updater: (data: Data) => Data): void {
		this._data = updater(this._data)
		this.notifySubscribers()
	}

	/**
	 * Reset to initial state
	 */
	reset(): void {
		this._state = this.config.initial
		this._data = this.config.data
			? { ...this.config.data, _state: this.config.initial }
			: { _state: this.config.initial }
		this.notifySubscribers()
	}
}

// ========== FACTORY FUNCTION ==========

/**
 * Create unified reactive data store
 * @param config - State machine configuration
 * @param jazzAccount - Optional Jazz account for database integration
 */
export function createDataStore(
	config: StateMachineConfig,
	jazzAccount?: any,
): DataStore {
	const store = new UnifiedDataStore(config)
	const writableStore = writable(store.data)

	// Subscribe to store changes
	store.subscribe((data) => {
		writableStore.set(data)
	})

	const dataStore: DataStore = {
		...writableStore,
		send: (event: string, payload?: unknown) => {
			store.send(event, payload)
		},
		update: (updater: (data: Data) => Data) => {
			store.update(updater)
		},
		reset: () => {
			store.reset()
		},
		getState: () => store.state,
	}

	// Initialize Jazz integration if account is provided and loaded
	// Note: If account is not loaded yet, Vibe.svelte will handle initialization separately
	if (jazzAccount && (jazzAccount as any).$isLoaded) {
		// Account is already loaded - initialize immediately
		initializeQueries(dataStore, config, jazzAccount).catch((_error) => {
			// Jazz initialization failed - silently fail
		})
	}

	return dataStore
}

/**
 * Initialize queries from config.data.queries
 * Reads query definitions and sets up Jazz queries with subscriptions
 */
export async function initializeQueries(
	dataStore: DataStore,
	config: StateMachineConfig,
	jazzAccount: any,
): Promise<void> {
	try {
		// Store account reference in data for skills to access
		dataStore.update((data) => {
			return { ...data, _jazzAccount: jazzAccount }
		})

		// Import JazzQueryManager dynamically to avoid circular dependencies
		const { JazzQueryManager } = await import('./jazz-query-manager.js')
		const queryManager = new JazzQueryManager(jazzAccount)
		dataStore.jazzQueryManager = queryManager

		// Store queryManager reference in data for skills to access
		dataStore.update((data) => {
			return { ...data, _jazzQueryManager: queryManager }
		})

		// Read query definitions from config.data.queries
		const queries = config.data?.queries
		if (!queries || typeof queries !== 'object' || Array.isArray(queries)) {
			return
		}

		const queriesObj = queries as Record<string, unknown>

		// Initialize each query definition
		for (const [queryKey, queryValue] of Object.entries(queriesObj)) {
			// Check if this is a query definition (object with schemaName)
			if (
				queryValue &&
				typeof queryValue === 'object' &&
				!Array.isArray(queryValue) &&
				'schemaName' in queryValue
			) {
				const queryConfig = queryValue as { schemaName: string } & QueryOptions
				const schemaName = queryConfig.schemaName

				if (!schemaName || typeof schemaName !== 'string') {
					continue
				}

				// Extract query options (filter, sort, limit, offset)
				const queryOptions: QueryOptions = {}
				if (queryConfig.filter) queryOptions.filter = queryConfig.filter
				if (queryConfig.sort) queryOptions.sort = queryConfig.sort
				if (queryConfig.limit !== undefined) queryOptions.limit = queryConfig.limit
				if (queryConfig.offset !== undefined) queryOptions.offset = queryConfig.offset

				// Query entities
				const entities = await queryManager.queryEntitiesBySchema(
					schemaName,
					queryManager.coValueToPlainObject.bind(queryManager) as (coValue: any) => Record<string, unknown>,
				)

				// Apply query options (filter, sort, limit, offset)
				const filteredEntities = queryManager.applyQueryOptions(entities, queryOptions)

				// Update data.queries[queryKey] with results (replacing the query config object)
				dataStore.update((data) => {
					const newData = { ...data }
					if (!newData.queries) {
						newData.queries = {}
					}
					const queries = { ...(newData.queries as Record<string, unknown>) }
					queries[queryKey] = filteredEntities
					newData.queries = queries
					return newData
				})

				// Set up reactive subscriptions with query options
				queryManager.subscribeToEntities(
					schemaName,
					queryKey,
					dataStore,
					queryManager.coValueToPlainObject.bind(queryManager) as (coValue: any) => Record<string, unknown>,
					queryOptions,
				)
			}
			// Non-query properties (like 'title') are preserved as-is
		}
	} catch (_error) {
		// Initialization failed - silently fail
	}
}
