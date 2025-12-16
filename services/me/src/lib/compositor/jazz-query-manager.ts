/**
 * Jazz Query Manager
 * Generic utility for querying entities from Jazz and syncing with compositor data.queries
 * Handles CoValue ↔ plain object conversion and reactive subscriptions
 */

import type { Data } from './dataStore'
import { findNestedSchema, queryEntitiesGeneric } from '@hominio/db'

/**
 * Plain object representation of a Todo (matches UI schema)
 */
export interface TodoPlainObject extends Record<string, unknown> {
	id: string
	text: string
	status: string // Plain string (e.g., 'todo', 'in-progress', 'done')
	endDate?: string // ISO string
	duration?: number // minutes
	_coValueId?: string // Internal: Jazz CoValue ID for updates
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
	 * Convert Todo CoValue to plain object
	 */
	coValueToTodoPlainObject(coValue: any): TodoPlainObject {
		// Get ID
		const id = coValue.$jazz?.id || ''
		
		// Try to get properties from CoValue directly first
		let text = coValue.text
		let status = coValue.status
		let endDate = coValue.endDate
		let duration = coValue.duration

		// If properties aren't accessible directly, try via snapshot
		if (text === undefined || text === null) {
			try {
				const snapshot = coValue.$jazz?.raw?.toJSON?.() || coValue.toJSON?.()
				if (snapshot && typeof snapshot === 'object') {
					text = snapshot.text
					status = snapshot.status
					endDate = snapshot.endDate
					duration = snapshot.duration
				}
			} catch (_e) {
				// Fallback failed, use defaults
			}
		}

		return {
			id,
			text: text ? String(text) : '',
			status: status ? String(status) : 'todo',
			endDate: endDate ? String(endDate) : undefined,
			duration: duration ? Number(duration) : undefined,
			_coValueId: id,
		}
	}

	/**
	 * Subscribe to entity changes and update data.queries reactively
	 */
	subscribeToEntities(
		schemaName: string,
		queryKey: string, // e.g., "todos" for data.queries.todos
		dataStore: { update: (updater: (data: Data) => Data) => void },
		converter: (coValue: any) => Record<string, unknown>,
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
					// Re-query entities when list changes
					const entities = await this.queryEntitiesBySchema(schemaName, converter)
					
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
				})

				// Subscribe to individual entity changes
				const entityUnsubscribes: (() => void)[] = []

				const updateEntitySubscriptions = async () => {
					// Unsubscribe from old entities
					entityUnsubscribes.forEach((unsub) => unsub())
					entityUnsubscribes.length = 0

					// Get current entities
					const entities = await this.queryEntitiesBySchema(schemaName, converter)

					// Subscribe to each entity
					for (const entity of entities) {
						const entityId = entity.id && typeof entity.id === 'string' ? entity.id : undefined
						const coValue = entityId ? this.entityMap.get(entityId) : undefined
						if (coValue) {
							const entityUnsub = (coValue as any).$jazz.subscribe({}, async () => {
								// Re-query all entities when one changes
								const updatedEntities = await this.queryEntitiesBySchema(
									schemaName,
									converter,
								)
								
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

