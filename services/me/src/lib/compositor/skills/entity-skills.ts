/**
 * Entity Skills - Generic CRUD operations for any entity type
 * Works with any schema (Todo, Human, AssignedTo, etc.)
 * Each skill is self-contained and can be called independently
 * Future-ready for LLM skill calls
 * 
 * JAZZ-NATIVE ARCHITECTURE:
 * - Skills accept actor: any (Jazz CoMap instance)
 * - Entity skills mutate entity CoValues directly in root.entities
 * - UI skills mutate actor.context directly
 * - All mutations are followed by Jazz sync (await actor.$jazz.waitForSync())
 */

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
		console.log('[entity-skills] @entity/createEntity - Calling createEntityGeneric:', {
			schemaName,
			entityData,
			hasJazzAccount: !!jazzAccount,
		});
		try {
			const result = await createEntityGeneric(jazzAccount, schemaName, entityData)
			console.log('[entity-skills] @entity/createEntity - Entity created successfully:', result);
			
			// Clear field in actor.context if clearFieldPath is provided
			if (payloadData.clearFieldPath) {
				const pathParts = payloadData.clearFieldPath.split('.')
				let target: any = actor.context
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
			actor.context.error = null
			
			// Sync actor context to Jazz
			await actor.$jazz.waitForSync()
			
			// Entity automatically appears in queries via Jazz reactivity
		} catch (error) {
			actor.context.error = `Failed to create ${schemaName} entity: ${error instanceof Error ? error.message : 'Unknown error'}`
			await actor.$jazz.waitForSync()
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
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		console.log('[updateEntitySkill] Received payload:', payload);
		
		const payloadData = (payload as {
			id?: string
			updates?: Record<string, unknown>
			status?: string // For convenience - status can be passed directly
			[key: string]: unknown // Allow other fields to be passed as updates
		}) || {}

		const { id, updates, status, ...otherFields } = payloadData
		
		console.log('[updateEntitySkill] Parsed:', { id, updates, status, otherFields });

		if (!id) {
			console.error('[updateEntitySkill] No ID provided');
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
		
		console.log('[updateEntitySkill] Final updates:', finalUpdates);

		if (!finalUpdates || Object.keys(finalUpdates).length === 0) {
			console.error('[updateEntitySkill] No updates provided');
			throw new Error('updates are required (provide updates object or individual fields like status)')
		}

		// Get Jazz account from accountCoState parameter
		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

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
			console.log('[updateEntitySkill] Calling updateEntityGeneric with:', { id, finalUpdates });
			await updateEntityGeneric(jazzAccount, coValue, finalUpdates)
			console.log('[updateEntitySkill] ✅ Update completed successfully');

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/0502c68d-2038-4cdc-b211-5f59eeaffa1e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'updateEntity:success',message:'Update completed successfully',data:{id,updates:finalUpdates},timestamp:Date.now(),sessionId:'debug-session',runId:'update',hypothesisId:'P'})}).catch(()=>{});
			// #endregion

			// Jazz CoState reactivity updates queries automatically
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
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const { id } = (payload as { id?: string }) || {}

		if (!id) {
			throw new Error('id is required')
		}

		// Get Jazz account from accountCoState parameter
		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not loaded')
		}

		// Use generic DELETE function
		try {
			await deleteEntityGeneric(jazzAccount, id)
			// Jazz CoState reactivity updates queries automatically
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
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
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

		// Get Jazz account from accountCoState parameter
		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

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

			// Jazz CoState reactivity updates queries automatically
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
					description: 'The query key in actor.context.queries (e.g., "todos", "humans")',
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

		// Get entities from actor.context.queries
		const queries = (actor.context.queries as any) || {}

		// Get Jazz account from accountCoState parameter
		if (!accountCoState) {
			throw new Error('Jazz AccountCoState not available')
		}

		const jazzAccount = accountCoState.current
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not loaded')
		}

		// Use generic DELETE function to delete all entities
		try {
			const queryData = queries[queryKey] || {}
			const entities = (queryData.items || queryData || []) as Array<any>
			// Delete all entities from Jazz
			for (const entity of entities) {
				const entityId = entity.id || entity.$jazz?.id
				if (entityId) {
					try {
						await deleteEntityGeneric(jazzAccount, entityId)
					} catch (error) {
						// Log error but continue with next entity
						console.error(`Failed to delete ${schemaName} entity ${entityId}:`, error)
					}
				}
			}
			// Jazz CoState reactivity updates queries automatically
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
		description: 'Updates the input field value in actor.context',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				fieldPath: {
					type: 'string',
					description: 'Field path in actor.context to update (e.g., "newTodoText")',
					required: true,
				},
				value: {
					type: 'string',
					description: 'The new value (defaults to empty string if not provided)',
					required: false,
				},
			},
			required: ['fieldPath'],
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		const payloadData = (payload as {
			fieldPath?: string
			value?: unknown
		}) || {}

		const fieldPath = payloadData.fieldPath
		const value = payloadData.value !== undefined ? payloadData.value : ''

		if (!fieldPath) return

		// Navigate to the target field in actor.context
		const pathParts = fieldPath.split('.')
		let target: any = actor.context
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i]
			if (!target[part]) {
				target[part] = {}
			}
			target = target[part]
		}

		// Set the field value
		const finalKey = pathParts[pathParts.length - 1]
		target[finalKey] = value

		// Sync to Jazz
		await actor.$jazz.waitForSync()
	},
}

const clearInputSkill: Skill = {
	metadata: {
		id: '@ui/clearInput',
		name: 'Clear Input',
		description: 'Clears the input field in actor.context',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				fieldPath: {
					type: 'string',
					description: 'Field path in actor.context to clear',
					required: true,
				},
			},
			required: ['fieldPath'],
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		const payloadData = (payload as {
			fieldPath?: string
		}) || {}

		const fieldPath = payloadData.fieldPath

		if (!fieldPath) return

		// Navigate to the target field in actor.context
		const pathParts = fieldPath.split('.')
		let target: any = actor.context
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i]
			if (!target[part]) {
				target[part] = {}
			}
			target = target[part]
		}

		// Clear the field
		const finalKey = pathParts[pathParts.length - 1]
		target[finalKey] = ''

		// Sync to Jazz
		await actor.$jazz.waitForSync()
	},
}

const swapViewNodeSkill: Skill = {
	metadata: {
		id: '@ui/swapViewNode',
		name: 'Swap View Node',
		description: 'Swaps child actor in ANY composite\'s children array (hierarchy-aware). Adds/removes actor IDs from actor.children.',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				removeId: {
					type: 'string',
					description: 'Actor ID to remove from children array',
					required: false,
				},
				addId: {
					type: 'string',
					description: 'Actor ID to add to children array',
					required: false,
				},
			},
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		const { removeId, addId } = (payload as {
			removeId?: string
			addId?: string
		}) || {}

		if (!actor.children?.$isLoaded) return

		// Remove old child
		if (removeId) {
			const index = actor.children.findIndex((id: string) => id === removeId)
			if (index !== -1) {
				actor.children.$jazz.splice(index, 1)
			}
		}

		// Add new child (if not already present)
		if (addId && !actor.children.includes(addId)) {
			actor.children.$jazz.push(addId)
		}

		// Sync to Jazz
		await actor.$jazz.waitForSync()
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
			},
			required: ['id'],
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		const payloadData = (payload as {
			id?: string
			queryKey?: string
		}) || {}

		const id = payloadData.id
		const queryKey = payloadData.queryKey || 'todos'

		console.log('[openModalSkill] Opening modal:', { id, queryKey })

		if (!id) {
			console.warn('[openModalSkill] No entity ID provided')
			return
		}

		// Find entity in actor.context.queries
		const entity = actor.context.queries?.[queryKey]?.items?.find((e: any) => {
			const entityId = e.id || e.$jazz?.id
			return entityId === id
		})

		if (!entity) {
			console.warn('[openModalSkill] Entity not found:', id, 'in query:', queryKey)
			return
		}

		// Update actor.context
		actor.context.showModal = true
		actor.context.selectedTodo = entity
		actor.context.visible = true // Make modal visible

		// Sync to Jazz
		await actor.$jazz.waitForSync()

		console.log('[openModalSkill] Modal opened, selectedTodo:', entity)
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
			properties: {},
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		console.log('[closeModalSkill] Closing modal')

		// Update actor.context
		actor.context.showModal = false
		actor.context.selectedTodo = null
		actor.context.visible = false // Hide modal

		// Sync to Jazz
		await actor.$jazz.waitForSync()

		console.log('[closeModalSkill] Modal closed')
	},
}

const toggleVisibleSkill: Skill = {
	metadata: {
		id: '@ui/toggleVisible',
		name: 'Toggle Visible',
		description: 'Toggle actor.context.visible flag',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				visible: {
					type: 'boolean',
					description: 'Explicit visible value (if not provided, toggles current value)',
					required: false,
				},
			},
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		const { visible } = (payload as { visible?: boolean }) || {}
		
		actor.context.visible = visible !== undefined ? visible : !actor.context.visible

		await actor.$jazz.waitForSync()
	},
}

const navigateSkill: Skill = {
	metadata: {
		id: '@ui/navigate',
		name: 'Navigate to Vibe',
		description: 'Navigates to a different vibe by updating browser URL. If vibe not in registry, +page.svelte will initialize it.',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				targetActorId: {
					type: 'string',
					description: 'The CoValue ID of the target vibe actor to navigate to (direct)',
					required: false,
				},
				vibeName: {
					type: 'string',
					description: 'The name of the vibe to navigate to - updates URL to trigger page navigation (e.g., "humans", "todos", "vibes")',
					required: false,
				},
			},
		},
	},
	execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
		const { targetActorId, vibeName } = payload as { targetActorId?: string; vibeName?: string };
		
		if (!targetActorId && !vibeName) {
			throw new Error('Either targetActorId or vibeName is required');
		}

		// Update browser URL and let +page.svelte handle the rest
		if (typeof window !== 'undefined' && window.location) {
			const url = new URL(window.location.href);
			
			if (targetActorId) {
				// Direct actor ID navigation
				url.searchParams.set('id', targetActorId);
				url.searchParams.delete('vibe'); // Remove legacy param
				console.log(`[navigateSkill] Navigating to actor ID: ${targetActorId}`);
			} else if (vibeName) {
				// Vibe name navigation - let +page.svelte handle initialization and loading
				url.searchParams.set('vibe', vibeName);
				url.searchParams.delete('id'); // Remove direct ID
				console.log(`[navigateSkill] Navigating to vibe: ${vibeName}`);
			}
			
			window.history.pushState({}, '', url);
			console.log(`[navigateSkill] Updated URL to: ${url.pathname}${url.search}`);
			
			// Trigger a popstate event to notify +page.svelte of the URL change
			window.dispatchEvent(new PopStateEvent('popstate'));
		}
	},
};

// ========== SET VIEW SKILL (UI) ==========

const setViewSkill: Skill = {
	metadata: {
		id: '@ui/setView',
		name: 'Set View Mode',
		description: 'Switch between list/kanban/timeline views',
		category: 'ui',
		parameters: {
			type: 'object',
			properties: {
				viewMode: {
					type: 'string',
					description: 'View mode to switch to: list, kanban, or timeline',
					required: true,
				},
			},
		},
	},
	execute: async (actor: any, payload?: unknown) => {
		const { viewMode } = (payload as { viewMode?: string }) || {};
		
		if (!viewMode || !['list', 'kanban', 'timeline'].includes(viewMode)) {
			console.warn('[setViewSkill] Invalid viewMode:', viewMode);
			return;
		}
		
		console.log('[setViewSkill] Switching to view:', viewMode);
		
		// Update root actor's currentView
		if (actor.context) {
			(actor.context as any).currentView = viewMode;
		}
		
		// Toggle visibility of content actors based on view mode
		if (actor.children?.$isLoaded) {
			const { CoState } = await import('jazz-tools/svelte');
			const { Actor } = await import('@hominio/db');
			
			for (const childId of actor.children) {
				const childCoState = new CoState(Actor, childId);
				const child = childCoState.current;
				
				if (child?.$isLoaded && child.role) {
					const shouldBeVisible = 
						(viewMode === 'list' && child.role === 'todos-list-content') ||
						(viewMode === 'kanban' && child.role === 'todos-kanban-content') ||
						(viewMode === 'timeline' && child.role === 'todos-timeline-content');
					
					if (child.context) {
						(child.context as any).visible = shouldBeVisible;
					}
					
					console.log(`[setViewSkill] ${child.role} visible:`, shouldBeVisible);
				}
			}
		}
	},
};

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
					description: 'Field path in actor.context to validate',
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
	execute: async (actor: any, payload?: unknown) => {
		const payloadData = (payload as {
			text?: string
			inputPath?: string
			errorMessage?: string
		}) || {}

		const { text, inputPath, errorMessage = 'Input text cannot be empty' } = payloadData

		// Get text from payload or actor.context path
		let inputText = text
		if (!inputText && inputPath) {
			const pathParts = inputPath.split('.')
			let target: any = actor.context
			for (const part of pathParts) {
				if (target && typeof target === 'object' && part in target) {
					target = target[part]
				} else {
					target = ''
					break
				}
			}
			inputText = (typeof target === 'string' ? target : '') || ''
		}

		if (!inputText || !inputText.trim()) {
			actor.context.error = errorMessage
			await actor.$jazz.waitForSync()
			return
		}
		
		actor.context.error = null
		await actor.$jazz.waitForSync()
	},
}

// ========== SKILL EXPORTS ==========

/**
 * All generic entity-related skills
 * Using npm-style scoped names: @scope/skillName
 * 
 * JAZZ-NATIVE ARCHITECTURE:
 * - All skills accept actor: Actor (not data: Data)
 * - Entity skills mutate entity CoValues in root.entities
 * - UI skills mutate actor.context directly
 * - All mutations followed by await actor.$jazz.waitForSync()
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
	'@ui/swapViewNode': swapViewNodeSkill, // NEW: Hierarchy-aware children array manipulation
	'@ui/setView': setViewSkill,
	'@ui/openModal': openModalSkill,
	'@ui/closeModal': closeModalSkill,
	'@ui/toggleVisible': toggleVisibleSkill, // NEW: Toggle actor visibility
	'@ui/navigate': navigateSkill, // NEW: Navigate between vibes (complete composite swap)
}
