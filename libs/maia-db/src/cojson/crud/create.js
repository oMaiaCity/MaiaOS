/**
 * Create Operation
 * 
 * Provides the create() method for creating new CoValues.
 */

import { createCoMap } from '../cotypes/coMap.js';
import { createCoList } from '../cotypes/coList.js';
import { createCoStream } from '../cotypes/coStream.js';
import * as collectionHelpers from './collection-helpers.js';
import * as dataExtraction from './data-extraction.js';
// Schema indexing is handled by storage-level hooks (more resilient than API hooks)
// No CRUD-level hooks needed - storage hook catches ALL writes

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
  
  if (!backend.account) {
    throw new Error('[CoJSONBackend] Account required for create');
  }

  const group = await backend.getMaiaGroup();

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
      coValue = await createCoStream(group, schema, backend.node, backend.dbEngine);
      break;
    default:
      throw new Error(`[CoJSONBackend] Unsupported cotype: ${cotype}`);
  }

  // CRITICAL: Don't wait for storage sync - it blocks the UI!
  // The co-value is already created and available locally
  // Storage sync happens asynchronously in the background
  // Schema indexing is handled by storage-level hooks (storage-hook-wrapper.js)
  // This is more resilient than CRUD hooks because it catches ALL writes:
  // - Writes from CRUD API
  // - Writes from sync (remote peers)
  // - Writes from direct CoJSON operations
  // No need for CRUD-level hooks here

  // Return created CoValue data (extract properties as flat object for tool access)
  // CRITICAL: Always include original data as fallback to ensure all properties are available
  // This ensures $lastCreatedText and other properties are accessible even if CoValue extraction fails
  // Get CoValueCore from node to check availability
  const coValueCore = backend.node.getCoValue(coValue.id);
  if (coValueCore && backend.isAvailable(coValueCore)) {
    const content = backend.getCurrentContent(coValueCore);
    if (content && typeof content.get === 'function') {
      // Extract properties as flat object (for tool access like $lastCreatedText)
      const result = { id: coValue.id, ...data }; // Start with original data to ensure all properties
      const keys = content.keys && typeof content.keys === 'function' 
        ? content.keys() 
        : Object.keys(content);
      for (const key of keys) {
        // Override with actual CoValue content if available (more accurate)
        result[key] = content.get(key);
      }
      return result;
    }
    // Fallback to normalized format, but include original data
    const extracted = dataExtraction.extractCoValueData(backend, coValueCore);
    return { ...data, id: coValue.id, ...extracted }; // Merge original data with extracted
  }

  // Final fallback: return original data with id (ensures all properties including text are available)
  return {
    id: coValue.id,
    ...data, // Include original data to ensure text and other properties are available
    type: cotype,
    schema: schema
  };
}
