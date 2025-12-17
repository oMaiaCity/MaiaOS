/**
 * Entity Skills - Generic CRUD operations for any entity type
 * Works with any schema (Todo, Human, AssignedTo, etc.)
 * Each skill is self-contained and can be called independently
 * Future-ready for LLM skill calls
 */

import type { Data } from '../dataStore'
import type { Skill } from './types'
import {
	createEntityGeneric,
	updateEntityGeneric,
	deleteEntityGeneric,
} from '@hominio/db'

// ========== GENERIC ENTITY SKILLS ==========

const createEntitySkill: Skill = {
	metadata: {
		id: '@entity/createEntity',
		name: 'Create Entity',
		description: 'Creates a new entity of any schema type',
		category: 'entity',
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
					description: 'The entity data to create (required if dataPath not provided)',
					required: false,
				},
				dataPath: {
					type: 'string',
					description: 'Optional: Data path to read value from (e.g., "view.newTodoText")',
					required: false,
				},
				buildEntityData: {
					type: 'function',
					description: 'Optional: Function to build entityData from dataPath value',
					required: false,
				},
				clearFieldPath: {
					type: 'string',
					description: 'Optional: Field path to clear after successful creation',
					required: false,
				},
			},
			required: ['schemaName'],
		},
	},
	execute: async (data: Data, payload?: unknown) => {
		// Universal payload interface - works for any schema
		const payloadData = (payload as {
			schemaName?: string
			entityData?: Record<string, unknown>
			// Optional: field path to read entityData from (e.g., "view.newTodoText" -> extract and build entityData)
			dataPath?: string
			// Optional: callback to build entityData from data path value
			buildEntityData?: (value: unknown) => Record<string, unknown>
			// Optional: field path to clear after successful creation
			clearFieldPath?: string
		}) || {}

		const schemaName = payloadData.schemaName

		if (!schemaName) {
			throw new Error('schemaName is required in payload')
		}

		// Build entityData - fully generic approach
		let entityData: Record<string, unknown> = payloadData.entityData || {}

		// If entityData not provided but dataPath is, try to extract from data path
		if (!entityData || Object.keys(entityData).length === 0) {
			if (payloadData.dataPath && payloadData.buildEntityData) {
				// Navigate to data path
				const pathParts = payloadData.dataPath.split('.')
				let target: unknown = data
				for (const part of pathParts) {
					if (target && typeof target === 'object' && part in target) {
						target = (target as Record<string, unknown>)[part]
					} else {
						target = null
						break
					}
				}
				// Build entityData using provided callback
				if (target !== null && target !== undefined) {
					entityData = payloadData.buildEntityData(target)
				}
			}
		}

		if (!entityData || Object.keys(entityData).length === 0) {
			throw new Error('entityData is required (provide entityData directly or use dataPath + buildEntityData)')
		}

		// Check if Jazz AccountCoState is available - fail fast if not (clean CoState pattern)
		const accountCoState = data._jazzAccountCoState as any
		if (!accountCoState) {
			if (!data.view) data.view = {}
			const view = data.view as Data
			view.error = 'Jazz AccountCoState not available'
			data.view = { ...view }
			return
		}

		// Get the current account from CoState
		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			if (!data.view) data.view = {}
			const view = data.view as Data
			view.error = 'Jazz account not loaded'
			data.view = { ...view }
			return
		}

		// Use generic CREATE function
		try {
			const result = await createEntityGeneric(jazzAccount, schemaName, entityData)
			
			// Clear field if clearFieldPath is provided
			if (payloadData.clearFieldPath) {
				const pathParts = payloadData.clearFieldPath.split('.')
				let target: Data = data
				for (let i = 0; i < pathParts.length - 1; i++) {
					const part = pathParts[i]
					if (!target[part]) {
						target[part] = {}
					}
					target = target[part] as Data
				}
				const finalKey = pathParts[pathParts.length - 1]
				target[finalKey] = ''
				
				// Clear error
				if (!data.view) data.view = {}
				const view = data.view as Data
				view.error = null
				data.view = { ...view }
			}
			
			// Subscription will update data.queries automatically
		} catch (error) {
			if (!data.view) data.view = {}
			const view = data.view as Data
			view.error = `Failed to create ${schemaName} entity: ${error instanceof Error ? error.message : 'Unknown error'}`
			data.view = { ...view }
		}
	},
}

const updateEntitySkill: Skill = {
	metadata: {
		id: '@entity/updateEntity',
		name: 'Update Entity',
		description: 'Updates an existing entity of any schema type. Schema is automatically detected from the entity\'s @schema property.',
		category: 'entity',
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
	execute: async (data: Data, payload?: unknown) => {
		const payloadData = (payload as {
			id?: string
			updates?: Record<string, unknown>
			status?: string // For convenience - status can be passed directly
			[key: string]: unknown // Allow other fields to be passed as updates
		}) || {}

		const { id, updates, status, ...otherFields } = payloadData

		if (!id) {
			throw new Error('id is required')
		}

		// Build updates object - handle both { id, updates } and { id, status, ...otherFields } formats
		let finalUpdates: Record<string, unknown> = updates || {}

		// If status is provided directly, add it to updates
		if (status !== undefined) {
			finalUpdates = { ...finalUpdates, status }
		}

		// If other fields are provided (like from drag/drop), add them to updates
		if (Object.keys(otherFields).length > 0) {
			finalUpdates = { ...finalUpdates, ...otherFields }
		}

		if (!finalUpdates || Object.keys(finalUpdates).length === 0) {
			throw new Error('updates are required (provide updates object or individual fields like status)')
		}

		// Check if Jazz AccountCoState is available - fail fast if not (clean CoState pattern)
		const accountCoState = data._jazzAccountCoState as any
		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		// Get the current account from CoState
		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not loaded')
		}

		// Use Jazz to update entity
		try {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'updateEntity:start',message:'Update entity starting',data:{id,updates:finalUpdates,hasAccount:!!jazzAccount,accountLoaded:jazzAccount?.$isLoaded},timestamp:Date.now(),sessionId:'debug-session',runId:'update',hypothesisId:'R'})}).catch(()=>{});
			// #endregion
			
			// Find entity in already-loaded root.entities (clean CoState pattern - no manual loading)
			const root = jazzAccount.root
			if (!root?.$isLoaded) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'updateEntity:root-not-loaded',message:'Root not loaded',data:{id,hasRoot:!!root},timestamp:Date.now(),sessionId:'debug-session',runId:'update',hypothesisId:'R'})}).catch(()=>{});
				// #endregion
				throw new Error('Account root not loaded')
			}

			const entitiesList = root.entities
			if (!entitiesList?.$isLoaded) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'updateEntity:entities-not-loaded',message:'Entities list not loaded',data:{id,hasEntities:!!entitiesList},timestamp:Date.now(),sessionId:'debug-session',runId:'update',hypothesisId:'R'})}).catch(()=>{});
				// #endregion
				throw new Error('Entities list not loaded')
			}

			// Find the entity by ID in the already-loaded list
			// Try multiple ID access patterns for robustness
			let coValue: any = null
			const entityIds: string[] = [] // For debug logging
			
			for (const entity of entitiesList) {
				if (!entity?.$isLoaded) continue
				
				// Try multiple ID access patterns (direct property first, then $jazz)
				const entityId = entity.id || entity.$jazz?.id
				entityIds.push(entityId || 'unknown')
				
				if (entityId === id) {
					coValue = entity
					break
				}
			}

			if (!coValue) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'updateEntity:covalue-not-found',message:'CoValue not found in entities list',data:{id,entitiesCount:entitiesList.length,entityIds:entityIds.slice(0,5),targetId:id},timestamp:Date.now(),sessionId:'debug-session',runId:'update',hypothesisId:'S'})}).catch(()=>{});
				// #endregion
				throw new Error(`Entity not found for ID: ${id}`)
			}

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'updateEntity:covalue-found',message:'CoValue found successfully',data:{id,isLoaded:coValue.$isLoaded},timestamp:Date.now(),sessionId:'debug-session',runId:'update',hypothesisId:'R'})}).catch(()=>{});
			// #endregion

			// Update using generic UPDATE function
			await updateEntityGeneric(jazzAccount, coValue, finalUpdates)

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'updateEntity:success',message:'Update completed successfully',data:{id,updates:finalUpdates},timestamp:Date.now(),sessionId:'debug-session',runId:'update',hypothesisId:'P'})}).catch(()=>{});
			// #endregion

			// Subscription will update data.queries automatically
		} catch (error) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'updateEntity:error',message:'Update failed with error',data:{id,error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'update',hypothesisId:'P'})}).catch(()=>{});
			// #endregion
			throw error // Re-throw to surface the error
		}
	},
}

const deleteEntitySkill: Skill = {
	metadata: {
		id: '@entity/deleteEntity',
		name: 'Delete Entity',
		description: 'Deletes an entity of any schema type. Schema is automatically detected from the entity\'s @schema property.',
		category: 'entity',
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
	execute: async (data: Data, payload?: unknown) => {
		const { id } = (payload as { id?: string }) || {}

		if (!id) {
			throw new Error('id is required')
		}

		// Check if Jazz AccountCoState is available - fail fast if not (clean CoState pattern)
		const accountCoState = data._jazzAccountCoState as any
		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		// Get the current account from CoState
		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not loaded')
		}

		// Use generic DELETE function
		try {
			await deleteEntityGeneric(jazzAccount, id)
			// Subscription will update data.queries automatically
		} catch (error) {
			throw error // Re-throw to surface the error
		}
	},
}

const toggleEntityStatusSkill: Skill = {
	metadata: {
		id: '@entity/toggleStatus',
		name: 'Toggle Entity Status',
		description: 'Toggles a status field on an entity (e.g., todo <-> done). Schema is automatically detected from the entity\'s @schema property.',
		category: 'entity',
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
					description: 'First status value (required - no defaults)',
					required: true,
				},
				value2: {
					type: 'string',
					description: 'Second status value (required - no defaults)',
					required: true,
				},
			},
			required: ['id'],
		},
	},
	execute: async (data: Data, payload?: unknown) => {
		const {
			id,
			statusField = 'status',
			value1,
			value2,
		} = (payload as {
			id?: string
			statusField?: string
			value1?: string // Required - no defaults, must be provided
			value2?: string // Required - no defaults, must be provided
		}) || {}

		if (!id) {
			throw new Error('id is required')
		}

		// Require both toggle values - no hardcoded defaults
		if (!value1 || !value2) {
			throw new Error('value1 and value2 are required for toggle operation (no default values)')
		}

		// Schema is automatically detected from the entity's @schema property in updateEntityGeneric

		// Check if Jazz AccountCoState is available - fail fast if not (clean CoState pattern)
		const accountCoState = data._jazzAccountCoState as any
		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		// Get the current account from CoState
		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not loaded')
		}

		// Use Jazz to update entity
		try {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'toggleStatus:start',message:'Toggle status starting',data:{id,statusField,value1,value2,hasAccount:!!jazzAccount,accountLoaded:jazzAccount?.$isLoaded},timestamp:Date.now(),sessionId:'debug-session',runId:'toggle',hypothesisId:'R'})}).catch(()=>{});
			// #endregion
			
			// Find entity in already-loaded root.entities (clean CoState pattern - no manual loading)
			const root = jazzAccount.root
			if (!root?.$isLoaded) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'toggleStatus:root-not-loaded',message:'Root not loaded',data:{id,hasRoot:!!root},timestamp:Date.now(),sessionId:'debug-session',runId:'toggle',hypothesisId:'R'})}).catch(()=>{});
				// #endregion
				throw new Error('Account root not loaded')
			}

			const entitiesList = root.entities
			if (!entitiesList?.$isLoaded) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'toggleStatus:entities-not-loaded',message:'Entities list not loaded',data:{id,hasEntities:!!entitiesList},timestamp:Date.now(),sessionId:'debug-session',runId:'toggle',hypothesisId:'R'})}).catch(()=>{});
				// #endregion
				throw new Error('Entities list not loaded')
			}

			// Find the entity by ID in the already-loaded list
			// Try multiple ID access patterns for robustness
			let coValue: any = null
			const entityIds: string[] = [] // For debug logging
			
			for (const entity of entitiesList) {
				if (!entity?.$isLoaded) continue
				
				// Try multiple ID access patterns (direct property first, then $jazz)
				const entityId = entity.id || entity.$jazz?.id
				entityIds.push(entityId || 'unknown')
				
				if (entityId === id) {
					coValue = entity
					break
				}
			}

			if (!coValue) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'toggleStatus:covalue-not-found',message:'CoValue not found in entities list',data:{id,entitiesCount:entitiesList.length,entityIds:entityIds.slice(0,5),targetId:id},timestamp:Date.now(),sessionId:'debug-session',runId:'toggle',hypothesisId:'S'})}).catch(()=>{});
				// #endregion
				throw new Error(`Entity not found for ID: ${id}`)
			}

			// Get current status from CoValue (try direct access or snapshot)
			let currentStatus = (coValue as any)[statusField]
			if (!currentStatus) {
				try {
					const snapshot = coValue.$jazz?.raw?.toJSON?.() || coValue.toJSON?.()
					if (snapshot && typeof snapshot === 'object') {
						currentStatus = (snapshot as any)[statusField]
					}
				} catch (_e) {
					// Fallback to value1 if status field doesn't exist
					currentStatus = value1
				}
			}
			// Toggle between value1 and value2
			const newStatus = currentStatus === value2 ? value1 : value2

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'toggleStatus:status-determined',message:'Status toggle determined',data:{id,currentStatus,newStatus,statusField},timestamp:Date.now(),sessionId:'debug-session',runId:'toggle',hypothesisId:'Q'})}).catch(()=>{});
			// #endregion

			// Update using generic UPDATE function
			await updateEntityGeneric(jazzAccount, coValue, { [statusField]: newStatus })

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'toggleStatus:success',message:'Toggle completed successfully',data:{id,newStatus,statusField},timestamp:Date.now(),sessionId:'debug-session',runId:'toggle',hypothesisId:'Q'})}).catch(()=>{});
			// #endregion

			// Subscription will update data.queries automatically
		} catch (error) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'toggleStatus:error',message:'Toggle failed with error',data:{id,error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'toggle',hypothesisId:'Q'})}).catch(()=>{});
			// #endregion
			throw error // Re-throw to surface the error
		}
	},
}

const clearEntitiesSkill: Skill = {
	metadata: {
		id: '@entity/clearEntities',
		name: 'Clear Entities',
		description: 'Clears all entities of a specific schema type from the list',
		category: 'entity',
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
					description: 'The query key in data.queries (e.g., "todos", "humans")',
					required: true,
				},
			},
			required: ['schemaName', 'queryKey'],
		},
	},
	execute: async (data: Data, payload?: unknown) => {
		const payloadData = (payload as {
			schemaName?: string
			queryKey?: string
		}) || {}
		// Get schemaName from payload (required)
		const schemaName = payloadData.schemaName
		// Get queryKey from payload or infer from schemaName
		let queryKey = payloadData.queryKey

		if (!schemaName) {
			throw new Error('schemaName is required in payload')
		}

		// Infer queryKey from schemaName if not provided (e.g., 'Todo' -> 'todos')
		if (!queryKey) {
			queryKey = `${schemaName.toLowerCase()}s` // 'Todo' -> 'todos', 'Human' -> 'humans'
		}

		// Ensure data.queries exists
		if (!data.queries) data.queries = {}

		const queries = data.queries as Data

		// Check if Jazz AccountCoState is available - fail fast if not (clean CoState pattern)
		const accountCoState = data._jazzAccountCoState as any
		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		// Get the current account from CoState
		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not loaded')
		}

		// Use generic DELETE function to delete all entities
		try {
			const entities = (queries[queryKey] as Array<{ id?: string }>) || []
			// Delete all entities from Jazz
			for (const entity of entities) {
				if (entity.id) {
					try {
						await deleteEntityGeneric(jazzAccount, entity.id)
					} catch (error) {
						// Log error but continue with next entity
						console.error(`Failed to delete ${schemaName} entity ${entity.id}:`, error)
					}
				}
			}
			// Subscription will update data.queries automatically
		} catch (error) {
			throw error // Re-throw to surface the error
		}
	},
}

// ========== UI SKILLS (Generic) ==========

const updateInputSkill: Skill = {
	metadata: {
		id: '@ui/updateInput',
		name: 'Update Input',
		description: 'Updates the input field value',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				text: {
					type: 'string',
					description: 'The new input text value',
					required: true,
				},
				fieldPath: {
					type: 'string',
					description: 'Data path to update (default: "view.newTodoText")',
					required: false,
				},
			},
			required: ['text'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		const payloadData = (payload as {
			text?: string
			fieldPath?: string // Data path to update (e.g., "view.newTodoText")
		}) || {}

		const text = payloadData.text
		const fieldPath = payloadData.fieldPath || 'view.newTodoText' // Default for backward compatibility

		if (text === undefined) return

		// Navigate to the target field
		const pathParts = fieldPath.split('.')
		let target: Data = data
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i]
			if (!target[part]) {
				target[part] = {}
			}
			target = target[part] as Data
		}

		// Set the field value
		const finalKey = pathParts[pathParts.length - 1]
		target[finalKey] = text

		// Create new object reference to ensure reactivity
		if (data.view) {
			data.view = { ...(data.view as Data) }
		}
	},
}

const clearInputSkill: Skill = {
	metadata: {
		id: '@ui/clearInput',
		name: 'Clear Input',
		description: 'Clears the input field',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				fieldPath: {
					type: 'string',
					description: 'Data path to clear (default: "view.newTodoText")',
					required: false,
				},
			},
		},
	},
	execute: (data: Data, payload?: unknown) => {
		const payloadData = (payload as {
			fieldPath?: string // Data path to clear (e.g., "view.newTodoText")
		}) || {}

		const fieldPath = payloadData.fieldPath || 'view.newTodoText' // Default for backward compatibility

		// Navigate to the target field
		const pathParts = fieldPath.split('.')
		let target: Data = data
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i]
			if (!target[part]) {
				target[part] = {}
			}
			target = target[part] as Data
		}

		// Clear the field
		const finalKey = pathParts[pathParts.length - 1]
		target[finalKey] = ''

		// Create new object reference to ensure reactivity
		if (data.view) {
			data.view = { ...(data.view as Data) }
		}
	},
}

const swapViewNodeSkill: Skill = {
	metadata: {
		id: '@ui/swapViewNode',
		name: 'Swap View Node',
		description: 'Swaps any view node config (composite or leaf) by ID. Generic universal action for config swapping.',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				nodeId: {
					type: 'string',
					description: 'The ID of the view node (composite or leaf) to swap to',
					required: true,
				},
				targetPath: {
					type: 'string',
					description: 'The data path where the node ID should be stored (e.g., "view.contentNodeId")',
					required: true,
				},
				nodeType: {
					type: 'string',
					description: 'Optional type hint: "composite" or "leaf" (auto-detected if omitted)',
					required: false,
				},
			},
			required: ['nodeId', 'targetPath'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		const { nodeId, targetPath, nodeType } = (payload as {
			nodeId?: string
			targetPath?: string
			nodeType?: 'composite' | 'leaf'
		}) || {}

		if (!nodeId || !targetPath) return

		const pathParts = targetPath.split('.')

		// Navigate to the target object
		let target: Data = data
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i]
			if (!target[part]) {
				target[part] = {}
			}
			target = target[part] as Data
		}

		// Set the node ID
		const finalKey = pathParts[pathParts.length - 1]
		target[finalKey] = nodeId

		// Create new object reference to ensure reactivity
		// Deep copy nested objects to ensure reactivity
		if (data.view) {
			data.view = { ...(data.view as Data) }
		}
	},
}

const setViewSkill: Skill = {
	metadata: {
		id: '@ui/setView',
		name: 'Set View',
		description: 'Sets the view mode and swaps the content composite (list, kanban, timeline)',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				viewMode: {
					type: 'string',
					description: 'The view mode to set (list, kanban, timeline)',
					required: true,
				},
			},
			required: ['viewMode'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.view exists
		if (!data.view) data.view = {}

		const view = data.view as Data
		const viewMode = (payload as { viewMode?: string })?.viewMode
		if (!viewMode || !['list', 'kanban', 'timeline'].includes(viewMode)) return

		// Map viewMode to composite ID
		const compositeIdMap: Record<string, string> = {
			list: 'todo.composite.content.list',
			kanban: 'todo.composite.content.kanban',
			timeline: 'todo.composite.content.timeline',
		}

		const compositeId = compositeIdMap[viewMode]
		if (compositeId) {
			// Use the generic swapViewNode action internally
			swapViewNodeSkill.execute(data, {
				nodeId: compositeId,
				targetPath: 'view.contentCompositeId',
				nodeType: 'composite',
			})
			// Also update viewMode for button visibility
			view.viewMode = viewMode
			// Create new object reference to ensure reactivity
			data.view = { ...view }
		}
	},
}

const openModalSkill: Skill = {
	metadata: {
		id: '@ui/openModal',
		name: 'Open Modal',
		description: 'Opens a modal with the selected entity details',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'The ID of the entity to display in the modal',
					required: true,
				},
				queryKey: {
					type: 'string',
					description: 'Query key to search (default: "todos")',
					required: false,
				},
				entityField: {
					type: 'string',
					description: 'Field name in view to store entity (default: "selectedTodo")',
					required: false,
				},
			},
			required: ['id'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.queries and data.view exist
		if (!data.queries) data.queries = {}
		if (!data.view) data.view = {}

		const payloadData = (payload as {
			id?: string
			queryKey?: string // Query key to search (e.g., "todos", "humans")
			entityField?: string // Field name in view to store entity (e.g., "selectedTodo", "selectedHuman")
		}) || {}

		const id = payloadData.id
		const queryKey = payloadData.queryKey || 'todos' // Default for backward compatibility
		const entityField = payloadData.entityField || 'selectedTodo' // Default for backward compatibility

		if (!id) return

		const queries = data.queries as Data
		const view = data.view as Data

		// Search for entity in the specified query
		if (queries[queryKey]) {
			const entities = (queries[queryKey] as Array<{ id: string }>) || []
			const entity = entities.find((e) => e.id === id)
			if (entity) {
				(view as any)[entityField] = entity
				view.showModal = true
				// Create new object reference to ensure reactivity
				data.view = { ...view }
			}
		}
	},
}

const closeModalSkill: Skill = {
	metadata: {
		id: '@ui/closeModal',
		name: 'Close Modal',
		description: 'Closes the modal',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				entityField: {
					type: 'string',
					description: 'Field name in view to clear (default: "selectedTodo")',
					required: false,
				},
			},
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.view exists
		if (!data.view) data.view = {}

		const payloadData = (payload as {
			entityField?: string // Field name in view to clear (e.g., "selectedTodo", "selectedHuman")
		}) || {}

		const entityField = payloadData.entityField || 'selectedTodo' // Default for backward compatibility

		const view = data.view as Data
		;(view as any).showModal = false
		;(view as any)[entityField] = null
		// Create new object reference to ensure reactivity
		data.view = { ...view }
	},
}

// ========== VALIDATION SKILL (Generic) ==========

const validateEntityInputSkill: Skill = {
	metadata: {
		id: '@entity/validateInput',
		name: 'Validate Entity Input',
		description: 'Validates that input text is not empty',
		category: 'entity',
		parameters: {
			type: 'object',
			properties: {
				text: {
					type: 'string',
					description: 'The text to validate',
					required: false,
				},
				inputPath: {
					type: 'string',
					description: 'Data path to input field (default: "view.newTodoText")',
					required: false,
				},
				errorMessage: {
					type: 'string',
					description: 'Custom error message (default: "Input text cannot be empty")',
					required: false,
				},
			},
		},
	},
	execute: (data: Data, payload?: unknown) => {
		if (!data.view) data.view = {}
		const view = data.view as Data
		const payloadData = (payload as {
			text?: string
			inputPath?: string // Data path to input field (e.g., "view.newTodoText")
			errorMessage?: string // Custom error message
		}) || {}

		const { text, inputPath = 'view.newTodoText', errorMessage = 'Input text cannot be empty' } = payloadData

		// Get text from payload or data path
		let inputText = text
		if (!inputText) {
			const pathParts = inputPath.split('.')
			let target: unknown = data
			for (const part of pathParts) {
				if (target && typeof target === 'object' && part in target) {
					target = (target as Record<string, unknown>)[part]
				} else {
					target = ''
					break
				}
			}
			inputText = (typeof target === 'string' ? target : '') || ''
		}

		if (!inputText || !inputText.trim()) {
			view.error = errorMessage
			data.view = { ...view }
			return
		}
		view.error = null
		data.view = { ...view }
	},
}

// ========== SKILL EXPORTS ==========

/**
 * All generic entity-related skills
 * Using npm-style scoped names: @scope/skillName
 * 
 * Schema Detection:
 * - CREATE: Requires schemaName in payload - entity doesn't exist yet
 * - UPDATE/DELETE/TOGGLE: Schema automatically detected from entity's @schema property
 * - CLEAR: Requires schemaName in payload - needs to know which query to clear
 */
export const entitySkills: Record<string, Skill> = {
	// Entity CRUD skills
	'@entity/createEntity': createEntitySkill, // Requires schemaName
	'@entity/updateEntity': updateEntitySkill, // Auto-detects schema from @schema
	'@entity/deleteEntity': deleteEntitySkill, // Auto-detects schema from @schema
	'@entity/toggleStatus': toggleEntityStatusSkill, // Auto-detects schema from @schema
	'@entity/clearEntities': clearEntitiesSkill, // Requires schemaName
	'@entity/validateInput': validateEntityInputSkill,
	// UI skills
	'@ui/updateInput': updateInputSkill,
	'@ui/clearInput': clearInputSkill,
	'@ui/swapViewNode': swapViewNodeSkill,
	'@ui/setView': setViewSkill,
	'@ui/openModal': openModalSkill,
	'@ui/closeModal': closeModalSkill,
}
