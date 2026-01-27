/**
 * Delete Operation
 * 
 * Provides the delete() method for deleting CoValues.
 */

import * as collectionHelpers from './collection-helpers.js';

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

  // Hard delete: Remove from CoList and clear CoMap
  if (rawType === 'comap' && content.set) {
    // Step 1: Remove item from CoList (hard delete from collection)
    const itemHeader = backend.getHeader(coValueCore);
    const itemHeaderMeta = itemHeader?.meta || null;
    const itemSchemaCoId = itemHeaderMeta?.$schema || schema;
    
    // Find the CoList in account.data that contains this item
    const dataId = backend.account.get("data");
    if (dataId) {
      // Ensure account.data is loaded
      const dataCore = await collectionHelpers.ensureCoValueLoaded(backend, dataId, { waitForAvailable: true });
      if (dataCore && backend.isAvailable(dataCore)) {
        const dataContent = backend.getCurrentContent(dataCore);
        if (dataContent && typeof dataContent.get === 'function') {
          // Find matching CoList
          const keys = dataContent.keys && typeof dataContent.keys === 'function' 
            ? dataContent.keys() 
            : Object.keys(dataContent);
          
          for (const key of keys) {
            const collectionListId = dataContent.get(key);
            if (collectionListId && typeof collectionListId === 'string' && collectionListId.startsWith('co_')) {
              // Ensure collection CoList is loaded
              const collectionListCore = await collectionHelpers.ensureCoValueLoaded(backend, collectionListId, { waitForAvailable: true });
              if (collectionListCore && backend.isAvailable(collectionListCore)) {
                const collectionListContent = backend.getCurrentContent(collectionListCore);
                const listCotype = collectionListContent?.cotype || collectionListContent?.type;
                
                if (listCotype === 'colist') {
                  // Check if this CoList's item schema matches
                  const listHeader = backend.getHeader(collectionListCore);
                  const listHeaderMeta = listHeader?.meta || null;
                  const listItemSchema = listHeaderMeta?.$schema;
                  
                  if (listItemSchema === itemSchemaCoId) {
                    // Found matching CoList - remove item by finding its index
                    if (collectionListContent && typeof collectionListContent.toJSON === 'function' && typeof collectionListContent.delete === 'function') {
                      try {
                        const itemIds = collectionListContent.toJSON(); // Array of item co-ids
                        const itemIndex = itemIds.indexOf(id);
                        
                        if (itemIndex !== -1) {
                          // Remove item from CoList (hard delete)
                          collectionListContent.delete(itemIndex);
                          
                          // Wait for colist to sync after delete
                          if (backend.node.storage) {
                            await backend.node.syncManager.waitForStorageSync(collectionListCore.id);
                          }
                        }
                      } catch (error) {
                        console.error(`[CoJSONBackend] Error removing item from CoList:`, error);
                        // Continue to clear CoMap even if CoList removal fails
                      }
                    }
                    break; // Found matching CoList, no need to check others
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Step 2: Clear all properties from CoMap (hard delete content)
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
