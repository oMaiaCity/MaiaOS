/**
 * Entity Skills - Generic CRUD operations for any entity type
 * Works with any schema (Todo, Human, ASSIGNED_TO, etc.)
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
					description: 'The schema name (e.g., "Todo", "Human", "ASSIGNED_TO")',
					required: true,
				},
				entityData: {
					type: 'object',
					description: 'The entity data to create',
					required: true,
				},
			},
			required: ['schemaName', 'entityData'],
		},
	},
	execute: async (data: Data, payload?: unknown) => {
		console.log('[createEntity] ENTRY - payload:', payload)
		
		// Get schemaName from payload (required)
		const payloadData = (payload as {
			schemaName?: string
			entityData?: Record<string, unknown>
			text?: string // For Todo schema - text can be passed directly
		}) || {}
		const schemaName = payloadData.schemaName

		console.log('[createEntity] schemaName:', schemaName, 'payloadData:', payloadData)

		if (!schemaName) {
			console.error('[createEntity] ERROR: schemaName is required in payload')
			throw new Error('schemaName is required in payload')
		}

		// Build entityData - handle schema-specific logic
		let entityData: Record<string, unknown> = payloadData.entityData || {}

		console.log('[createEntity] Initial entityData:', entityData, 'schemaName:', schemaName)

		// Human-specific: If schemaName is 'Human' and no entityData provided, generate random human
		if (schemaName === 'Human' && !payloadData.entityData) {
			console.log('[createEntity] Generating random Human data...')
			// Generate random first and last names
			const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Ruby', 'Sam', 'Tina']
			const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee']
			
			const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
			const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
			const name = `${firstName} ${lastName}`
			
			// Generate random email
			const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`
			
			// Generate random date of birth (between 18-80 years ago)
			const now = new Date()
			const yearsAgo = Math.floor(Math.random() * (80 - 18 + 1)) + 18
			const dateOfBirth = new Date(now.getFullYear() - yearsAgo, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)

			entityData = {
				name,
				email,
				dateOfBirth: dateOfBirth, // Pass Date object - Zod z.date() expects Date, not string
			}
			console.log('[createEntity] Generated Human entityData:', entityData)
		}
		// Todo-specific: If schemaName is 'Todo' and text is provided, build entityData
		else if (schemaName === 'Todo' && payloadData.text) {
			const text = payloadData.text.trim()
			if (!text) {
				if (!data.view) data.view = {}
				const view = data.view as Data
				view.error = 'Todo text cannot be empty'
				data.view = { ...view }
				return
			}

			// Generate random endDate between now and 7 days
			const now = new Date()
			const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
			const randomTime = now.getTime() + Math.random() * (sevenDaysFromNow.getTime() - now.getTime())
			const endDate = new Date(randomTime)

			// Generate random duration between 1 and 8 hours (in minutes)
			const duration = Math.floor(Math.random() * 8 * 60) + 60

			entityData = {
				text,
				status: 'todo',
				endDate: endDate.toISOString(),
				duration,
			}

			// Clear input after successful creation
			if (!data.view) data.view = {}
			const view = data.view as Data
			view.newTodoText = ''
			view.error = null
			data.view = { ...view }
		} else if (schemaName === 'Todo' && !payloadData.entityData) {
			// Try to get text from view.newTodoText
			if (!data.view) data.view = {}
			const view = data.view as Data
			const text = (view.newTodoText as string) || ''
			if (!text.trim()) {
				view.error = 'Todo text cannot be empty'
				data.view = { ...view }
				return
			}

			// Generate random endDate between now and 7 days
			const now = new Date()
			const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
			const randomTime = now.getTime() + Math.random() * (sevenDaysFromNow.getTime() - now.getTime())
			const endDate = new Date(randomTime)

			// Generate random duration between 1 and 8 hours (in minutes)
			const duration = Math.floor(Math.random() * 8 * 60) + 60

			entityData = {
				text: text.trim(),
				status: 'todo',
				endDate: endDate.toISOString(),
				duration,
			}

			// Clear input after successful creation
			view.newTodoText = ''
			view.error = null
			data.view = { ...view }
		}

		console.log('[createEntity] Final entityData before validation:', entityData)

		if (!entityData || Object.keys(entityData).length === 0) {
			console.error('[createEntity] ERROR: entityData is required')
			throw new Error('entityData is required')
		}

		// Check if Jazz is available - fail fast if not
		const jazzAccount = data._jazzAccount as any
		console.log('[createEntity] Jazz account check:', {
			hasJazzAccount: !!jazzAccount,
			isLoaded: jazzAccount?.$isLoaded,
		})

		if (!jazzAccount || !jazzAccount.$isLoaded) {
			console.error('[createEntity] ERROR: Jazz account not available')
			if (!data.view) data.view = {}
			const view = data.view as Data
			view.error = 'Jazz account not available'
			data.view = { ...view }
			return
		}

		// Use generic CREATE function
		try {
			console.log('[createEntity] Calling createEntityGeneric with:', { schemaName, entityData })
			const result = await createEntityGeneric(jazzAccount, schemaName, entityData)
			console.log('[createEntity] SUCCESS - Created entity:', result?.$jazz?.id)
			// Subscription will update data.queries automatically
		} catch (error) {
			console.error('[createEntity] ERROR in createEntityGeneric:', error)
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

		// Check if Jazz is available - fail fast if not
		const jazzQueryManager = data._jazzQueryManager as any
		const jazzAccount = data._jazzAccount as any
		if (!jazzQueryManager || !jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account or query manager not available')
		}

		// Use Jazz to update entity
		try {
			// Get CoValue from entityMap first
			let coValue = jazzQueryManager.getCoValueById(id)

			// If not found in cache, try to load it directly from the account/node
			if (!coValue) {
				const node = (jazzAccount as any).$jazz?.raw?.core?.node || (jazzAccount as any).$jazz?.raw?.node
				if (node) {
					const loadedCoValue = await node.load(id as any)
					if (loadedCoValue !== 'unavailable') {
						coValue = loadedCoValue
					}
				}
			}

			if (!coValue) {
				throw new Error(`CoValue not found for ID: ${id}`)
			}

			// Ensure CoValue is fully loaded
			await coValue.$jazz.ensureLoaded({
				resolve: {},
			})

			// Update using generic UPDATE function
			await updateEntityGeneric(jazzAccount, coValue, finalUpdates)

			// Subscription will update data.queries automatically
		} catch (error) {
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

		// Check if Jazz is available - fail fast if not
		const jazzAccount = data._jazzAccount as any
		if (!jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account not available')
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
					description: 'First status value (default: "todo")',
					required: false,
				},
				value2: {
					type: 'string',
					description: 'Second status value (default: "done")',
					required: false,
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
			value1?: string
			value2?: string
		}) || {}

		if (!id) {
			throw new Error('id is required')
		}

		// Set default toggle values (schema-specific logic can be added later if needed)
		const finalValue1 = value1 || 'todo'
		const finalValue2 = value2 || 'done'

		// Schema is automatically detected from the entity's @schema property in updateEntityGeneric

		// Check if Jazz is available - fail fast if not
		const jazzQueryManager = data._jazzQueryManager as any
		const jazzAccount = data._jazzAccount as any
		if (!jazzQueryManager || !jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account or query manager not available')
		}

		// Use Jazz to update entity
		try {
			// Get CoValue from entityMap first
			let coValue = jazzQueryManager.getCoValueById(id)

			// If not found in cache, try to load it directly from the account/node
			if (!coValue) {
				const node = (jazzAccount as any).$jazz?.raw?.core?.node || (jazzAccount as any).$jazz?.raw?.node
				if (node) {
					const loadedCoValue = await node.load(id as any)
					if (loadedCoValue !== 'unavailable') {
						coValue = loadedCoValue
					}
				}
			}

			if (!coValue) {
				throw new Error(`CoValue not found for ID: ${id}`)
			}

			// Ensure CoValue is fully loaded
			await coValue.$jazz.ensureLoaded({
				resolve: {},
			})

			// Get current status from CoValue (try direct access or snapshot)
			let currentStatus = (coValue as any)[statusField]
			if (!currentStatus) {
				try {
					const snapshot = coValue.$jazz?.raw?.toJSON?.() || coValue.toJSON?.()
					if (snapshot && typeof snapshot === 'object') {
						currentStatus = (snapshot as any)[statusField]
					}
				} catch (_e) {
					// Fallback to default
				}
			}
			currentStatus = currentStatus || finalValue1
			const newStatus = currentStatus === finalValue2 ? finalValue1 : finalValue2

			// Update using generic UPDATE function
			await updateEntityGeneric(jazzAccount, coValue, { [statusField]: newStatus })

			// Subscription will update data.queries automatically
		} catch (error) {
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

		// Check if Jazz is available - fail fast if not
		const jazzQueryManager = data._jazzQueryManager as any
		const jazzAccount = data._jazzAccount as any
		if (!jazzQueryManager || !jazzAccount || !jazzAccount.$isLoaded) {
			throw new Error('Jazz account or query manager not available')
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
			},
			required: ['text'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.view exists
		if (!data.view) data.view = {}

		const text = (payload as { text?: string })?.text
		if (text !== undefined) {
			// Create new view object with updated text
			data.view = {
				...(data.view as Data),
				newTodoText: text,
			}
		}
	},
}

const clearInputSkill: Skill = {
	metadata: {
		id: '@ui/clearInput',
		name: 'Clear Input',
		description: 'Clears the input field',
		category: 'ui',
	},
	execute: (data: Data) => {
		// Ensure data.view exists and create new reference
		if (!data.view) {
			data.view = { newTodoText: '' }
		} else {
			// Create new view object with cleared input
			data.view = {
				...(data.view as Data),
				newTodoText: '',
			}
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
			},
			required: ['id'],
		},
	},
	execute: (data: Data, payload?: unknown) => {
		// Ensure data.queries and data.view exist
		if (!data.queries) data.queries = {}
		if (!data.view) data.view = {}

		const queries = data.queries as Data
		const view = data.view as Data
		const id = (payload as { id?: string })?.id
		if (!id) return

		// Try to find entity in todos (for backward compatibility)
		// In future, this could be made more generic
		if (queries.todos) {
			const todos = (queries.todos as Array<{ id: string }>) || []
			const entity = todos.find((t) => t.id === id)
			if (entity) {
				view.selectedTodo = entity
				view.showModal = true
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
	},
	execute: (data: Data) => {
		// Ensure data.view exists
		if (!data.view) data.view = {}

		const view = data.view as Data
		view.showModal = false
		view.selectedTodo = null
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
			},
		},
	},
	execute: (data: Data, payload?: unknown) => {
		if (!data.view) data.view = {}
		const view = data.view as Data
		const { text, inputPath = 'view.newTodoText' } = (payload as {
			text?: string
			inputPath?: string
		}) || {}

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
			view.error = 'Input text cannot be empty'
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
