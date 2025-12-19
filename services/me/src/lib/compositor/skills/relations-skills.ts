/**
 * Relations Skills - Generic CRUD operations for relations
 * 
 * Separate skills for relations (don't reuse entity skills)
 * Relations are stored in root.relations CoList (separate from root.entities)
 */

import type { Data } from '../dataStore'
import type { Skill } from './types'
import {
	createRelationGeneric,
	updateRelationGeneric,
	deleteRelationGeneric,
} from '@hominio/db'

// ========== GENERIC RELATION SKILLS ==========

const createRelationSkill: Skill = {
	metadata: {
		id: '@relation/createRelation',
		name: 'Create Relation',
		description: 'Creates a new relation instance (e.g., AssignedTo)',
		category: 'relation',
		parameters: {
			type: 'object',
			properties: {
				schemaName: {
					type: 'string',
					description: 'The relation schema name (e.g., "AssignedTo")',
					required: true,
				},
				relationData: {
					type: 'object',
					description: 'The relation data to create (x1-x5 CoValue references)',
					required: true,
				},
			},
			required: ['schemaName', 'relationData'],
		},
	},
	execute: async (data: Data, payload?: unknown) => {
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

		// Get account from data
		const account = data._jazzAccountCoState?.current
		if (!account || !account.$isLoaded) {
			throw new Error('Account is not loaded')
		}

		// Create relation using generic function
		const relation = await createRelationGeneric(account, schemaName, relationData)

		return relation
	},
}

const updateRelationSkill: Skill = {
	metadata: {
		id: '@relation/updateRelation',
		name: 'Update Relation',
		description: 'Updates an existing relation instance',
		category: 'relation',
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
					description: 'Partial relation data to update (x1-x5 CoValue references)',
					required: true,
				},
			},
			required: ['relationId', 'updates'],
		},
	},
	execute: async (data: Data, payload?: unknown) => {
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

		// Get account from data
		const account = data._jazzAccountCoState?.current
		if (!account || !account.$isLoaded) {
			throw new Error('Account is not loaded')
		}

		// Load the relation CoValue by ID
		const node = (account as any).$jazz?.raw?.core?.node
		if (!node) {
			throw new Error('Cannot get LocalNode from account')
		}

		const relation = await node.load(relationId as any)
		if (relation === 'unavailable') {
			throw new Error(`Relation with ID ${relationId} is unavailable`)
		}

		// Update relation using generic function
		await updateRelationGeneric(account, relation, updates)
	},
}

const deleteRelationSkill: Skill = {
	metadata: {
		id: '@relation/deleteRelation',
		name: 'Delete Relation',
		description: 'Deletes an existing relation instance',
		category: 'relation',
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
	execute: async (data: Data, payload?: unknown) => {
		const payloadData = (payload as {
			relationId?: string
		}) || {}

		const relationId = payloadData.relationId

		if (!relationId) {
			throw new Error('relationId is required in payload')
		}

		// Get account from data
		const account = data._jazzAccountCoState?.current
		if (!account || !account.$isLoaded) {
			throw new Error('Account is not loaded')
		}

		// Delete relation using generic function
		await deleteRelationGeneric(account, relationId)
	},
}

// Export skills config
export const relationsSkills = {
	'@relation/createRelation': createRelationSkill,
	'@relation/updateRelation': updateRelationSkill,
	'@relation/deleteRelation': deleteRelationSkill,
}




