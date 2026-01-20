/**
 * Create Operation - Create new CoValues
 * 
 * Supports unified type syntax: "map", "list", "text", "stream"
 * - map: cojson({op: 'create', coType: 'map', group: group, data: {...}, schema: 'SchemaName'})
 * - list: cojson({op: 'create', coType: 'list', group: group, data: [...], schema: 'SchemaName'})
 * - text: cojson({op: 'create', coType: 'text', group: group, data: 'text', schema: 'SchemaName'})
 * - stream: cojson({op: 'create', coType: 'stream', group: group, schema: 'SchemaName'})
 * 
 * Also accepts legacy types: "co-map", "co-list", "co-text", "co-stream" for backwards compatibility
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
   * @param {string} params.coType - CoValue type ('map', 'list', 'text', 'stream' or legacy 'co-map', 'co-list', 'co-text', 'co-stream')
   * @param {RawGroup} [params.group] - Group to create in (defaults to account's default group)
   * @param {Object|Array|string} params.data - Initial data (object for map, array for list, string for text)
   * @param {string} [params.schema] - Schema name for headerMeta
   * @returns {Promise<Object>} Created CoValue data
   */
  async execute(params) {
    const { coType, group, data, schema } = params;
    
    if (!coType) {
      throw new Error('[CreateOperation] coType required');
    }
    
    // Normalize type: map unified types to internal types
    let internalType = coType;
    if (coType === 'map' || coType === 'co-map') {
      internalType = 'co-map';
    } else if (coType === 'list' || coType === 'co-list') {
      internalType = 'co-list';
    } else if (coType === 'text' || coType === 'co-text') {
      internalType = 'co-text';
    } else if (coType === 'stream' || coType === 'co-stream') {
      internalType = 'co-stream';
    }
    
    // Use provided group or default group
    const targetGroup = group || this.backend.getDefaultGroup();
    if (!targetGroup) {
      throw new Error('[CreateOperation] Group required (provide group or ensure account has default group)');
    }
    
    let coValue;
    
    switch (internalType) {
      case 'co-map':
        if (!data || typeof data !== 'object') {
          throw new Error('[CreateOperation] Data required for map (must be object)');
        }
        coValue = createCoMap(targetGroup, data, schema);
        break;
        
      case 'co-list':
        if (!Array.isArray(data)) {
          throw new Error('[CreateOperation] Data required for list (must be array)');
        }
        coValue = createCoList(targetGroup, data, schema);
        break;
        
      case 'co-text':
        if (typeof data !== 'string') {
          throw new Error('[CreateOperation] Data required for text (must be string)');
        }
        coValue = createPlainText(targetGroup, data, schema);
        break;
        
      case 'co-stream':
        coValue = createCoStream(targetGroup, schema);
        break;
        
      default:
        throw new Error(`[CreateOperation] Unknown coType: ${coType}. Supported: map, list, text, stream`);
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
      
      // Extract basic data and normalize to unified syntax
      const rawType = content?.type || 'unknown';
      let normalizedType = rawType;
      if (rawType === 'coplaintext' || rawType === 'co-text') {
        normalizedType = 'text';
      } else if (rawType === 'colist' || rawType === 'co-list') {
        normalizedType = 'list';
      } else if (rawType === 'costream' || rawType === 'co-stream') {
        normalizedType = 'stream';
      } else if (rawType === 'comap' || rawType === 'co-map') {
        normalizedType = 'map';
      }
      
      // Determine schema (with fake schemas for accounts/groups/text)
      let finalSchema = schema || null;
      if (headerMeta?.type === 'account') {
        finalSchema = '@self';
      } else if (rawType === 'coplaintext' || rawType === 'co-text' || normalizedType === 'text') {
        finalSchema = '@text'; // Fake schema for co-text (leaf type)
      } else {
        // Check if it's a group (check multiple possible locations)
        let isGroup = false;
        
        // Method 1: Check coValueCore.ruleset
        if (coValueCore?.ruleset?.type === 'group') {
          isGroup = true;
        }
        // Method 2: Check content.core.isGroup()
        else if (content?.core?.isGroup && typeof content.core.isGroup === 'function') {
          try {
            isGroup = content.core.isGroup();
          } catch (e) {
            // Ignore
          }
        }
        // Method 3: Check header.ruleset
        else if (header?.ruleset?.type === 'group') {
          isGroup = true;
        }
        // Method 4: Check if content has group methods
        else if (content && typeof content.addMember === 'function' && typeof content.createMap === 'function') {
          isGroup = true;
        }
        
        if (isGroup) {
          finalSchema = '@group';
        } else {
          finalSchema = headerMeta?.$schema || null;
        }
      }
      
      return {
        id: coValue.id,
        type: normalizedType,
        schema: finalSchema,
        headerMeta: headerMeta,
        createdAt: header?.createdAt || null
      };
    }
    
    // Fallback: return basic info with normalized type
    let normalizedType = coType;
    if (coType === 'co-map' || coType === 'map') {
      normalizedType = 'map';
    } else if (coType === 'co-list' || coType === 'list') {
      normalizedType = 'list';
    } else if (coType === 'co-text' || coType === 'text') {
      normalizedType = 'text';
    } else if (coType === 'co-stream' || coType === 'stream') {
      normalizedType = 'stream';
    }
    
    // Determine schema for fallback (with fake schemas)
    let fallbackSchema = schema || null;
    if (normalizedType === 'text') {
      fallbackSchema = '@text'; // Fake schema for co-text
    }
    
    return {
      id: coValue.id,
      type: normalizedType,
      schema: fallbackSchema
    };
  }
}
