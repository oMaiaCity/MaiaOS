/**
 * Create Operation - Create new CoValues
 * 
 * Supports co-type syntax: "comap", "colist", "cotext", "costream"
 * - comap: cojson({op: 'create', coType: 'comap', group: group, data: {...}, schema: 'SchemaName'})
 * - colist: cojson({op: 'create', coType: 'colist', group: group, data: [...], schema: 'SchemaName'})
 * - cotext: cojson({op: 'create', coType: 'cotext', group: group, data: 'text', schema: 'SchemaName'})
 * - costream: cojson({op: 'create', coType: 'costream', group: group, schema: 'SchemaName'})
 * 
 * Also accepts simplified types: "map", "list", "text", "stream" for convenience (normalized to co-types)
 */

import { createCoMap } from '../../services/oMap.js';
import { createCoList } from '../../services/oList.js';
import { createPlainText } from '../../services/oPlainText.js';
import { createCoStream } from '../../services/oStream.js';

export class CreateOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute create operation
   * @param {Object} params
   * @param {string} params.coType - CoValue type ('map', 'list', 'text', 'stream' or 'comap', 'colist', 'cotext', 'costream')
   * @param {RawGroup} [params.group] - Group to create in (defaults to account's default group)
   * @param {Object|Array|string} params.data - Initial data (object for map, array for list, string for text)
   * @param {string} params.schema - Schema name for headerMeta (REQUIRED - no fallbacks)
   * @returns {Promise<Object>} Created CoValue data
   * @throws {Error} If schema is missing or validation fails
   */
  async execute(params) {
    const { coType, group, data, schema } = params;
    
    if (!coType) {
      throw new Error('[CreateOperation] coType required');
    }
    
    // STRICT: Schema is MANDATORY - no fallbacks
    if (!schema || typeof schema !== 'string') {
      throw new Error('[CreateOperation] Schema is REQUIRED. Provide a valid schema name (e.g., "ProfileSchema", "NotesSchema", "TextSchema")');
    }
    
    // Normalize type: map unified types to internal types
    let internalType = coType;
    if (coType === 'map' || coType === 'comap' || coType === 'co-map') {
      internalType = 'comap';
    } else if (coType === 'list' || coType === 'colist' || coType === 'co-list') {
      internalType = 'colist';
    } else if (coType === 'text' || coType === 'cotext' || coType === 'co-text') {
      internalType = 'cotext';
    } else if (coType === 'stream' || coType === 'costream' || coType === 'co-stream') {
      internalType = 'costream';
    }
    
    // Use provided group or default group
    const targetGroup = group || this.backend.getDefaultGroup();
    if (!targetGroup) {
      throw new Error('[CreateOperation] Group required (provide group or ensure account has default group)');
    }
    
    let coValue;
    
    switch (internalType) {
      case 'comap':
        if (!data || typeof data !== 'object') {
          throw new Error('[CreateOperation] Data required for map (must be object)');
        }
        coValue = await createCoMap(targetGroup, data, schema);
        break;
        
      case 'colist':
        if (!Array.isArray(data)) {
          throw new Error('[CreateOperation] Data required for list (must be array)');
        }
        coValue = await createCoList(targetGroup, data, schema);
        break;
        
      case 'cotext':
        if (typeof data !== 'string') {
          throw new Error('[CreateOperation] Data required for text (must be string)');
        }
        coValue = await createPlainText(targetGroup, data, schema);
        break;
        
      case 'costream':
        coValue = createCoStream(targetGroup, schema);
        break;
        
      default:
        throw new Error(`[CreateOperation] Unknown coType: ${coType}. Supported: comap, colist, cotext, costream (or map, list, text, stream)`);
    }
    
    // Wait for storage sync (important for persistence)
    if (this.backend.node.storage) {
      await this.backend.node.syncManager.waitForStorageSync(coValue.id);
    }
    
    // Return CoValue data using query operation logic
    const coValueCore = this.backend.getCoValue(coValue.id);
    if (coValueCore && this.backend.isAvailable(coValueCore)) {
      // Use query operation to extract data (avoid circular import by using backend methods directly)
      const content = this.backend.getCurrentContent(coValueCore);
      const header = this.backend.getHeader(coValueCore);
      const headerMeta = header?.meta || null;
      
      // Extract basic data and normalize to co-type names (comap, cotext, costream, colist)
      const rawType = content?.type || 'unknown';
      let normalizedType = rawType;
      if (rawType === 'coplaintext' || rawType === 'co-text' || rawType === 'cotext' || rawType === 'text') {
        normalizedType = 'cotext';
      } else if (rawType === 'colist' || rawType === 'co-list' || rawType === 'list') {
        normalizedType = 'colist';
      } else if (rawType === 'costream' || rawType === 'co-stream' || rawType === 'stream') {
        normalizedType = 'costream';
      } else if (rawType === 'comap' || rawType === 'co-map' || rawType === 'map') {
        normalizedType = 'comap';
      }
      
      // Schema is always set from the required parameter - no fallbacks
      return {
        id: coValue.id,
        type: normalizedType,
        schema: schema, // Always use provided schema - no fallbacks
        headerMeta: headerMeta,
        createdAt: header?.createdAt || null
      };
    }
    
    // Fallback: return basic info with co-type names
    let normalizedType = coType;
    if (coType === 'map' || coType === 'comap' || coType === 'co-map') {
      normalizedType = 'comap';
    } else if (coType === 'list' || coType === 'colist' || coType === 'co-list') {
      normalizedType = 'colist';
    } else if (coType === 'text' || coType === 'coplaintext' || coType === 'cotext' || coType === 'co-text') {
      normalizedType = 'cotext';
    } else if (coType === 'stream' || coType === 'costream' || coType === 'co-stream') {
      normalizedType = 'costream';
    }
    
    return {
      id: coValue.id,
      type: normalizedType,
      schema: schema // Always use provided schema - no fallbacks
    };
  }
}
