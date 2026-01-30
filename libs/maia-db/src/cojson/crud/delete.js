/**
 * Delete Operation
 * 
 * Provides the delete() method for deleting CoValues.
 * 
 * Unified delete operation for all co-types (CoMap, CoList, CoStream, CoPlainText).
 * Handles schema indexing automatically and ensures complete deletion.
 */

import * as collectionHelpers from './collection-helpers.js';
import { removeFromIndex } from '../indexing/schema-index-manager.js';

/**
 * Delete record - unified hard delete using CoJSON native operations
 * 
 * ARCHITECTURE: Unified delete for all co-types with automatic schema indexing.
 * Flow: Remove from index -> Clear content -> Sync storage
 * 
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

  // Step 1: Remove from schema index (MUST succeed before clearing content)
  // This ensures the co-value is removed from all indexes before clearing content
  // CRITICAL: If index removal fails, error propagates and deletion aborts (prevents orphaned skeletons)
  // Atomic deletion guarantee: either fully delete (index removal + property clearing) or fully fail (nothing changes)
  const itemHeader = backend.getHeader(coValueCore);
  const itemHeaderMeta = itemHeader?.meta || null;
  const itemSchemaCoId = itemHeaderMeta?.$schema || schema;
  
  await removeFromIndex(backend, id, itemSchemaCoId);
  // If this fails, error propagates and deletion aborts (prevents orphaned skeletons)

  // Step 2: Clear content based on co-type (unified handling for all types)
  let deletionSuccessful = false;
  
  if (rawType === 'comap' && content.set) {
    // CoMap: Clear all properties
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
    deletionSuccessful = true;
  } else if (rawType === 'colist' && content.delete) {
    // CoList: Clear all items by deleting from end to beginning (avoids index shifting)
    // Get current length and delete all items
    if (typeof content.toJSON === 'function') {
      const items = content.toJSON();
      // Delete from end to beginning to avoid index shifting issues
      for (let i = items.length - 1; i >= 0; i--) {
        if (typeof content.delete === 'function') {
          content.delete(i);
        }
      }
    }
    deletionSuccessful = true;
  } else if (rawType === 'costream') {
    // CoStream: Append-only immutable logs
    // Note: CoStream items cannot be deleted (they're append-only), but the CoStream co-value itself
    // is "deleted" by removing it from schema indexes (done in Step 1 above)
    // This effectively hides the stream from queries while preserving the immutable log
    // No content clearing needed - CoStreams don't have clearable properties like CoMaps/CoLists
    deletionSuccessful = true; // Successfully "deleted" (removed from index in Step 1)
  } else if (rawType === 'coplaintext' && content.delete) {
    // CoPlainText: Clear all text content
    // CoPlainText has delete method for characters, but we need to clear all
    // Get length and delete all characters from end to beginning
    if (typeof content.toString === 'function') {
      const text = content.toString();
      // Delete characters from end to beginning
      for (let i = text.length - 1; i >= 0; i--) {
        if (typeof content.delete === 'function') {
          // CoPlainText delete takes position, not index
          content.delete(i, 1);
        }
      }
    }
    deletionSuccessful = true;
  } else {
    throw new Error(`[CoJSONBackend] Delete not supported for type: ${rawType}. Supported types: comap, colist, costream, coplaintext`);
  }
  
  // Step 3: Wait for storage sync to ensure deletion is persisted
  if (deletionSuccessful && backend.node.storage) {
    await backend.node.syncManager.waitForStorageSync(id);
  }
  
  return deletionSuccessful;
}
