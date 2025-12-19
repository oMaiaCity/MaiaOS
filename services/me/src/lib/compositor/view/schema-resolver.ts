/**
 * Schema Resolver - Pre-render layer for schema resolution
 * 
 * Converts schema instances (with @schema + parameters) to regular LeafNodes and CompositeConfigs
 * Render engine never sees @schema or parameters - only regular nodes
 */

import type { LeafNode } from './leaf-types'
import type { CompositeConfig } from './types'
import { getJsonSchema } from '@hominio/db'

/**
 * Resolve schema instance to regular LeafNode
 * This happens BEFORE rendering - render engine never sees @schema
 * 
 * Separation:
 * - Input: Schema instance (has @schema + parameters)
 * - Output: Regular LeafNode (no schema info)
 * 
 * Note: Currently uses hardcoded registry only - no CoValue creation yet
 */
export function resolveSchemaLeaf(leaf: LeafNode): LeafNode {
	// If no @schema, it's already a regular leaf - return as-is
	if (!leaf['@schema']) return leaf

	// Extract schema name from @schema reference
	// For now, @schema is just a string schema name (e.g., "design-system.title")
	// Future: Will be CoValue reference
	const schemaName = typeof leaf['@schema'] === 'string' 
		? leaf['@schema'] 
		: extractSchemaName(leaf['@schema'])

	// Look up schema from hardcoded registry only
	// No CoValue creation - schemas are hardcoded (not stored in Jazz yet)
	const jsonSchema = getJsonSchema(schemaName)
	if (!jsonSchema) {
		console.error(`Schema not found in registry: ${schemaName}. Available schemas:`, Object.keys(require('@hominio/db').getRegisteredSchemaNames?.() || {}))
		// Return a fallback leaf with tag to avoid "No leaf definition" error
		return {
			...leaf,
			tag: 'div',
			classes: leaf.classes || '',
			elements: [`Schema not found: ${schemaName}`],
		}
	}

	// Extract definition and parameterSchema from hardcoded schema
	const definition = jsonSchema.definition // LeafNode structure
	const parameterSchema = jsonSchema.parameterSchema // Full JSON Schema

	if (!definition) {
		console.error(`Schema missing definition: ${schemaName}`, jsonSchema)
		// Return a fallback leaf with tag to avoid "No leaf definition" error
		return {
			...leaf,
			tag: 'div',
			classes: leaf.classes || '',
			elements: [`Schema missing definition: ${schemaName}`],
		}
	}

	// Validate parameters against full JSON Schema specification
	if (parameterSchema) {
		validateParameters(leaf.parameters || {}, parameterSchema)
	}

	// Merge defaults from JSON Schema into parameters
	const finalParams = mergeDefaults(leaf.parameters || {}, parameterSchema)

	// Resolve schema with parameters → regular LeafNode (no @schema, no parameters)
	return resolveSchema(definition, finalParams)
}

function validateParameters(parameters: Record<string, string>, parameterSchema: any): void {
	// Basic validation - check required fields
	// TODO: Add full JSON Schema validation with ajv when available
	if (parameterSchema?.required && Array.isArray(parameterSchema.required)) {
		for (const requiredParam of parameterSchema.required) {
			if (!(requiredParam in parameters)) {
				const paramDef = parameterSchema.properties?.[requiredParam]
				// If no default value, parameter is required
				if (!paramDef?.default) {
					throw new Error(`Required parameter "${requiredParam}" missing`)
				}
			}
		}
	}
	
	// Check for unknown parameters if additionalProperties is false
	if (parameterSchema?.additionalProperties === false && parameterSchema?.properties) {
		const allowedParams = Object.keys(parameterSchema.properties)
		for (const paramName of Object.keys(parameters)) {
			if (!allowedParams.includes(paramName)) {
				throw new Error(`Unknown parameter "${paramName}". Allowed parameters: ${allowedParams.join(', ')}`)
			}
		}
	}
}

function mergeDefaults(parameters: Record<string, string>, parameterSchema: any): Record<string, string> {
	const finalParams = { ...parameters }
	if (parameterSchema?.properties) {
		for (const [paramName, paramDef] of Object.entries(parameterSchema.properties)) {
			if (!(paramName in finalParams) && (paramDef as any).default) {
				finalParams[paramName] = (paramDef as any).default
			}
		}
	}
	return finalParams
}

function resolveSchema(definition: LeafNode, parameters: Record<string, string>): LeafNode {
	// Deep clone definition
	const resolved = JSON.parse(JSON.stringify(definition))

	// Replace placeholders recursively
	// Only skip @schema and parameters at the TOP LEVEL, not in nested children
	function replacePlaceholders(obj: any, isTopLevel = true): any {
		if (typeof obj === 'string') {
			return obj.replace(/\{\{(\w+)\}\}/g, (match, param) => {
				return parameters[param] || match
			})
		}
		if (Array.isArray(obj)) {
			return obj.map((item) => replacePlaceholders(item, false))
		}
		if (obj && typeof obj === 'object') {
			const result: any = {}
			for (const [key, value] of Object.entries(obj)) {
				// Only skip @schema and parameters at the TOP LEVEL (isTopLevel = true)
				// Preserve them in nested children so they can be resolved later
				if (isTopLevel && (key === '@schema' || key === 'parameters')) {
					continue
				}
				result[key] = replacePlaceholders(value, false)
			}
			return result
		}
		return obj
	}

	const resolvedLeaf = replacePlaceholders(resolved, true)
	
	// Ensure the resolved leaf has a tag (required for validation)
	if (!resolvedLeaf.tag) {
		console.error('Resolved schema leaf missing tag:', resolvedLeaf, 'from definition:', definition)
		resolvedLeaf.tag = 'div'
	}
	
	return resolvedLeaf
}

function extractSchemaName(schemaRef: any): string {
	// For now, @schema is just a string schema name
	// Future: Extract schema name from CoValue reference
	if (typeof schemaRef === 'string') {
		return schemaRef
	}
	// Future: Handle CoValue reference
	throw new Error('CoValue references not supported yet')
}

/**
 * Resolve schema instance to regular CompositeConfig
 * This happens BEFORE rendering - render engine never sees @schema
 * 
 * Separation:
 * - Input: Schema instance (has @schema + parameters)
 * - Output: Regular CompositeConfig (no schema info)
 * 
 * Note: Currently uses hardcoded registry only - no CoValue creation yet
 */
export function resolveSchemaComposite(composite: CompositeConfig): CompositeConfig {
	// If no @schema, it's already a regular composite - return as-is
	if (!composite['@schema']) return composite

	// Extract schema name from @schema reference
	const schemaName = typeof composite['@schema'] === 'string' 
		? composite['@schema'] 
		: extractSchemaName(composite['@schema'])

	// Look up schema from hardcoded registry only
	const jsonSchema = getJsonSchema(schemaName)
	if (!jsonSchema) {
		console.error(`Schema not found in registry: ${schemaName}`)
		// Return a fallback composite with container to avoid errors
		return {
			...composite,
			container: composite.container || {
				layout: 'content',
				class: '',
			},
			children: composite.children || [],
		}
	}

	// Extract definition and parameterSchema from hardcoded schema
	const definition = jsonSchema.definition // CompositeConfig structure
	const parameterSchema = jsonSchema.parameterSchema // Full JSON Schema

	if (!definition) {
		console.error(`Schema missing definition: ${schemaName}`, jsonSchema)
		// Return a fallback composite with container to avoid errors
		return {
			...composite,
			container: composite.container || {
				layout: 'content',
				class: '',
			},
			children: composite.children || [],
		}
	}

	// Validate parameters against full JSON Schema specification
	if (parameterSchema) {
		validateParameters(composite.parameters || {}, parameterSchema)
	}

	// Merge defaults from JSON Schema into parameters
	const finalParams = mergeDefaults(composite.parameters || {}, parameterSchema)

	// Resolve schema with parameters → regular CompositeConfig (no @schema, no parameters)
	return resolveCompositeSchema(definition, finalParams, composite)
}

function resolveCompositeSchema(definition: CompositeConfig, parameters: Record<string, string>, originalComposite: CompositeConfig): CompositeConfig {
	// Deep clone definition
	const resolved = JSON.parse(JSON.stringify(definition))

	// Replace placeholders recursively
	// Only skip @schema and parameters at the TOP LEVEL, not in nested children
	function replacePlaceholders(obj: any, isTopLevel = true): any {
		if (typeof obj === 'string') {
			return obj.replace(/\{\{(\w+)\}\}/g, (match, param) => {
				return parameters[param] || match
			})
		}
		if (Array.isArray(obj)) {
			return obj.map((item) => replacePlaceholders(item, false))
		}
		if (obj && typeof obj === 'object') {
			const result: any = {}
			for (const [key, value] of Object.entries(obj)) {
				// Only skip @schema and parameters at the TOP LEVEL (isTopLevel = true)
				// Preserve them in nested children so they can be resolved later
				if (isTopLevel && (key === '@schema' || key === 'parameters')) {
					continue
				}
				result[key] = replacePlaceholders(value, false)
			}
			return result
		}
		return obj
	}

	const resolvedComposite = replacePlaceholders(resolved, true)
	
	// Preserve id from original composite if provided
	if (originalComposite.id) {
		resolvedComposite.id = originalComposite.id
	}
	
	// For rootCard schema, merge children from instance into cardContainer composite
	if (originalComposite.children && originalComposite.children.length > 0) {
		// Find the cardContainer composite and merge children
		const cardContainerChild = resolvedComposite.children?.find((c: any) => c.slot === 'cardContainer')
		if (cardContainerChild && cardContainerChild.composite) {
			cardContainerChild.composite.children = originalComposite.children
		} else {
			// If no cardContainer found, use instance children directly
			resolvedComposite.children = originalComposite.children
		}
	}
	
	// Handle rootCard layout parameter - update container layout
	if (parameters.cardLayout) {
		const cardLayout = parameters.cardLayout as 'grid' | 'flex'
		if (resolvedComposite.container) {
			resolvedComposite.container.layout = cardLayout
			// Update outer container classes based on layout
			if (cardLayout === 'flex') {
				resolvedComposite.container.class = 'max-w-6xl mx-auto flex-col p-2 @xs:p-3 @sm:p-4 @md:p-6'
			} else {
				resolvedComposite.container.class = 'max-w-6xl mx-auto grid-cols-1 p-2 @xs:p-3 @sm:p-4 @md:p-6'
			}
		}
		// Update inner card container layout and classes
		const cardContainerChild = resolvedComposite.children?.find((c: any) => c.slot === 'cardContainer')
		if (cardContainerChild && cardContainerChild.composite && cardContainerChild.composite.container) {
			cardContainerChild.composite.container.layout = cardLayout
			const cardClasses = parameters.cardClasses || ''
			if (cardLayout === 'flex') {
				cardContainerChild.composite.container.class = `card p-2 @xs:p-3 @sm:p-4 @md:p-6 flex-grow flex-shrink flex-basis-0 min-h-0 flex-col ${cardClasses}`.trim()
			} else {
				cardContainerChild.composite.container.class = `card p-2 @xs:p-3 @sm:p-4 @md:p-6 grid-cols-1 grid-rows-[auto_auto_1fr] ${cardClasses}`.trim()
			}
		}
	}
	
	// Ensure the resolved composite has required properties
	if (!resolvedComposite.container) {
		console.error('Resolved schema composite missing container:', resolvedComposite, 'from definition:', definition)
		resolvedComposite.container = {
			layout: 'content',
			class: '',
		}
	}
	
	if (!resolvedComposite.children) {
		resolvedComposite.children = []
	}
	
	return resolvedComposite
}

