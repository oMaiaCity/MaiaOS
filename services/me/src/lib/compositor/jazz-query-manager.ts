/**
 * Jazz Query Manager
 * Generic utility for querying entities from Jazz and syncing with compositor data.queries
 * Handles CoValue ↔ plain object conversion and reactive subscriptions
 */

import type { Data } from './dataStore'
import { findNestedSchema } from '@hominio/db'

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
	 */
	async queryEntitiesBySchema<T extends Record<string, unknown>>(
		schemaName: string,
		converter: (coValue: any) => T,
	): Promise<T[]> {
		if (!this.account) {
			return []
		}

		try {
			// Load account root and entities list
			const loadedAccount = await this.account.$jazz.ensureLoaded({
				resolve: { root: { entities: true, schemata: true } },
			})

			if (!loadedAccount.root) {
				return []
			}

			const root = loadedAccount.root

			if (!root.$jazz.has('entities')) {
				return []
			}

			const entitiesList = root.entities
			if (!entitiesList) {
				return []
			}

			// Ensure entities list is loaded
			await entitiesList.$jazz.ensureLoaded()
			const entityArray = Array.from(entitiesList)

			// Find the schema CoValue for this schema name
			const schemaCoValue = await findNestedSchema(this.account, schemaName)
			if (!schemaCoValue) {
				return []
			}

			const targetSchemaId = schemaCoValue.$jazz?.id
			if (!targetSchemaId) {
				return []
			}

			// Filter entities by schema
			const entities: T[] = []

			for (let i = 0; i < entityArray.length; i++) {
				const entity = entityArray[i]
				if (!entity || typeof entity !== 'object' || !('$jazz' in entity)) {
					continue
				}

				// Ensure entity is loaded with @schema resolved
				const loadedEntity = await (entity as any).$jazz.ensureLoaded({
					resolve: { '@schema': true },
				})

				if (!loadedEntity.$isLoaded) {
					continue
				}

				// Check if entity has @schema property set
				const hasSchemaProperty = (loadedEntity as any).$jazz?.has('@schema')
				
				if (!hasSchemaProperty) {
					continue
				}

				// Get @schema - it's stored as a CoValue reference, need to resolve it
				// Try accessing via property first (might be already resolved)
				let entitySchema = (loadedEntity as any)['@schema']
				
				// If not accessible directly, try to get the raw value and load it via node
				if (!entitySchema || typeof entitySchema !== 'object' || !('$jazz' in entitySchema)) {
					// Get the raw CoValue to access the node
					const rawEntity = (loadedEntity as any).$jazz?.raw
					if (!rawEntity) {
						continue
					}

					// Get node from account or entity
					const node = rawEntity.core?.node || (this.account as any).$jazz?.raw?.core?.node
					if (!node) {
						continue
					}

					// Get @schema ID from the entity's snapshot
					const entitySnapshot = rawEntity.toJSON() as any
					const schemaId = entitySnapshot?.['@schema']
					
					if (!schemaId || typeof schemaId !== 'string') {
						continue
					}

					// Load the schema CoValue by ID
					try {
						const loadedSchemaValue = await node.load(schemaId as any)
						if (loadedSchemaValue === 'unavailable') {
							continue
						}
						entitySchema = loadedSchemaValue
					} catch (_error) {
						continue
					}
				}

				// Now entitySchema should be a CoValue - get its ID
				let schemaId: string | undefined
				if (entitySchema && typeof entitySchema === 'object' && '$jazz' in entitySchema) {
					schemaId = (entitySchema as any).$jazz?.id
				} else if (entitySchema && typeof entitySchema === 'object' && 'id' in entitySchema) {
					// Might be a raw CoValue with id property
					schemaId = (entitySchema as any).id
				}

				if (!schemaId) {
					continue
				}

				if (schemaId === targetSchemaId) {
					// Ensure entity is fully loaded with all properties before converting
					const fullyLoadedEntity = await (loadedEntity as any).$jazz.ensureLoaded({
						resolve: {
							text: true,
							status: true,
							endDate: true,
							duration: true,
						},
					})
					
					
					// This entity matches the schema - convert to plain object
					const plainObject = converter(fullyLoadedEntity)
					entities.push(plainObject)

					// Store fully loaded CoValue reference for later updates (not the partially loaded one)
					if (plainObject.id && typeof plainObject.id === 'string') {
						this.entityMap.set(plainObject.id, fullyLoadedEntity)
					}
				}
			}

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

