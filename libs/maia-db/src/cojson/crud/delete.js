/**
 * Delete Operation
 * 
 * Provides the delete() method for deleting CoValues.
 */

import * as collectionHelpers from './collection-helpers.js';
import { removeFromIndex } from '../indexing/schema-index-manager.js';

/**
 * Delete record - hard delete using CoJSON native operations
 * Removes item from CoList (hard delete) and clears CoMap content
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @param {string} id - Record co-id to delete
 * @returns {Promise<boolean>} true if deleted successfully
 */
export async function deleteRecord(backend, schema, id) {
  // Ensure CoValue is loaded before deleting (jazz-tools pattern)
  const coValueCore = await collectionHelpers.ensureCoValueLoaded(backend, id, { waitForAvailable: true });
  if (!coValueCore) {
    throw new Error(`[CoJSONBackend] CoValue not found: ${id}`);
  }

  if (!backend.isAvailable(coValueCore)) {
    throw new Error(`[CoJSONBackend] CoValue not available: ${id}`);
  }

  const content = backend.getCurrentContent(coValueCore);
  const rawType = content?.cotype || content?.type;

  // Hook: Remove from schema index before deletion
  const itemHeader = backend.getHeader(coValueCore);
  const itemHeaderMeta = itemHeader?.meta || null;
  const itemSchemaCoId = itemHeaderMeta?.$schema || schema;
  
  try {
    await removeFromIndex(backend, id, itemSchemaCoId);
  } catch (error) {
    // Don't fail deletion if index removal fails
    console.warn(`[CoJSONBackend] Error removing co-value ${id.substring(0, 12)}... from index:`, error);
  }

  // Hard delete: Remove from CoList and clear CoMap
  if (rawType === 'comap' && content.set) {
    // Step 1: Clear all properties from CoMap (hard delete content)
    // Get all keys and delete them (including _deleted if it exists from previous soft deletes)
    if (content.keys && typeof content.keys === 'function') {
      const keys = Array.from(content.keys());
      for (const key of keys) {
        // Delete all properties (id is in metadata, not a property)
        if (typeof content.delete === 'function') {
          content.delete(key);
        }
      }
    } else if (typeof content.delete === 'function') {
      // Fallback: iterate over object keys
      const keys = Object.keys(content);
      for (const key of keys) {
        content.delete(key);
      }
    }
    
    // Wait for storage sync
    if (backend.node.storage) {
      await backend.node.syncManager.waitForStorageSync(id);
    }
    
    return true;
  } else {
    throw new Error(`[CoJSONBackend] Delete not supported for type: ${rawType}`);
  }
}
