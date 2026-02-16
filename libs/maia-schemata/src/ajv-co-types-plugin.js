/**
 * AJV Plugin for CoJSON Types
 *
 * Adds support for:
 * - `cotype` keyword: Validates CoJSON CRDT types (comap, colist, costream) at schema root
 * - `$co` keyword: Macro for co-id references in properties/items
 *
 * CoText is modeled as colist with string items (not a separate schema type).
 * ZERO transformation - direct validation (storage format = validation format)
 */

/**
 * Register CoJSON type keywords with AJV
 * @param {import('ajv').default} ajv - AJV instance
 */
export function ajvCoTypesPlugin(ajv) {
	// Add $co keyword as macro - expands to co-id string validation
	ajv.addKeyword({
		keyword: '$co',
		macro: (schemaCoId) => ({
			type: 'string',
			pattern: '^co_z[a-zA-Z0-9]+$',
			_schemaRef: schemaCoId, // Store schema co-id for metadata
		}),
		metaSchema: {
			type: 'string',
			anyOf: [
				{
					pattern: '^co_z[a-zA-Z0-9]+$',
					description: 'Co-id reference (after transformation)',
				},
				{
					pattern: '^@[a-zA-Z0-9_-]+/schema/',
					description: 'Human-readable schema ID with @ prefix (e.g. @domain/schema/...)',
				},
				{
					pattern: '^°[a-zA-Z0-9_-]+/schema/',
					description: 'Human-readable schema ID with ° prefix (e.g. °Maia/schema/...)',
				},
			],
			description:
				'Reference to schema that this property value must conform to (human-readable ID or co-id)',
		},
	})

	// Add cotype keyword - validates CRDT type at schema root only
	// For colist/costream, instances can be either:
	// 1. Direct arrays (raw CRDT structure)
	// 2. Objects with an 'items' property (wrapped with metadata like $schema, $id)
	// NOTE: cotype only applies to CoValues (objects/arrays), not primitives
	// Primitives (string, number, boolean, null) pass cotype validation automatically
	// because they are not CoValues and cotype validation doesn't apply to them
	ajv.addKeyword({
		keyword: 'cotype',
		validate: (schema, data) => {
			// Primitives (string, number, boolean, null, undefined) are not CoValues
			// cotype validation doesn't apply to them, so they pass validation
			if (data === null || typeof data !== 'object') {
				return true
			}

			if (schema === 'comap') {
				// comap must be an object (not array, not null)
				return !Array.isArray(data)
			}
			if (schema === 'colist' || schema === 'costream') {
				// Direct array (raw CRDT structure)
				if (Array.isArray(data)) {
					return true
				}
				// Object with 'items' property (wrapped instance with metadata)
				if (typeof data === 'object' && data !== null && Array.isArray(data.items)) {
					return true
				}
				return false
			}
			return false
		},
		metaSchema: {
			enum: ['comap', 'colist', 'costream'],
		},
	})

	// Add indexing keyword - metadata property (not a validation rule)
	// Always passes validation since it's just metadata about whether instances should be indexed
	ajv.addKeyword({
		keyword: 'indexing',
		validate: () => true, // Always pass - it's metadata, not a validation rule
		metaSchema: {
			type: 'boolean',
			description: 'Whether instances of this schema should be indexed in account.os.{schemaCoId}',
		},
	})
}
