/**
 * Utility function to set system properties (@label and @schema) on CoValues
 * created via dynamic schema logic
 *
 * @param coValue - The CoValue instance to set properties on
 * @param schemaCoValue - The SchemaDefinition CoValue reference for @schema property:
 *   - Meta-schema references itself
 *   - Schema definitions reference the meta-schema
 *   - Entity instances reference their schema definition
 */

import { setupComputedFieldsForCoValue } from './computed-fields.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setSystemProps(coValue: any, schemaCoValue: any): Promise<void> {
	// ⚡ OPTIMIZED: Only await if not already loaded
	if (!coValue || !coValue.$isLoaded) {
		await coValue.$jazz.ensureLoaded({ resolve: {} })
	}

	// ⚡ OPTIMIZED: Only await if not already loaded
	if (schemaCoValue && schemaCoValue.$jazz && !schemaCoValue.$isLoaded) {
		await schemaCoValue.$jazz.ensureLoaded({ resolve: {} })
	}

	// Set @schema property to CoValue reference
	if (!coValue.$jazz.has('@schema')) {
		coValue.$jazz.set('@schema', schemaCoValue)
	}

	// Initialize @label if it doesn't exist
	if (!coValue.$jazz.has('@label')) {
		coValue.$jazz.set('@label', '')
	}

	// ⚡ REMOVED: await coValue.$jazz.waitForSync()
	// LOCAL-FIRST: Don't wait for network sync - data is instantly available locally
	// Sync happens in background automatically

	// Set up computed fields for @label
	setupComputedFieldsForCoValue(coValue)
}

