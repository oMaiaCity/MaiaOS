/**
 * Utility to convert JSON Schema to Jazz Zod schemas
 * Supports basic types: string, number, boolean, date, enum
 * Supports Jazz CoValue types using "o-" prefix convention
 */

import { co, z } from 'jazz-tools'

/**
 * Converts a JSON Schema property definition to a Zod or CoValue schema
 *
 * @param propertySchema - JSON Schema property definition
 * @param isOptional - Whether this field is optional (from parent's required array)
 * @param extractedSchemas - Map of extracted nested CoValue schemas for direct linking
 * @returns Zod or CoValue schema equivalent
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonSchemaToZod(
	propertySchema: any,
	isOptional: boolean = false,
	extractedSchemas: Record<string, any> = {},
): any {
	if (!propertySchema || typeof propertySchema !== 'object') {
		return z.string() // Default to string for unknown types
	}

	const type = propertySchema.type
	let schema: any

	// Handle enum/literal types
	if (propertySchema.enum && Array.isArray(propertySchema.enum)) {
		schema = z.literal(propertySchema.enum)
	}
	// Handle Jazz CoValue types (o- prefix)
	else if (type?.startsWith('o-')) {
		const jazzType = type.substring(2) // Remove "o-" prefix

		switch (jazzType) {
			case 'map':
				// For direct linking, use extracted schema if available via $ref
				// Otherwise create inline (for backwards compatibility)
				if (propertySchema.$ref && extractedSchemas[propertySchema.$ref]) {
					schema = extractedSchemas[propertySchema.$ref]
				} else if (propertySchema.properties) {
					const shape: Record<string, any> = {}
					const required = propertySchema.required || []
					for (const [key, value] of Object.entries(propertySchema.properties)) {
						const fieldIsOptional = !required.includes(key)
						shape[key] = jsonSchemaToZod(value as any, fieldIsOptional, extractedSchemas)
					}
					schema = co.map(shape)
				} else {
					schema = co.map({})
				}
				break

			case 'list':
				// Convert items schema to co.list(elementType)
				if (propertySchema.items) {
					// Check if items reference an extracted schema via $ref
					if (propertySchema.items.$ref && extractedSchemas[propertySchema.items.$ref]) {
						schema = co.list(extractedSchemas[propertySchema.items.$ref])
					} else {
						const elementType = jsonSchemaToZod(propertySchema.items, false, extractedSchemas)
						schema = co.list(elementType)
					}
				} else {
					schema = co.list(z.string()) // Default to list of strings
				}
				break

			case 'feed':
				// Convert items schema to co.feed(elementType)
				if (propertySchema.items) {
					// Check if items reference an extracted schema via $ref
					if (propertySchema.items.$ref && extractedSchemas[propertySchema.items.$ref]) {
						schema = co.feed(extractedSchemas[propertySchema.items.$ref])
					} else {
						const elementType = jsonSchemaToZod(propertySchema.items, false, extractedSchemas)
						schema = co.feed(elementType)
					}
				} else {
					schema = co.feed(z.string()) // Default to feed of strings
				}
				break

			case 'image':
				schema = co.image()
				break

			case 'filestream':
				schema = co.fileStream()
				break

			case 'vector': {
				// co.vector(dimension) - requires dimension number
				// If dimension is specified in schema, use it; otherwise default to 384
				const dimension = propertySchema.dimension || propertySchema.items?.dimension || 384
				schema = (co as any).vector ? (co as any).vector(dimension) : z.string()
				break
			}

			case 'text':
				schema = co.plainText()
				break

			case 'richText':
				schema = co.richText()
				break

			default:
				schema = z.string() // Default fallback
		}
	}
	// Handle standard JSON Schema types
	else {
		switch (type) {
			case 'string':
				schema = z.string()
				break
			case 'number':
			case 'integer':
				schema = z.number()
				break
			case 'boolean':
				schema = z.boolean()
				break
			case 'date':
			case 'date-time':
				schema = z.date()
				break
			case 'array':
				// For arrays, try to get items schema
				if (propertySchema.items) {
					schema = z.array(jsonSchemaToZod(propertySchema.items, false, extractedSchemas))
				} else {
					schema = z.array(z.string()) // Default array of strings
				}
				break
			case 'object':
				// For nested objects, create a passthrough object
				if (propertySchema.properties) {
					const shape: Record<string, any> = {}
					const required = propertySchema.required || []
					for (const [key, value] of Object.entries(propertySchema.properties)) {
						const fieldIsOptional = !required.includes(key)
						shape[key] = jsonSchemaToZod(value as any, fieldIsOptional)
					}
					schema = z.object(shape).passthrough()
				} else {
					schema = z.object({}).passthrough()
				}
				break
			default:
				schema = z.string() // Default to string for unknown types
		}
	}

	// Handle optional wrapping
	if (isOptional) {
		// Use co.optional() for CoValue types, z.optional() for Zod types
		// Check if the original type was a Jazz CoValue type (o- prefix)
		const isCoValueType = type?.startsWith('o-')

		if (isCoValueType) {
			return co.optional(schema)
		}
		return z.optional(schema)
	}

	return schema
}

/**
 * Creates a Zod object schema from a JSON Schema definition
 *
 * @param jsonSchema - Complete JSON Schema object definition
 * @returns Zod object schema
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonSchemaToZodObject(jsonSchema: any): any {
	if (!jsonSchema || jsonSchema.type !== 'object') {
		throw new Error('JSON Schema must be an object type')
	}

	if (!jsonSchema.properties) {
		return z.object({})
	}

	const shape: Record<string, any> = {}
	for (const [key, value] of Object.entries(jsonSchema.properties)) {
		shape[key] = jsonSchemaToZod(value as any)
	}

	return z.object(shape)
}
