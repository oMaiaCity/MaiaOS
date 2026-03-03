/**
 * Update Operation
 *
 * Provides the update() method for updating existing CoValues.
 * Validates updates BEFORE applying them to CRDT (before content.set() calls).
 */

import { loadSchemaAndValidate } from '@MaiaOS/schemata/validation.helper'
import { invalidateResolvedDataForMutatedCoValue } from '../cache/coCache.js'
import { resolve } from '../schema/resolver.js'
import * as collectionHelpers from './collection-helpers.js'
import * as dataExtraction from './data-extraction.js'

/**
 * Update existing record - directly updates CoValue using CoJSON raw methods
 * Validates updates BEFORE applying them to CRDT (before content.set() calls)
 * @param {Object} peer - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @param {string} id - Record co-id to update
 * @param {Object} data - Data to update
 * @returns {Promise<Object>} Updated record
 */
export async function update(peer, _schema, id, data) {
	// Ensure CoValue is loaded before updating (jazz-tools pattern)
	const coValueCore = await collectionHelpers.ensureCoValueLoaded(peer, id, {
		waitForAvailable: true,
	})
	if (!coValueCore) {
		throw new Error(`[MaiaDB] CoValue not found: ${id}`)
	}

	if (!peer.isAvailable(coValueCore)) {
		throw new Error(`[MaiaDB] CoValue not available: ${id}`)
	}

	const content = peer.getCurrentContent(coValueCore)
	const rawType = content?.type || 'unknown'

	// CRITICAL: Validate updates BEFORE applying to CRDT (before content.set())
	// Extract schema co-id from co-value headerMeta
	let schemaCoId = null
	try {
		schemaCoId = await resolve(peer, { fromCoValue: id }, { returnType: 'coId' })
	} catch (error) {
		// Schema extraction failed - skip validation (co-values without schemas, like context co-values)
		console.log(`[Update] Skipping validation for ${id}: ${error.message}`)
	}

	// Skip validation if:
	// 1. No schema found (co-values without schemas, like context co-values)
	// 2. Exception schemas (@account, @group, °Maia)
	// 3. No dbEngine available
	if (schemaCoId && peer.dbEngine && schemaCoId.startsWith('co_z')) {
		// Import exception schema checker
		const { isExceptionSchema } = await import('../../schemas/registry.js')

		// Skip validation for exception schemas
		if (!isExceptionSchema(schemaCoId)) {
			// Get existing data (current state) - use getRawRecord which returns actual properties
			const existingDataRaw = await peer.getRawRecord(id)

			if (existingDataRaw) {
				// Load schema to get allowed properties (additionalProperties: false → must strip metadata)
				const schemaDef = await resolve(peer, schemaCoId, { returnType: 'schema' })
				const allowedKeys =
					schemaDef?.properties && typeof schemaDef.properties === 'object'
						? new Set(Object.keys(schemaDef.properties))
						: null

				// Strip metadata (id, _coValueType, $schema, type, groupInfo, etc.) — keep only schema-defined properties
				const stripToSchema = (obj) =>
					allowedKeys
						? Object.fromEntries(Object.entries(obj).filter(([k]) => allowedKeys.has(k)))
						: Object.fromEntries(
								Object.entries(obj).filter(
									([k]) =>
										!['id', '$schema', '_coValueType', 'type', 'loading', 'error', 'groupInfo'].includes(k),
								),
							)
				const existingDataOnly = stripToSchema(existingDataRaw)

				// Merge existing (schema props only) with update data
				const mergedData = { ...existingDataOnly, ...data }

				// Validate merged data against schema BEFORE applying to CRDT
				try {
					await loadSchemaAndValidate(peer, schemaCoId, mergedData, `update for ${id}`, {
						dataEngine: peer.dbEngine,
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
		throw new Error(`[MaiaDB] Update not supported for type: ${rawType}`)
	}

	invalidateResolvedDataForMutatedCoValue(peer, id)

	// LOCAL-FIRST: Updates are instant, sync happens in background
	// REMOVED: await peer.node.syncManager.waitForStorageSync(id);
	// This was blocking the event loop unnecessarily - local-first architecture means
	// updates are immediately available locally, and sync happens asynchronously

	// Return updated data
	return dataExtraction.extractCoValueData(peer, coValueCore)
}
