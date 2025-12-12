/**
 * Utility function to set system properties (@label and @schema) on CoValues
 * created via dynamic schema logic
 *
 * @param coValue - The CoValue instance to set properties on
 * @param schemaValue - The value for @schema property:
 *   - "Schema" for schema CoValues (SchemaDefinition)
 *   - schemaName (e.g., "Car", "JazzComposite") for entity CoValues
 */

import { setupComputedFieldsForCoValue } from './computed-fields.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setSystemProps(coValue: any, schemaValue: string): Promise<void> {
	if (!coValue || !coValue.$isLoaded) {
		// Ensure CoValue is loaded
		await coValue.$jazz.ensureLoaded({ resolve: {} })
	}

	// Set @schema property
	if (!coValue.$jazz.has('@schema')) {
		coValue.$jazz.set('@schema', schemaValue)
	}

	// Initialize @label if it doesn't exist
	if (!coValue.$jazz.has('@label')) {
		coValue.$jazz.set('@label', '')
	}

	await coValue.$jazz.waitForSync()

	// Set up computed fields for @label
	setupComputedFieldsForCoValue(coValue)
}

