/**
 * CompositeType JSON Schema Definitions
 * 
 * Defines JSON schemas for CompositeTypes (design system components)
 * These schemas are registered in the hardcoded schema registry
 * Schema type: "Composite"
 * 
 * Note: Currently hardcoded, will be migrated to pull from schemata co.list in future iteration
 * 
 * Schemas are registered via registerJsonSchema() calls from design-system/index.ts
 * For now, we export an empty object - schemas are registered dynamically
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const compositeTypeSchemas: Record<string, any> = {
	// Schemas are registered via registerJsonSchema() calls from design-system
}

