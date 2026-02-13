/**
 * Update Operation
 *
 * Provides the update() method for updating existing CoValues.
 * Validates updates BEFORE applying them to CRDT (before content.set() calls).
 */

import { loadSchemaAndValidate } from '@MaiaOS/schemata/validation.helper'
import { resolve } from '../schema/resolver.js'
import * as collectionHelpers from './collection-helpers.js'
import * as dataExtraction from './data-extraction.js'

/**
 * Update existing record - directly updates CoValue using CoJSON raw methods
 * Validates updates BEFORE applying them to CRDT (before content.set() calls)
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @param {string} id - Record co-id to update
 * @param {Object} data - Data to update
 * @returns {Promise<Object>} Updated record
 */
export async function update(backend, _schema, id, data) {
	// Ensure CoValue is loaded before updating (jazz-tools pattern)
	const coValueCore = await collectionHelpers.ensureCoValueLoaded(backend, id, {
		waitForAvailable: true,
	})
	if (!coValueCore) {
		throw new Error(`[CoJSONBackend] CoValue not found: ${id}`)
	}

	if (!backend.isAvailable(coValueCore)) {
		throw new Error(`[CoJSONBackend] CoValue not available: ${id}`)
	}

	const content = backend.getCurrentContent(coValueCore)
	const rawType = content?.type || 'unknown'

	// CRITICAL: Validate updates BEFORE applying to CRDT (before content.set())
	// Extract schema co-id from co-value headerMeta
	let schemaCoId = null
	try {
		schemaCoId = await resolve(backend, { fromCoValue: id }, { returnType: 'coId' })
	} catch (error) {
		// Schema extraction failed - skip validation (co-values without schemas, like context co-values)
		console.log(`[Update] Skipping validation for ${id}: ${error.message}`)
	}

	// Skip validation if:
	// 1. No schema found (co-values without schemas, like context co-values)
	// 2. Exception schemas (@account, @group, @maia)
	// 3. No dbEngine available
	if (schemaCoId && backend.dbEngine && schemaCoId.startsWith('co_z')) {
		// Import exception schema checker
		const { isExceptionSchema } = await import('../../schemas/registry.js')

		// Skip validation for exception schemas
		if (!isExceptionSchema(schemaCoId)) {
			// Get existing data (current state) - use getRawRecord which returns actual properties
			// getRawRecord returns data with $schema but without id (perfect for validation)
			const existingDataRaw = await backend.getRawRecord(id)

			if (existingDataRaw) {
				// Strip $schema metadata before validation (schema validation expects only data properties)
				const { $schema: _schema, ...existingDataWithoutMetadata } = existingDataRaw

				// Merge existing data with update data
				const mergedData = { ...existingDataWithoutMetadata, ...data }

				// Validate merged data against schema BEFORE applying to CRDT
				try {
					await loadSchemaAndValidate(backend, schemaCoId, mergedData, `update for ${id}`, {
						dbEngine: backend.dbEngine,
					})
				} catch (error) {
					// If validation fails, throw error (operation never applied to CRDT)
					throw new Error(`[Update] Validation failed: ${error.message}`)
				}
			}
		}
	}

	// Update based on type
	if (rawType === 'comap' && content.set) {
		// Update CoMap properties (validation passed, safe to apply)
		for (const [key, value] of Object.entries(data)) {
			content.set(key, value)
		}
	} else {
		throw new Error(`[CoJSONBackend] Update not supported for type: ${rawType}`)
	}

	// LOCAL-FIRST: Updates are instant, sync happens in background
	// REMOVED: await backend.node.syncManager.waitForStorageSync(id);
	// This was blocking the event loop unnecessarily - local-first architecture means
	// updates are immediately available locally, and sync happens asynchronously

	// Return updated data
	return dataExtraction.extractCoValueData(backend, coValueCore)
}
