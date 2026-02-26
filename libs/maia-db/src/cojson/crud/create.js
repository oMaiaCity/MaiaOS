/**
 * Create Operation
 *
 * Provides the create() method for creating new CoValues.
 */

import { createCoValueForSpark } from '../covalue/create-covalue-for-spark.js'
import * as collectionHelpers from './collection-helpers.js'

// Schema indexing is handled by storage-level hooks (more resilient than API hooks)
// No CRUD-level hooks needed - storage hook catches ALL writes

/**
 * Determine cotype from schema or data type.
 * CRITICAL: Schema definitions (derived from meta-schema) must ALWAYS be CoMaps.
 * The cotype in the schema describes instance types (colist/comap), not the schema document's type.
 *
 * @param {Object} peer - Backend instance
 * @param {string} schema - Schema co-id
 * @param {*} data - Data to create
 * @returns {Promise<{ cotype: string, isSchemaDefinition: boolean }>} Cotype and schema-definition flag
 */
async function determineCotypeAndFlag(peer, schema, data) {
	try {
		const schemaCore = await collectionHelpers.ensureCoValueLoaded(peer, schema, {
			waitForAvailable: true,
		})
		if (schemaCore && peer.isAvailable(schemaCore)) {
			const schemaContent = peer.getCurrentContent(schemaCore)
			if (schemaContent?.get) {
				// Schema definitions (parent = meta-schema) must ALWAYS be CoMaps
				const title = schemaContent.get('title')
				if (title === '°Maia/schema/meta') {
					return { cotype: 'comap', isSchemaDefinition: true }
				}

				// For instance schemas: use cotype from definition or root
				const definition = schemaContent.get('definition')
				const cotype =
					definition?.cotype && typeof definition.cotype === 'string'
						? definition.cotype
						: schemaContent.get('cotype')
				if (cotype && typeof cotype === 'string') {
					if (cotype === 'cotext' || cotype === 'coplaintext') {
						throw new Error(
							`[MaiaDB] CoText (cotext) support has been eliminated. Schema ${schema} specifies cotext, which is no longer supported.`,
						)
					}
					return { cotype, isSchemaDefinition: false }
				}
			}
		}
	} catch (_e) {}

	// Fallback: infer from data type
	if (Array.isArray(data)) {
		return { cotype: 'colist', isSchemaDefinition: false }
	} else if (typeof data === 'string') {
		// CoText support eliminated - strings are not valid CoValue types
		throw new Error(
			`[MaiaDB] Cannot determine cotype from data type for schema ${schema}. String data type is not supported (CoText/cotext support has been eliminated). Use CoMap or CoList instead.`,
		)
	} else if (typeof data === 'object' && data !== null) {
		return { cotype: 'comap', isSchemaDefinition: false }
	} else {
		throw new Error(`[MaiaDB] Cannot determine cotype from data type for schema ${schema}`)
	}
}

/**
 * Create new record - directly creates CoValue using CoJSON raw methods
 * @param {Object} peer - Backend instance
 * @param {string} schema - Schema co-id (co_z...) for data collections
 * @param {Object} data - Data to create
 * @param {Object} [options] - Optional settings
 * @param {string} [options.spark='°Maia'] - Spark name for context (e.g. '°Maia', '@Maia')
 * @returns {Promise<Object>} Created record with generated co-id
 */
export async function create(peer, schema, data, options = {}) {
	const spark = options.spark ?? '°Maia'

	// Determine cotype from schema or data type
	const { cotype, isSchemaDefinition } = await determineCotypeAndFlag(peer, schema, data)

	if (!peer.account) {
		throw new Error('[MaiaDB] Account required for create')
	}

	if (cotype === 'comap' && (!data || typeof data !== 'object' || Array.isArray(data))) {
		throw new Error('[MaiaDB] Data must be object for comap')
	}
	if (cotype === 'colist' && !Array.isArray(data)) {
		throw new Error('[MaiaDB] Data must be array for colist')
	}

	const { coValue } = await createCoValueForSpark(peer, spark, {
		schema,
		cotype,
		data: cotype === 'comap' ? data : cotype === 'colist' ? data : undefined,
		dataEngine: peer.dbEngine,
		isSchemaDefinition,
	})

	// CRITICAL: Don't wait for storage sync - it blocks the UI!
	// The co-value is already created and available locally
	// Storage sync happens asynchronously in the background
	// Schema indexing is handled by storage-level hooks (storage-hook-wrapper.js)
	// This is more resilient than CRUD hooks because it catches ALL writes:
	// - Writes from CRUD API
	// - Writes from sync (remote peers)
	// - Writes from direct CoJSON operations
	// No need for CRUD-level hooks here

	// Return created CoValue data via read() API (single gate, normalized)
	const store = await peer.read(null, coValue.id, null, null, { deepResolve: false })
	const { waitForStoreReady } = await import('./read-operations.js')
	try {
		await waitForStoreReady(store, coValue.id, 5000)
	} catch (_e) {
		return { id: coValue.id, ...data, type: cotype, schema }
	}
	const extracted = store.value
	if (extracted && !extracted.error) {
		return { id: coValue.id, ...data, ...extracted }
	}
	return { id: coValue.id, ...data, type: cotype, schema }
}
