/**
 * Core Tool Module - Builtin data/CRUD operations
 * Always loaded - provides fundamental database operations
 * 
 * Consolidates:
 * - Entity CRUD (from entity-skills.ts)
 * - Schema management (from schema-skills.ts)
 * - Relation CRUD (from relations-skills.ts)
 * - Database management (from database-skills.ts)
 * 
 * All tools use @core/* namespace for consistency
 */

import type { ToolModule } from './module-types'
import type { Tool } from './types'
import {
	createEntityGeneric,
	updateEntityGeneric,
	deleteEntityGeneric,
	ensureSchema,
	createRelationGeneric,
	updateRelationGeneric,
	deleteRelationGeneric,
} from '@maia/db'

// ========== ENTITY CRUD TOOLS ==========

const createEntityTool: Tool = {
	metadata: {
		id: '@core/createEntity',
		name: 'Create Entity',
		description: 'Creates a new entity of any schema type',
		category: 'core',
		parameters: {
			type: 'object',
			properties: {
				schemaName: {
					type: 'string',
					description: 'The schema name (e.g., "Todo", "Human", "AssignedTo")',
					required: true,
				},
				entityData: {
					type: 'object',
					description: 'The entity data to create',
					required: true,
				},
				clearFieldPath: {
					type: 'string',
					description: 'Optional: Field path in actor.context to clear after successful creation',
					required: false,
				},
			},
			required: ['schemaName', 'entityData'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const payloadData = (payload as {
			schemaName?: string
			entityData?: Record<string, unknown>
			clearFieldPath?: string
		}) || {}

		const schemaName = payloadData.schemaName

		if (!schemaName) {
			throw new Error('schemaName is required in payload')
		}

		const entityData: Record<string, unknown> = payloadData.entityData || {}

		if (!entityData || Object.keys(entityData).length === 0) {
			throw new Error('entityData is required')
		}

		// Get Jazz account from accountCoState parameter
		if (!accountCoState) {
			actor.context.error = 'Jazz AccountCoState not available'
			await actor.$jazz.waitForSync()
			return
		}

		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			actor.context.error = 'Jazz account not loaded'
			await actor.$jazz.waitForSync()
			return
		}

		// Use generic CREATE function
		try {
			const result = await createEntityGeneric(jazzAccount, schemaName, entityData)
			
			// Clear field and error using Jazz reactivity (create new context object)
			const currentContext = actor.context as Record<string, unknown>
			const updatedContext: Record<string, unknown> = { ...currentContext }
			
			// Clear field in actor.context if clearFieldPath is provided
			if (payloadData.clearFieldPath) {
				const pathParts = payloadData.clearFieldPath.split('.')
				let target: any = updatedContext
				for (let i = 0; i < pathParts.length - 1; i++) {
					const part = pathParts[i]
					if (!target[part]) {
						target[part] = {}
					}
					target = target[part]
				}
				const finalKey = pathParts[pathParts.length - 1]
				target[finalKey] = ''
			}
			
			// Clear error
			updatedContext.error = null
			
			// Use Jazz $jazz.set() for proper reactivity
			actor.$jazz.set('context', updatedContext)
			
			// Entity automatically appears in queries via Jazz reactivity
		} catch (error) {
			const currentContext = actor.context as Record<string, unknown>
			const updatedContext: Record<string, unknown> = { ...currentContext, error: `Failed to create ${schemaName} entity: ${error instanceof Error ? error.message : 'Unknown error'}` }
			actor.$jazz.set('context', updatedContext)
		}
	},
}

const updateEntityTool: Tool = {
	metadata: {
		id: '@core/updateEntity',
		name: 'Update Entity',
		description: 'Updates an existing entity of any schema type. Schema is automatically detected from the entity\'s @schema property.',
		category: 'core',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'The ID of the entity to update',
					required: true,
				},
				updates: {
					type: 'object',
					description: 'The fields to update',
					required: false,
				},
				status: {
					type: 'string',
					description: 'Convenience: status field value (alternative to updates.status)',
					required: false,
				},
			},
			required: ['id'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const payloadData = (payload as {
			id?: string
			updates?: Record<string, unknown>
			status?: string
			[key: string]: unknown
		}) || {}

		const { id, updates, status, ...otherFields } = payloadData

		if (!id) {
			console.error('[updateEntityTool] No ID provided');
			throw new Error('id is required')
		}

		// Build updates object
		let finalUpdates: Record<string, unknown> = updates || {}

		if (status !== undefined) {
			finalUpdates = { ...finalUpdates, status }
		}

		if (Object.keys(otherFields).length > 0) {
			finalUpdates = { ...finalUpdates, ...otherFields }
		}

		if (!finalUpdates || Object.keys(finalUpdates).length === 0) {
			console.error('[updateEntityTool] No updates provided');
			throw new Error('updates are required')
		}

		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not loaded')
		}

		try {
			const root = jazzAccount.root
			if (!root?.$isLoaded) {
				throw new Error('Account root not loaded')
			}

			const entitiesList = root.entities
			if (!entitiesList?.$isLoaded) {
				throw new Error('Entities list not loaded')
			}

			let coValue: any = null
			
			for (const entity of entitiesList) {
				if (!entity?.$isLoaded) continue
				
				const entityId = entity.id || entity.$jazz?.id
				
				if (entityId === id) {
					coValue = entity
					break
				}
			}

			if (!coValue) {
				throw new Error(`Entity not found for ID: ${id}`)
			}

			await updateEntityGeneric(jazzAccount, coValue, finalUpdates)
		} catch (error) {
			throw error
		}
	},
}

const deleteEntityTool: Tool = {
	metadata: {
		id: '@core/deleteEntity',
		name: 'Delete Entity',
		description: 'Deletes an entity of any schema type',
		category: 'core',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'The ID of the entity to delete',
					required: true,
				},
			},
			required: ['id'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const { id } = (payload as { id?: string }) || {}

		if (!id) {
			throw new Error('id is required')
		}

		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not loaded')
		}

		try {
			await deleteEntityGeneric(jazzAccount, id)
		} catch (error) {
			throw error
		}
	},
}

const toggleStatusTool: Tool = {
	metadata: {
		id: '@core/toggleStatus',
		name: 'Toggle Entity Status',
		description: 'Toggles a status field on an entity (e.g., todo <-> done)',
		category: 'core',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'The ID of the entity to toggle',
					required: true,
				},
				statusField: {
					type: 'string',
					description: 'The name of the status field (default: "status")',
					required: false,
				},
				value1: {
					type: 'string',
					description: 'First status value',
					required: true,
				},
				value2: {
					type: 'string',
					description: 'Second status value',
					required: true,
				},
			},
			required: ['id'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const {
			id,
			statusField = 'status',
			value1,
			value2,
		} = (payload as {
			id?: string
			statusField?: string
			value1?: string
			value2?: string
		}) || {}

		if (!id) {
			throw new Error('id is required')
		}

		if (!value1 || !value2) {
			throw new Error('value1 and value2 are required for toggle operation')
		}

		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not loaded')
		}

		try {
			const root = jazzAccount.root
			if (!root?.$isLoaded) {
				throw new Error('Account root not loaded')
			}

			const entitiesList = root.entities
			if (!entitiesList?.$isLoaded) {
				throw new Error('Entities list not loaded')
			}

			let coValue: any = null
			
			for (const entity of entitiesList) {
				if (!entity?.$isLoaded) continue
				
				const entityId = entity.id || entity.$jazz?.id
				
				if (entityId === id) {
					coValue = entity
					break
				}
			}

			if (!coValue) {
				throw new Error(`Entity not found for ID: ${id}`)
			}

			let currentStatus = (coValue as any)[statusField]
			if (!currentStatus) {
				try {
					const snapshot = coValue.$jazz?.raw?.toJSON?.() || coValue.toJSON?.()
					if (snapshot && typeof snapshot === 'object') {
						currentStatus = (snapshot as any)[statusField]
					}
				} catch (_e) {
					currentStatus = value1
				}
			}
			
			const newStatus = currentStatus === value2 ? value1 : value2

			await updateEntityGeneric(jazzAccount, coValue, { [statusField]: newStatus })
		} catch (error) {
			throw error
		}
	},
}

const clearEntitiesTool: Tool = {
	metadata: {
		id: '@core/clearEntities',
		name: 'Clear Entities',
		description: 'Clears all entities of a specific schema type from the list',
		category: 'core',
		parameters: {
			type: 'object',
			properties: {
				schemaName: {
					type: 'string',
					description: 'The schema name (e.g., "Todo", "Human")',
					required: true,
				},
				queryKey: {
					type: 'string',
					description: 'The query key in actor.context.queries',
					required: true,
				},
			},
			required: ['schemaName', 'queryKey'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const payloadData = (payload as {
			schemaName?: string
			queryKey?: string
		}) || {}
		
		const schemaName = payloadData.schemaName
		let queryKey = payloadData.queryKey

		if (!schemaName) {
			throw new Error('schemaName is required in payload')
		}

		if (!queryKey) {
			queryKey = `${schemaName.toLowerCase()}s`
		}

		const queries = (actor.context.queries as any) || {}

		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not loaded')
		}

		try {
			const queryData = queries[queryKey] || {}
			const entities = (queryData.items || queryData || []) as Array<any>
			
			for (const entity of entities) {
				const entityId = entity.id || entity.$jazz?.id
				if (entityId) {
					try {
						await deleteEntityGeneric(jazzAccount, entityId)
					} catch (error) {
						console.error(`Failed to delete ${schemaName} entity ${entityId}:`, error)
					}
				}
			}
		} catch (error) {
			throw error
		}
	},
}

// ========== SCHEMA MANAGEMENT TOOLS ==========

const createSchemaTool: Tool = {
	metadata: {
		id: '@core/createSchema',
		name: 'Create Schema Type',
		description: 'Creates a new schema type (Entity or Relation) with a configurable interface',
		category: 'core',
		parameters: {
			type: 'object',
			properties: {
				schemaName: {
					type: 'string',
					description: 'Name of the schema',
					required: true,
				},
				schemaType: {
					type: 'string',
					description: 'Type of schema: "Entity" or "Relation"',
					required: true,
				},
				jsonSchema: {
					type: 'object',
					description: 'JSON Schema definition object',
					required: true,
				},
			},
			required: ['schemaName', 'schemaType', 'jsonSchema'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const payloadData = (payload as {
			schemaName?: string
			schemaType?: 'Entity' | 'Relation'
			jsonSchema?: any
		}) || {}

		const schemaName = payloadData.schemaName
		const schemaType = payloadData.schemaType
		const jsonSchema = payloadData.jsonSchema

		if (!schemaName) {
			throw new Error('schemaName is required in payload')
		}

		if (!schemaType || (schemaType !== 'Entity' && schemaType !== 'Relation')) {
			throw new Error('schemaType is required and must be "Entity" or "Relation"')
		}

		if (!jsonSchema) {
			throw new Error('jsonSchema is required in payload')
		}

		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const account = accountCoState.current
		if (!account || !account.$isLoaded) {
			throw new Error('Account is not loaded')
		}

		const schemaDefinition = await ensureSchema(account, schemaName, jsonSchema)
		await schemaDefinition.$jazz.ensureLoaded()
		
		schemaDefinition.$jazz.set('type', schemaType)
		await schemaDefinition.$jazz.waitForSync()
	},
}

// ========== RELATION CRUD TOOLS ==========

const createRelationTool: Tool = {
	metadata: {
		id: '@core/createRelation',
		name: 'Create Relation',
		description: 'Creates a new relation instance (e.g., AssignedTo)',
		category: 'core',
		parameters: {
			type: 'object',
			properties: {
				schemaName: {
					type: 'string',
					description: 'The relation schema name',
					required: true,
				},
				relationData: {
					type: 'object',
					description: 'The relation data to create',
					required: true,
				},
			},
			required: ['schemaName', 'relationData'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const payloadData = (payload as {
			schemaName?: string
			relationData?: Record<string, unknown>
		}) || {}

		const schemaName = payloadData.schemaName
		const relationData = payloadData.relationData

		if (!schemaName) {
			throw new Error('schemaName is required in payload')
		}

		if (!relationData || typeof relationData !== 'object') {
			throw new Error('relationData is required in payload')
		}

		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const account = accountCoState.current
		if (!account || !account.$isLoaded) {
			throw new Error('Account is not loaded')
		}

		await createRelationGeneric(account, schemaName, relationData)
	},
}

const updateRelationTool: Tool = {
	metadata: {
		id: '@core/updateRelation',
		name: 'Update Relation',
		description: 'Updates an existing relation instance',
		category: 'core',
		parameters: {
			type: 'object',
			properties: {
				relationId: {
					type: 'string',
					description: 'ID of the relation to update',
					required: true,
				},
				updates: {
					type: 'object',
					description: 'Partial relation data to update',
					required: true,
				},
			},
			required: ['relationId', 'updates'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const payloadData = (payload as {
			relationId?: string
			updates?: Record<string, unknown>
		}) || {}

		const relationId = payloadData.relationId
		const updates = payloadData.updates

		if (!relationId) {
			throw new Error('relationId is required in payload')
		}

		if (!updates || typeof updates !== 'object') {
			throw new Error('updates is required in payload')
		}

		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const account = accountCoState.current
		if (!account || !account.$isLoaded) {
			throw new Error('Account is not loaded')
		}

		const node = (account as any).$jazz?.raw?.core?.node
		if (!node) {
			throw new Error('Cannot get LocalNode from account')
		}

		const relation = await node.load(relationId as any)
		if (relation === 'unavailable') {
			throw new Error(`Relation with ID ${relationId} is unavailable`)
		}

		await updateRelationGeneric(account, relation, updates)
	},
}

const deleteRelationTool: Tool = {
	metadata: {
		id: '@core/deleteRelation',
		name: 'Delete Relation',
		description: 'Deletes an existing relation instance',
		category: 'core',
		parameters: {
			type: 'object',
			properties: {
				relationId: {
					type: 'string',
					description: 'ID of the relation to delete',
					required: true,
				},
			},
			required: ['relationId'],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const payloadData = (payload as {
			relationId?: string
		}) || {}

		const relationId = payloadData.relationId

		if (!relationId) {
			throw new Error('relationId is required in payload')
		}

		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const account = accountCoState.current
		if (!account || !account.$isLoaded) {
			throw new Error('Account is not loaded')
		}

		await deleteRelationGeneric(account, relationId)
	},
}

// ========== DATABASE MANAGEMENT TOOLS ==========

const resetDatabaseTool: Tool = {
	metadata: {
		id: '@core/resetDatabase',
		name: 'Reset Database',
		description: 'Clears all schemata, entities, relations, actors, and vibes registry from the database',
		category: 'core',
		parameters: {
			type: 'object',
			properties: {},
			required: [],
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const account = accountCoState.current
		if (!account || !account.$isLoaded) {
			throw new Error('Account is not loaded')
		}

		const { resetData } = await import('@maia/db');
		await resetData(account);
	},
}

// ========== MODULE EXPORT ==========

export const coreModule: ToolModule = {
	name: 'core',
	version: '1.0.0',
	builtin: true,
	tools: {
		'@core/createEntity': createEntityTool,
		'@core/updateEntity': updateEntityTool,
		'@core/deleteEntity': deleteEntityTool,
		'@core/toggleStatus': toggleStatusTool,
		'@core/clearEntities': clearEntitiesTool,
		'@core/createSchema': createSchemaTool,
		'@core/createRelation': createRelationTool,
		'@core/updateRelation': updateRelationTool,
		'@core/deleteRelation': deleteRelationTool,
		'@core/resetDatabase': resetDatabaseTool,
	},
}

// Auto-register core module (builtin - always loaded)
import { toolModuleRegistry } from './module-registry'
toolModuleRegistry.register(coreModule)
