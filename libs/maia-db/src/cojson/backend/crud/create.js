/**
 * Create Operation
 * 
 * Provides the create() method for creating new CoValues.
 */

import { createCoMap } from '../../../services/oMap.js';
import { createCoList } from '../../../services/oList.js';
import { createCoStream } from '../../../services/oStream.js';
import * as collectionHelpers from '../read/collection-helpers.js';
import * as dataExtraction from '../extract/data-extraction.js';

/**
 * Append item to collection CoList
 * Helper function to append a created CoMap item to its collection CoList
 * @param {Object} backend - Backend instance
 * @param {RawCoValue} coValue - Created CoValue
 * @param {string} schemaToMatch - Schema co-id to match
 * @returns {Promise<void>}
 */
async function appendToCollection(backend, coValue, schemaToMatch) {
  // Get account.data CoMap
  const dataId = backend.account.get("data");
  if (!dataId) {
    return;
  }
  
  // Ensure account.data is loaded
  const dataCore = await collectionHelpers.ensureCoValueLoaded(backend, dataId, { waitForAvailable: true });
  if (!dataCore || !backend.isAvailable(dataCore)) {
    return;
  }
  
  const dataContent = backend.getCurrentContent(dataCore);
  if (!dataContent || typeof dataContent.get !== 'function') {
    return;
  }
  
  // Find the CoList in account.data that has matching item schema
  const keys = dataContent.keys && typeof dataContent.keys === 'function' 
    ? dataContent.keys() 
    : Object.keys(dataContent);
  
  for (const key of keys) {
    const collectionListId = dataContent.get(key);
    if (collectionListId && typeof collectionListId === 'string' && collectionListId.startsWith('co_')) {
      // Ensure collection CoList is loaded
      const collectionListCore = await collectionHelpers.ensureCoValueLoaded(backend, collectionListId, { waitForAvailable: true });
      
      // Check if available and is a colist
      if (collectionListCore && backend.isAvailable(collectionListCore)) {
        const collectionListContent = backend.getCurrentContent(collectionListCore);
        const cotype = collectionListContent?.cotype || collectionListContent?.type;
        
        if (cotype === 'colist') {
          // Check if this CoList's item schema matches the created item's schema
          const listHeader = backend.getHeader(collectionListCore);
          const listHeaderMeta = listHeader?.meta || null;
          const listItemSchema = listHeaderMeta?.$schema;
          
          // Match schema co-ids (both should be co-ids at this point)
          if (listItemSchema === schemaToMatch) {
            // Found matching CoList - check if item already exists before appending
            if (collectionListContent && typeof collectionListContent.append === 'function') {
              // CRITICAL FIX: Check if item already exists in CoList to prevent duplicate appends
              // This prevents multi-browser duplication where same item gets appended multiple times
              let itemExists = false;
              try {
                if (typeof collectionListContent.toJSON === 'function') {
                  const existingItemIds = collectionListContent.toJSON();
                  itemExists = Array.isArray(existingItemIds) && existingItemIds.includes(coValue.id);
                }
              } catch (e) {
                // If toJSON fails, assume item doesn't exist and proceed with append
                console.warn(`[CoJSONBackend] Error checking if item exists in CoList:`, e);
              }
              
              if (!itemExists) {
                collectionListContent.append(coValue.id);
                
                // Wait for colist to sync after append (ensures subscription fires with new item)
                if (backend.node.storage) {
                  await backend.node.syncManager.waitForStorageSync(collectionListCore.id);
                }
              } else {
                console.log(`[CoJSONBackend] Item ${coValue.id.substring(0, 12)}... already exists in CoList, skipping append`);
              }
              
              break; // Found matching CoList, no need to check other collections
            }
          }
        }
      }
    }
  }
}

/**
 * Determine cotype from schema or data type
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id
 * @param {*} data - Data to create
 * @returns {Promise<string>} Cotype (comap, colist, costream)
 */
async function determineCotype(backend, schema, data) {
  // Try to load schema to get cotype using generic method
  try {
    const schemaCore = await collectionHelpers.ensureCoValueLoaded(backend, schema, { waitForAvailable: true });
    if (schemaCore && backend.isAvailable(schemaCore)) {
      const schemaContent = backend.getCurrentContent(schemaCore);
      if (schemaContent && schemaContent.get) {
        const definition = schemaContent.get('definition');
        if (definition && definition.cotype) {
          // CoText support eliminated - throw error if schema specifies cotext
          if (definition.cotype === 'cotext' || definition.cotype === 'coplaintext') {
            throw new Error(`[CoJSONBackend] CoText (cotext) support has been eliminated. Schema ${schema} specifies cotext, which is no longer supported.`);
          }
          return definition.cotype;
        }
      }
    }
  } catch (e) {
    console.warn(`[CoJSONBackend] Failed to load schema ${schema} for cotype:`, e);
  }

  // Fallback: infer from data type
  if (Array.isArray(data)) {
    return 'colist';
  } else if (typeof data === 'string') {
    // CoText support eliminated - strings are not valid CoValue types
    throw new Error(`[CoJSONBackend] Cannot determine cotype from data type for schema ${schema}. String data type is not supported (CoText/cotext support has been eliminated). Use CoMap or CoList instead.`);
  } else if (typeof data === 'object' && data !== null) {
    return 'comap';
  } else {
    throw new Error(`[CoJSONBackend] Cannot determine cotype from data type for schema ${schema}`);
  }
}

/**
 * Create new record - directly creates CoValue using CoJSON raw methods
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...) for data collections
 * @param {Object} data - Data to create
 * @returns {Promise<Object>} Created record with generated co-id
 */
export async function create(backend, schema, data) {
  // Determine cotype from schema or data type
  const cotype = await determineCotype(backend, schema, data);
  
  // Resolve universal group once (with proper fallbacks via getDefaultGroup)
  // This eliminates redundant profile resolution in each create function
  if (!backend.account) {
    throw new Error('[CoJSONBackend] Account required for create');
  }
  
  // Resolve universal group once using getDefaultGroup() which has proper fallbacks
  // Falls back to account if profile unavailable (graceful degradation)
  const group = await backend.getDefaultGroup();

  let coValue;
  switch (cotype) {
    case 'comap':
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('[CoJSONBackend] Data must be object for comap');
      }
      // Pass group directly instead of account - eliminates profile resolution in createCoMap
      // Pass dbEngine for runtime schema validation (REQUIRED for co-ids)
      coValue = await createCoMap(group, data, schema, backend.node, backend.dbEngine);
      break;
    case 'colist':
      if (!Array.isArray(data)) {
        throw new Error('[CoJSONBackend] Data must be array for colist');
      }
      // Pass group directly instead of account - eliminates profile resolution in createCoList
      // Pass dbEngine for runtime schema validation (REQUIRED for co-ids)
      coValue = await createCoList(group, data, schema, backend.node, backend.dbEngine);
      break;
    case 'costream':
      // Pass group directly instead of account - eliminates profile resolution in createCoStream
      coValue = createCoStream(group, schema, backend.node);
      break;
    default:
      throw new Error(`[CoJSONBackend] Unsupported cotype: ${cotype}`);
  }

  // Wait for storage sync
  if (backend.node.storage) {
    await backend.node.syncManager.waitForStorageSync(coValue.id);
  }

  // CRITICAL: For data collection items (CoMaps), automatically append to collection CoList
  // This ensures created items appear in queries immediately
  if (cotype === 'comap' && coValue.id && schema) {
    try {
      // Get the actual schema co-id from the created item's headerMeta (single source of truth)
      const coValueCore = backend.getCoValue(coValue.id);
      const itemHeader = coValueCore ? backend.getHeader(coValueCore) : null;
      const itemHeaderMeta = itemHeader?.meta || null;
      const itemSchemaCoId = itemHeaderMeta?.$schema;
      
      // Use item's schema co-id if available, otherwise fall back to passed schema
      const schemaToMatch = itemSchemaCoId || schema;
      
      if (schemaToMatch) {
        await appendToCollection(backend, coValue, schemaToMatch);
      }
    } catch (error) {
      // Don't fail creation if collection append fails - continue silently
    }
  }

  // Return created CoValue data (extract properties as flat object for tool access)
  const coValueCore = backend.getCoValue(coValue.id);
  if (coValueCore && backend.isAvailable(coValueCore)) {
    const content = backend.getCurrentContent(coValueCore);
    if (content && typeof content.get === 'function') {
      // Extract properties as flat object (for tool access like $lastCreatedText)
      const result = { id: coValue.id };
      const keys = content.keys && typeof content.keys === 'function' 
        ? content.keys() 
        : Object.keys(content);
      for (const key of keys) {
        result[key] = content.get(key);
      }
      return result;
    }
    // Fallback to normalized format
    return dataExtraction.extractCoValueData(backend, coValueCore);
  }

  return {
    id: coValue.id,
    type: cotype,
    schema: schema
  };
}
