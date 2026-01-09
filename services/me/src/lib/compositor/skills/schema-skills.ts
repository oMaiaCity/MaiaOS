/**
 * Schema Skills - Universal schema type creation
 * 
 * ONE universal skill for creating schema types (Entity or Relation)
 * Configurable interface - no convenience wrappers
 */

import type { Data } from '../dataStore'
import type { Skill } from './types'
import { ensureSchema } from '@maia/db'

// ========== UNIVERSAL SCHEMA CREATION SKILL ==========

const createSchemaTypeSkill: Skill = {
	metadata: {
		id: '@schema/createSchemaType',
		name: 'Create Schema Type',
		description: 'Creates a new schema type (Entity or Relation) with a configurable interface',
		category: 'schema',
		parameters: {
			type: 'object',
			properties: {
				schemaName: {
					type: 'string',
					description: 'Name of the schema (e.g., "Human", "Todo", "AssignedTo")',
					required: true,
				},
				schemaType: {
					type: 'string',
					description: 'Type of schema: "Entity" or "Relation"',
					enum: ['Entity', 'Relation'],
					required: true,
				},
				jsonSchema: {
					type: 'object',
					description: 'JSON Schema definition object. For Relation types, position descriptions should be embedded in the JSON Schema properties as `description` fields.',
					required: true,
				},
			},
			required: ['schemaName', 'schemaType', 'jsonSchema'],
		},
	},
	execute: async (data: Data, payload?: unknown) => {
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

		// Get account from data
		const account = data._jazzAccountCoState?.current
		if (!account || !account.$isLoaded) {
			throw new Error('Account is not loaded')
		}

		// Ensure schema exists (creates SchemaDefinition CoValue if needed)
		const schemaDefinition = await ensureSchema(account, schemaName, jsonSchema)

		// Ensure schema definition is loaded
		await schemaDefinition.$jazz.ensureLoaded()

		// Set the type property on the SchemaDefinition ('Entity' or 'Relation')
		schemaDefinition.$jazz.set('type', schemaType)
		await schemaDefinition.$jazz.waitForSync()

		// For Relation types, position descriptions are embedded in the JSON Schema definition itself
		// (as `description` fields in the properties), NOT set as separate flattened properties
		// This matches the Entity schema pattern - all metadata is in the JSON Schema

		return schemaDefinition
	},
}

// Export skills config
export const schemaSkills = {
	'@schema/createSchemaType': createSchemaTypeSkill,
}




