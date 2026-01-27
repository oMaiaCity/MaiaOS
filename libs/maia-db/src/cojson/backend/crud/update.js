/**
 * Update Operation
 * 
 * Provides the update() method for updating existing CoValues.
 */

import * as collectionHelpers from '../read/collection-helpers.js';
import * as dataExtraction from '../extract/data-extraction.js';

/**
 * Update existing record - directly updates CoValue using CoJSON raw methods
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @param {string} id - Record co-id to update
 * @param {Object} data - Data to update
 * @returns {Promise<Object>} Updated record
 */
export async function update(backend, schema, id, data) {
  // Ensure CoValue is loaded before updating (jazz-tools pattern)
  const coValueCore = await collectionHelpers.ensureCoValueLoaded(backend, id, { waitForAvailable: true });
  if (!coValueCore) {
    throw new Error(`[CoJSONBackend] CoValue not found: ${id}`);
  }

  if (!backend.isAvailable(coValueCore)) {
    throw new Error(`[CoJSONBackend] CoValue not available: ${id}`);
  }

  const content = backend.getCurrentContent(coValueCore);
  const rawType = content?.type || 'unknown';

  // Update based on type
  if (rawType === 'comap' && content.set) {
    // Update CoMap properties
    for (const [key, value] of Object.entries(data)) {
      content.set(key, value);
    }
  } else {
    throw new Error(`[CoJSONBackend] Update not supported for type: ${rawType}`);
  }

  // Wait for storage sync
  if (backend.node.storage) {
    await backend.node.syncManager.waitForStorageSync(id);
  }

  // Return updated data
  return dataExtraction.extractCoValueData(backend, coValueCore);
}
