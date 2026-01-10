/**
 * Hardcoded JSON Schema Registry
 * 
 * Central registry for all JSON Schema definitions.
 * Currently hardcoded, will be migrated to pull from schemata co.list in future iteration.
 * 
 * This registry maps schema names to their JSON Schema definitions.
 */

import { humanEntityTypeSchema, todoEntityTypeSchema, chatMessageEntityTypeSchema, actorEntityTypeSchema, vibesRegistryEntityTypeSchema } from './data/entity-types.js'
import { assignedToRelationTypeSchema } from './data/relation-types.js'
import { leafTypeSchemas } from './data/leaf-types.js'
import { compositeTypeSchemas } from './data/composite-types.js'

// Registry mapping schema names to JSON Schema definitions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const schemaRegistry: Record<string, any> = {
	Human: humanEntityTypeSchema,
	Todo: todoEntityTypeSchema,
	ChatMessage: chatMessageEntityTypeSchema,
	Actor: actorEntityTypeSchema,
	VibesRegistry: vibesRegistryEntityTypeSchema,
	AssignedTo: assignedToRelationTypeSchema,
	// Leaf types (design system components)
	...leafTypeSchemas,
	// Composite types (design system components)
	...compositeTypeSchemas,
}

/**
 * Get JSON Schema for a schema name
 * 
 * @param schemaName - Name of the schema (e.g., "Human", "Todo", "AssignedTo")
 * @returns JSON Schema definition or null if not found
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getJsonSchema(schemaName: string): any | null {
	return schemaRegistry[schemaName] || null
}

/**
 * Register a JSON Schema for a schema name
 * For future use when migrating to dynamic schema loading from schemata co.list
 * 
 * @param schemaName - Name of the schema
 * @param jsonSchema - JSON Schema definition
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerJsonSchema(schemaName: string, jsonSchema: any): void {
	schemaRegistry[schemaName] = jsonSchema
}

/**
 * Check if a schema is registered
 * 
 * @param schemaName - Name of the schema
 * @returns true if schema is registered, false otherwise
 */
export function hasSchema(schemaName: string): boolean {
	return schemaName in schemaRegistry
}

/**
 * Get all registered schema names
 * 
 * @returns Array of registered schema names
 */
export function getRegisteredSchemaNames(): string[] {
	return Object.keys(schemaRegistry)
}

